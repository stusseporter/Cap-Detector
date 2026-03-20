import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { handleAnalyzeStream, handleDeskChat } from "./routes/analyze.js";
import { handleGetHistory, handleGetRun } from "./routes/history.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Health check
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok", model: "claude-sonnet-4-20250514" });
  });

  // Analyze stream (SSE)
  app.post("/api/analyze/stream", handleAnalyzeStream);

  // History
  app.get("/api/history", handleGetHistory);

  // Single run
  app.get("/api/runs/:id", handleGetRun);

  // Desk chat
  app.post("/api/runs/:id/chat", handleDeskChat);

  return httpServer;
}
