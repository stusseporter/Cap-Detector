import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { ingestContent, type ContentType } from "./services/content-ingestion";
import { analyzeContent, type AnalysisResult } from "./services/analysis";

interface AnalyzeRequest {
  url?: string;
  text?: string;
  contentType: ContentType;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { url, text, contentType } = req.body as AnalyzeRequest;

      if (!contentType || !['youtube', 'article', 'twitter', 'text'].includes(contentType)) {
        return res.status(400).json({
          error: "Invalid content type",
          message: "Please select a content type: YouTube, Article, Twitter, or Text."
        });
      }

      if (contentType !== 'text' && !url) {
        return res.status(400).json({
          error: "No URL provided",
          message: "Please enter a URL to analyze."
        });
      }

      if (contentType === 'text' && !text) {
        return res.status(400).json({
          error: "No text provided",
          message: "Please paste some text to analyze."
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      sendEvent("progress", { message: "Starting content extraction..." });

      const content = await ingestContent(
        { url: url?.trim(), text, contentType },
        (message) => sendEvent("progress", { message })
      );

      if (!content.success || !content.text) {
        sendEvent("content_failed", {
          message: content.errorFriendly || content.error || 'Failed to extract content.',
          contentType: content.contentType,
        });
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        return res.end();
      }

      sendEvent("progress", { message: "Analyzing content..." });

      const analysis = await analyzeContent(
        content.text,
        content.contentType || contentType,
        (message) => sendEvent("progress", { message })
      );

      sendEvent("complete", {
        analysis,
        contentType: content.contentType,
        title: content.title,
        source: content.source,
        authorName: content.authorName,
        thumbnailUrl: content.thumbnailUrl,
        textLength: content.text.length,
      });

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();

    } catch (error) {
      console.error("Analysis error:", error);

      if (!res.headersSent) {
        return res.status(500).json({
          error: "Analysis failed",
          message: error instanceof Error ? error.message : "Unknown error occurred"
        });
      }

      res.write(`data: ${JSON.stringify({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Analysis failed" 
      })}\n\n`);
      res.end();
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
