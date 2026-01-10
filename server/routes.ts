import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { extractVideoId, fetchTranscript, formatTimestamp } from "./services/youtube";
import { analyzeTranscript, type AnalysisResult } from "./services/analysis";
import { transcribeFromYouTube, getVideoMetadata, getCachedTranscript, cacheTranscript } from "./services/transcription";

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
      let transcriptSource: 'captions' | 'asr' | 'manual' = 'captions';

      if (manualTranscript) {
        sendEvent("progress", { message: "Using provided transcript..." });
        transcriptText = manualTranscript;
        transcriptSource = 'manual';
      } else {
        const cachedTranscript = getCachedTranscript(videoId!);
        if (cachedTranscript) {
          sendEvent("progress", { message: "Using cached transcript..." });
          transcriptText = cachedTranscript;
          transcriptSource = 'asr';
        } else {
          sendEvent("progress", { message: "Fetching captions..." });
          
          const transcriptResult = await fetchTranscript(videoId!);
          
          if (transcriptResult.success && transcriptResult.fullText) {
            transcriptText = transcriptResult.fullText;
            transcriptSegments = transcriptResult.transcript!;
            transcriptSource = 'captions';
            sendEvent("progress", { message: "Captions fetched successfully" });
          } else {
            sendEvent("progress", { message: "No captions found — generating transcript from audio..." });
            
            const asrResult = await transcribeFromYouTube(videoId!, (message) => {
              sendEvent("progress", { message });
            });
            
            if (asrResult.success && asrResult.transcript) {
              transcriptText = asrResult.transcript;
              transcriptSource = 'asr';
              sendEvent("progress", { message: "Audio transcription complete" });
            } else if (asrResult.tooLong) {
              sendEvent("transcript_failed", { 
                message: asrResult.error,
                requireManual: true,
                tooLong: true,
                durationSeconds: asrResult.durationSeconds
              });
              res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
              return res.end();
            } else {
              const errorDetail = asrResult.error ? asrResult.error : 'Unknown error occurred during audio transcription.';
              sendEvent("transcript_failed", { 
                message: `Automatic transcription failed: ${errorDetail} Please paste the transcript manually.`,
                requireManual: true
              });
              res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
              return res.end();
            }
          }
        }
      }

      sendEvent("progress", { message: "Analyzing content..." });

      const analysis = await analyzeTranscript(
        transcriptSegments || transcriptText,
        (message) => sendEvent("progress", { message })
      );

      sendEvent("complete", {
        videoId,
        analysis,
        transcriptLength: transcriptText.length,
        transcriptSource
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
