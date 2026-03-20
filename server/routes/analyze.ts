import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { tradingRuns } from '../../shared/schema.js';
import { buildContext } from '../lib/contextBuilder.js';
import { marketScan } from '../lib/marketScan.js';
import { runBob } from '../agents/bob.js';
import { runPamBias } from '../agents/pam_bias.js';
import { runChris } from '../agents/chris.js';
import { runMichael } from '../agents/michael.js';
import { runPeko } from '../agents/peko.js';
import { runLilPrint } from '../agents/lil_print.js';
import { runStusse } from '../agents/stusse.js';
import { runDust } from '../agents/dust.js';
import { runPamSynthesis } from '../agents/pam_synthesis.js';
import type { AgentName, RunInput, PamSynthesisOutput } from '../../shared/types.js';
import { client } from '../lib/claudeClient.js';

function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function extractSummary(output: Record<string, unknown>, agent: string): string {
  try {
    switch (agent) {
      case 'BOB': {
        const headlines = output.headline_summary as string[] | undefined;
        return headlines?.[0] ? `Research complete: ${headlines[0]}` : 'Research engine complete.';
      }
      case 'PAM': {
        const bias = output.htf_bias as string | undefined;
        const sd = output.stand_down as boolean | undefined;
        if (sd) return `PAM: STAND DOWN — ${output.stand_down_reason || 'conditions unclear'}`;
        return `PAM: ${(bias ?? 'neutral').toUpperCase()} — ${output.narrative_summary || 'HTF bias established.'}`;
      }
      case 'CHRIS': {
        const noSetup = output.no_setup as boolean | undefined;
        if (noSetup) return 'CHRIS: No clean ICT setup identified.';
        return `CHRIS: ${output.setup_type || 'Setup'} ${output.direction || ''} — Entry ${output.entry_price ?? 'TBD'}, Stop ${output.stop_loss ?? 'TBD'}`;
      }
      case 'MICHAEL': {
        const confirmed = output.thesis_confirmed as boolean | undefined;
        return confirmed ? `MICHAEL: Thesis confirmed. ${output.session_guidance || ''}` : `MICHAEL: Alternative pathway — ${output.alternative_pathway || 'see notes'}`;
      }
      case 'PEKO': {
        const detected = output.breakout_detected as boolean | undefined;
        return detected ? `PEKO: Breakout ${output.breakout_direction || ''} detected — momentum ${output.momentum_strength || ''}` : 'PEKO: No breakout setup active.';
      }
      case 'LIL_PRINT': {
        return `LIL PRINT: Hype meter ${output.hype_meter || 'N/A'} — ${output.lil_print_note || 'Retail radar complete.'}`;
      }
      case 'STUSSE': {
        const noLotto = output.no_lotto as boolean | undefined;
        if (noLotto) return 'STUSSE: No lotto play available.';
        return `STUSSE: ${output.play_type || ''} ${output.direction || ''} — Strike ${output.strike ?? 'TBD'}`;
      }
      case 'DUST': {
        const noSwing = output.no_swing as boolean | undefined;
        if (noSwing) return 'DUST: No swing play available.';
        return `DUST: ${output.direction || ''} ${output.strike_type || ''} — ${output.expiry_window || 'TBD'} window`;
      }
      case 'PAM_SYNTHESIS': {
        return `Final brief: ${(output.final_bias as string || 'N/A').toUpperCase()} — Confidence ${output.confidence_score ?? 0}/100`;
      }
      default:
        return 'Agent complete.';
    }
  } catch {
    return 'Agent complete.';
  }
}

const AGENT_ORDER: Array<{ name: AgentName; runner: (ctx: string) => Promise<Record<string, unknown>> }> = [
  { name: 'BOB', runner: runBob },
  { name: 'PAM', runner: runPamBias },
  { name: 'CHRIS', runner: runChris },
  { name: 'MICHAEL', runner: runMichael },
  { name: 'PEKO', runner: runPeko },
  { name: 'LIL_PRINT', runner: runLilPrint },
  { name: 'STUSSE', runner: runStusse },
  { name: 'DUST', runner: runDust },
  { name: 'PAM_SYNTHESIS', runner: runPamSynthesis },
];

export async function handleAnalyzeStream(req: Request, res: Response): Promise<void> {
  const input = req.body as RunInput;
  const { scenarioQuestion, tickers, marketContext, sessionType, riskMode } = input;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let effectiveContext = marketContext || '';
  const priorOutputs: Record<string, Record<string, unknown>> = {};

  // Auto-scan if no context
  if (!effectiveContext.trim()) {
    sseWrite(res, 'scan_start', { message: 'Initiating market scan...' });
    try {
      effectiveContext = await marketScan(tickers);
      sseWrite(res, 'scan_complete', { message: 'Market scan complete.', context: effectiveContext });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      effectiveContext = `Market scan failed — agents will proceed with available context. Error: ${msg}`;
      sseWrite(res, 'scan_complete', { message: effectiveContext });
    }
  }

  // Create initial DB record
  let runId: string = '';
  try {
    const [run] = await db.insert(tradingRuns).values({
      tickers,
      scenarioQuestion,
      sessionType,
      riskMode,
      marketContext: effectiveContext,
      agentOutputs: {},
      status: 'running',
    }).returning({ id: tradingRuns.id });
    runId = run.id;
  } catch (err) {
    sseWrite(res, 'error', { message: 'Failed to create run record.' });
    res.end();
    return;
  }

  // Run agent chain
  for (const { name, runner } of AGENT_ORDER) {
    sseWrite(res, 'agent_start', { agent: name, status: 'running' });

    try {
      const context = buildContext({
        scenarioQuestion,
        tickers,
        marketContext: effectiveContext,
        sessionType,
        riskMode,
        priorOutputs,
      });

      const output = await runner(context);
      priorOutputs[name] = output;

      const summary = extractSummary(output, name);
      sseWrite(res, 'agent_complete', { agent: name, status: 'complete', summary, output });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      priorOutputs[name] = { error: errorMsg, agent: name };
      sseWrite(res, 'agent_error', { agent: name, status: 'error', error: errorMsg });
    }
  }

  // Build final report
  const pamOutput = priorOutputs['PAM_SYNTHESIS'] as unknown as PamSynthesisOutput | undefined;
  const finalReport = pamOutput && !('parse_error' in pamOutput) ? pamOutput : null;

  // Save completed run to DB
  try {
    await db.update(tradingRuns)
      .set({
        agentOutputs: priorOutputs as Record<string, unknown>,
        finalReport: finalReport as Record<string, unknown> | null,
        status: 'complete',
      })
      .where(eq(tradingRuns.id, runId));
  } catch {
    // DB save error - still emit run_complete
  }

  sseWrite(res, 'run_complete', { runId, report: finalReport });
  res.end();
}

const PAM_CHAT_SYSTEM = `You are PAM, Lead Analyst of the Printer Gang Trading Desk. A completed analysis has been run. Answer follow-up questions about this specific analysis only. Calm, surgical, authoritative. Never invent new levels or setups not in the analysis.`;

export async function handleDeskChat(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { question } = req.body as { question: string };

  if (!question?.trim()) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const [run] = await db.select().from(tradingRuns).where(eq(tradingRuns.id, id)).limit(1);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const pamOutput = run.finalReport ? JSON.stringify(run.finalReport, null, 2) : 'No final report available.';
    const userMessage = `ANALYSIS CONTEXT:\n${pamOutput}\n\nUSER QUESTION: ${question}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: PAM_CHAT_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : 'No response.';
    res.json({ answer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}
