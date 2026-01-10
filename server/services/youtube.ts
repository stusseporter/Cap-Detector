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
  const trimmed = url.trim();
  
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname;
    
    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      const segment = pathname.split('/')[1];
      if (segment) {
        videoId = segment.split('?')[0];
      }
    } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (pathname.startsWith('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split(/[?/]/)[0] || null;
      } else if (pathname.startsWith('/embed/')) {
        videoId = pathname.split('/embed/')[1]?.split(/[?/]/)[0] || null;
      } else if (pathname.startsWith('/v/')) {
        videoId = pathname.split('/v/')[1]?.split(/[?/]/)[0] || null;
      } else if (pathname === '/watch' || pathname.startsWith('/watch')) {
        videoId = parsed.searchParams.get('v');
      }
    }

    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }
  } catch {
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
