import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { extractVideoId, fetchTranscript, formatTimestamp } from "./services/youtube";
import { analyzeTranscript, type AnalysisResult } from "./services/analysis";

interface AnalyzeRequest {
  url?: string;
  manualTranscript?: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { url, manualTranscript } = req.body as AnalyzeRequest;

      let videoId: string | null = null;
      
      if (url) {
        videoId = extractVideoId(url);
      }

      if (videoId && !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        videoId = null;
      }

      if (!videoId && !manualTranscript) {
        return res.status(400).json({
          error: "Invalid YouTube URL",
          message: "Could not extract video ID. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., youtube.com/embed/..."
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      let transcriptText: string;
      let transcriptSegments: { text: string; offset: number; duration: number }[] | null = null;

      if (manualTranscript) {
        sendEvent("progress", { message: "Using provided transcript..." });
        transcriptText = manualTranscript;
      } else {
        sendEvent("progress", { message: "Fetching video transcript..." });
        
        const transcriptResult = await fetchTranscript(videoId!);
        
        if (!transcriptResult.success) {
          sendEvent("transcript_failed", { 
            message: transcriptResult.error,
            requireManual: true
          });
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          return res.end();
        }

        transcriptText = transcriptResult.fullText!;
        transcriptSegments = transcriptResult.transcript!;
        sendEvent("progress", { message: "Transcript fetched successfully" });
      }

      sendEvent("progress", { message: "Analyzing content..." });

      const analysis = await analyzeTranscript(
        transcriptSegments || transcriptText,
        (message) => sendEvent("progress", { message })
      );

      sendEvent("complete", {
        videoId,
        analysis,
        transcriptLength: transcriptText.length
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
