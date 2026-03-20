import type { Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { tradingRuns } from '../../shared/schema.js';
import type { HistoryItem, PamSynthesisOutput } from '../../shared/types.js';

export async function handleGetHistory(_req: Request, res: Response): Promise<void> {
  try {
    const runs = await db.select({
      id: tradingRuns.id,
      tickers: tradingRuns.tickers,
      scenarioQuestion: tradingRuns.scenarioQuestion,
      sessionType: tradingRuns.sessionType,
      finalReport: tradingRuns.finalReport,
      createdAt: tradingRuns.createdAt,
    })
      .from(tradingRuns)
      .orderBy(desc(tradingRuns.createdAt))
      .limit(50);

    const items: HistoryItem[] = runs.map((r) => {
      const report = r.finalReport as PamSynthesisOutput | null;
      return {
        id: r.id,
        tickers: r.tickers,
        scenarioQuestion: r.scenarioQuestion,
        sessionType: r.sessionType as HistoryItem['sessionType'],
        finalBias: report?.final_bias ?? null,
        confidenceScore: report?.confidence_score ?? null,
        setupQuality: report?.setup_quality ?? null,
        createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });

    res.json(items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}

export async function handleGetRun(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const [run] = await db.select().from(tradingRuns).where(eq(tradingRuns.id, id)).limit(1);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json({
      id: run.id,
      tickers: run.tickers,
      scenarioQuestion: run.scenarioQuestion,
      sessionType: run.sessionType,
      riskMode: run.riskMode,
      marketContext: run.marketContext,
      agentOutputs: run.agentOutputs,
      finalReport: run.finalReport,
      status: run.status,
      createdAt: run.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}
