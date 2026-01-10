import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface TranscriptResult {
  success: boolean;
  transcript?: TranscriptSegment[];
  fullText?: string;
  error?: string;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptItems || transcriptItems.length === 0) {
      return {
        success: false,
        error: 'No transcript available for this video'
      };
    }

    const transcript: TranscriptSegment[] = transcriptItems.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration
    }));

    const fullText = transcript.map(t => t.text).join(' ');

    return {
      success: true,
      transcript,
      fullText
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('disabled') || errorMessage.includes('unavailable')) {
      return {
        success: false,
        error: 'Transcript is disabled or unavailable for this video'
      };
    }
    
    return {
      success: false,
      error: `Failed to fetch transcript: ${errorMessage}`
    };
  }
}
