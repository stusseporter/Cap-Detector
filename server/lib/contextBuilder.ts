export function buildContext(params: {
  scenarioQuestion: string;
  tickers: string[];
  marketContext: string;
  sessionType: string;
  riskMode: string;
  priorOutputs: Record<string, Record<string, unknown>>;
}): string {
  const { scenarioQuestion, tickers, marketContext, sessionType, riskMode, priorOutputs } = params;

  const sections = [
    `SCENARIO QUESTION: ${scenarioQuestion}`,
    `TICKERS: ${tickers.join(', ')}`,
    `SESSION TYPE: ${sessionType}`,
    `RISK MODE: ${riskMode}`,
    `MARKET CONTEXT:\n${marketContext || 'No context provided.'}`,
  ];

  if (Object.keys(priorOutputs).length > 0) {
    sections.push('\n--- PRIOR AGENT OUTPUTS ---');
    for (const [name, output] of Object.entries(priorOutputs)) {
      sections.push(`\n${name}:\n${JSON.stringify(output, null, 2)}`);
    }
    sections.push('--- END PRIOR OUTPUTS ---');
  }

  return sections.join('\n\n');
}
