import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const tradingRuns = pgTable('trading_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tickers: text('tickers').array().notNull(),
  scenarioQuestion: text('scenario_question').notNull(),
  sessionType: text('session_type').notNull(),
  riskMode: text('risk_mode').notNull(),
  marketContext: text('market_context'),
  agentOutputs: jsonb('agent_outputs').default({}),
  finalReport: jsonb('final_report'),
  status: text('status').default('running'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type TradingRun = typeof tradingRuns.$inferSelect;
export type InsertTradingRun = typeof tradingRuns.$inferInsert;
