import ytdl from '@distube/ytdl-core';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: '',
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const MAX_DURATION_SECONDS = 12 * 60;

const transcriptCache = new Map<string, { transcript: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface VideoMetadata {
  videoId: string;
  title: string;
  durationSeconds: number;
  thumbnailUrl?: string;
}

export interface TranscriptionResult {
  success: boolean;
  transcript?: string;
  source?: 'captions' | 'asr';
  error?: string;
  tooLong?: boolean;
  durationSeconds?: number;
}

function cleanCache() {
  const now = Date.now();
  const entries = Array.from(transcriptCache.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_TTL) {
      transcriptCache.delete(key);
    }
  }
}

export function getCachedTranscript(videoId: string): string | null {
  cleanCache();
  const cached = transcriptCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.transcript;
  }
  return null;
}

export function cacheTranscript(videoId: string, transcript: string): void {
  transcriptCache.set(videoId, { transcript, timestamp: Date.now() });
}

export async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getBasicInfo(url);
    
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds, 10) || 0;
    
    return {
      videoId,
      title: info.videoDetails.title,
      durationSeconds,
      thumbnailUrl: info.videoDetails.thumbnails[0]?.url,
    };
  } catch (error) {
    console.error('Failed to get video metadata:', error);
    return null;
  }
}

export async function downloadAudio(
  videoId: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `cap-detector-${videoId}-${Date.now()}.mp3`);
  
  onProgress?.('Downloading audio from video...');
  
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'lowestaudio',
    });
    
    const writeStream = fs.createWriteStream(tempFile);
    
    stream.pipe(writeStream);
    
    stream.on('error', (error) => {
      fs.unlink(tempFile, () => {});
      reject(new Error(`Failed to download audio: ${error.message}`));
    });
    
    writeStream.on('finish', () => {
      resolve(tempFile);
    });
    
    writeStream.on('error', (error) => {
      fs.unlink(tempFile, () => {});
      reject(new Error(`Failed to write audio file: ${error.message}`));
    });
  });
}

export async function transcribeAudio(
  audioFilePath: string,
  onProgress?: (message: string) => void
): Promise<string> {
  onProgress?.('Transcribing audio with AI...');
  
  const audioBuffer = fs.readFileSync(audioFilePath);
  const base64Audio = audioBuffer.toString('base64');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/mpeg',
                data: base64Audio,
              },
            },
            {
              text: 'Please transcribe this audio recording. Output ONLY the transcription text, nothing else. Do not include any commentary, timestamps, or formatting - just the spoken words.',
            },
          ],
        },
      ],
    });
    
    const transcript = response.text || '';
    
    if (!transcript || transcript.length < 10) {
      throw new Error('Transcription returned empty or too short');
    }
    
    return transcript;
  } finally {
    fs.unlink(audioFilePath, (err) => {
      if (err) console.warn('Failed to cleanup temp audio file:', err);
    });
  }
}

export async function transcribeFromYouTube(
  videoId: string,
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> {
  const cached = getCachedTranscript(videoId);
  if (cached) {
    onProgress?.('Using cached transcript...');
    return { success: true, transcript: cached, source: 'asr' };
  }
  
  onProgress?.('Checking video duration...');
  const metadata = await getVideoMetadata(videoId);
  
  if (!metadata) {
    return { success: false, error: 'Could not fetch video information' };
  }
  
  if (metadata.durationSeconds > MAX_DURATION_SECONDS) {
    return {
      success: false,
      error: `Video is too long for automatic transcription (${Math.round(metadata.durationSeconds / 60)} minutes). Maximum is 12 minutes.`,
      tooLong: true,
      durationSeconds: metadata.durationSeconds,
    };
  }
  
  try {
    const audioPath = await downloadAudio(videoId, onProgress);
    const transcript = await transcribeAudio(audioPath, onProgress);
    
    cacheTranscript(videoId, transcript);
    
    return { success: true, transcript, source: 'asr' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio transcription failed',
    };
  }
}
