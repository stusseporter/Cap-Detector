export interface ContentResult {
  success: boolean;
  text?: string;
  title?: string;
  source?: string;
  contentType?: 'youtube' | 'article' | 'twitter' | 'text';
  thumbnailUrl?: string;
  authorName?: string;
  error?: string;
  errorFriendly?: string;
}

interface SupadataTranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

interface YouTubeOEmbedResult {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

interface SupadataTwitterTweet {
  text: string;
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /(?:twitter\.com|x\.com)/i.test(url);
}

async function fetchYouTubeMetadata(videoUrl: string): Promise<YouTubeOEmbedResult | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    return await response.json() as YouTubeOEmbedResult;
  } catch {
    return null;
  }
}

async function ingestYouTube(url: string, onProgress?: (msg: string) => void): Promise<ContentResult> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return {
      success: false,
      error: 'Invalid YouTube URL',
      errorFriendly: 'Not a valid YouTube URL. Try a link like youtube.com/watch?v=...',
    };
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  onProgress?.('Fetching video info...');
  const metadata = await fetchYouTubeMetadata(videoUrl);

  onProgress?.('Fetching transcript...');
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'SUPADATA_API_KEY not configured',
      errorFriendly: 'Transcript service is not configured. Please contact the admin.',
    };
  }

  try {
    const transcriptUrl = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(transcriptUrl, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 404 || status === 422) {
        return {
          success: false,
          contentType: 'youtube',
          title: metadata?.title,
          thumbnailUrl: metadata?.thumbnail_url,
          error: 'No transcript available',
          errorFriendly: "This video doesn't have auto-captions. Copy the transcript from YouTube's '...' menu and paste it in the Text tab.",
        };
      }
      if (status === 403) {
        return {
          success: false,
          contentType: 'youtube',
          error: 'Video not accessible',
          errorFriendly: "This video is private or deleted. We can't access it.",
        };
      }
      return {
        success: false,
        contentType: 'youtube',
        error: `Supadata API error: ${status}`,
        errorFriendly: "Couldn't fetch the transcript right now. Try again later or paste the text manually.",
      };
    }

    const data = await response.json() as { content: SupadataTranscriptItem[] | string };

    let fullText = '';
    if (typeof data.content === 'string') {
      fullText = data.content;
    } else if (Array.isArray(data.content)) {
      fullText = data.content.map((item: SupadataTranscriptItem) => item.text).join(' ');
    }

    if (!fullText || fullText.trim().length < 50) {
      return {
        success: false,
        contentType: 'youtube',
        title: metadata?.title,
        error: 'Transcript too short',
        errorFriendly: "The transcript we got is too short to analyze. Try pasting the full text manually.",
      };
    }

    onProgress?.('Transcript fetched successfully');

    return {
      success: true,
      text: fullText.trim(),
      title: metadata?.title || 'YouTube Video',
      source: videoUrl,
      contentType: 'youtube',
      thumbnailUrl: metadata?.thumbnail_url,
      authorName: metadata?.author_name,
    };
  } catch (error) {
    return {
      success: false,
      contentType: 'youtube',
      error: error instanceof Error ? error.message : 'Network error',
      errorFriendly: "Couldn't reach the transcript service. Check your connection and try again, or paste the text manually.",
    };
  }
}

async function ingestArticle(url: string, onProgress?: (msg: string) => void): Promise<ContentResult> {
  onProgress?.('Fetching article...');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CapDetector/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        return {
          success: false,
          contentType: 'article',
          error: 'Access blocked',
          errorFriendly: 'This site blocked us from reading the article. Copy and paste the text manually.',
        };
      }
      return {
        success: false,
        contentType: 'article',
        error: `HTTP ${response.status}`,
        errorFriendly: "Couldn't reach that URL. Check it's public and try again, or paste the text manually.",
      };
    }

    const html = await response.text();
    onProgress?.('Extracting article text...');

    const { JSDOM } = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return {
        success: false,
        contentType: 'article',
        error: 'Could not extract text',
        errorFriendly: "Couldn't extract article text. Try pasting the text manually.",
      };
    }

    const wordCount = article.textContent.trim().split(/\s+/).length;
    if (wordCount < 200) {
      return {
        success: false,
        contentType: 'article',
        error: 'Article too short',
        errorFriendly: 'Not enough content to analyze. We need at least 200 words.',
      };
    }

    onProgress?.('Article extracted successfully');

    return {
      success: true,
      text: article.textContent.trim(),
      title: article.title || 'Article',
      source: url,
      contentType: 'article',
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      success: false,
      contentType: 'article',
      error: isTimeout ? 'Request timed out' : (error instanceof Error ? error.message : 'Network error'),
      errorFriendly: isTimeout
        ? "The page took too long to load. Try again or paste the text manually."
        : "Couldn't reach that URL. Check it's public and try again, or paste the text manually.",
    };
  }
}

async function ingestTwitter(url: string, onProgress?: (msg: string) => void): Promise<ContentResult> {
  onProgress?.('Fetching tweet thread...');

  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'SUPADATA_API_KEY not configured',
      errorFriendly: 'Twitter service is not configured. Please contact the admin.',
    };
  }

  try {
    const twitterUrl = `https://api.supadata.ai/v1/twitter/thread?url=${encodeURIComponent(url)}`;
    const response = await fetch(twitterUrl, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 404 || status === 422) {
        return {
          success: false,
          contentType: 'twitter',
          error: 'Tweet not found',
          errorFriendly: "Couldn't find that tweet or thread. Make sure the link is correct and the account is public.",
        };
      }
      return {
        success: false,
        contentType: 'twitter',
        error: `API error: ${status}`,
        errorFriendly: "Couldn't fetch the tweet right now. Try again later or paste the text manually.",
      };
    }

    const data = await response.json() as { content: SupadataTwitterTweet[] | string };

    let fullText = '';
    if (typeof data.content === 'string') {
      fullText = data.content;
    } else if (Array.isArray(data.content)) {
      fullText = data.content.map((tweet: SupadataTwitterTweet) => tweet.text).join('\n\n');
    }

    if (!fullText || fullText.trim().length < 50) {
      return {
        success: false,
        contentType: 'twitter',
        error: 'Thread too short',
        errorFriendly: 'Not enough content to analyze. We need a more substantial thread.',
      };
    }

    onProgress?.('Thread fetched successfully');

    return {
      success: true,
      text: fullText.trim(),
      title: 'Twitter Thread',
      source: url,
      contentType: 'twitter',
    };
  } catch (error) {
    return {
      success: false,
      contentType: 'twitter',
      error: error instanceof Error ? error.message : 'Network error',
      errorFriendly: "Couldn't reach that URL. Check your connection and try again, or paste the text manually.",
    };
  }
}

function ingestText(text: string): ContentResult {
  const trimmed = text.trim();

  if (trimmed.length < 100) {
    return {
      success: false,
      contentType: 'text',
      error: 'Text too short',
      errorFriendly: 'Not enough content to analyze. We need at least 100 characters.',
    };
  }

  if (trimmed.length > 50000) {
    return {
      success: false,
      contentType: 'text',
      error: 'Text too long',
      errorFriendly: 'Text is too long. Please keep it under 50,000 characters.',
    };
  }

  return {
    success: true,
    text: trimmed,
    title: 'Pasted Text',
    source: 'manual',
    contentType: 'text',
  };
}

export type ContentType = 'youtube' | 'article' | 'twitter' | 'text';

function detectContentType(url: string): ContentType {
  if (isYouTubeUrl(url)) return 'youtube';
  if (isTwitterUrl(url)) return 'twitter';
  return 'article';
}

export async function ingestContent(
  input: { url?: string; text?: string; contentType: ContentType },
  onProgress?: (msg: string) => void
): Promise<ContentResult> {
  const { url, text, contentType } = input;

  if (contentType === 'text') {
    if (!text) return { success: false, error: 'No text provided', errorFriendly: 'Please paste some text to analyze.' };
    return ingestText(text);
  }

  if (!url) {
    return { success: false, error: 'No URL provided', errorFriendly: 'Please enter a URL.' };
  }

  const detectedType = detectContentType(url);

  if (contentType === 'youtube' && detectedType !== 'youtube') {
    return {
      success: false,
      contentType: 'youtube',
      error: 'Not a YouTube URL',
      errorFriendly: "That doesn't look like a YouTube link. Try a URL like youtube.com/watch?v=... or switch to another tab.",
    };
  }

  if (contentType === 'twitter' && detectedType !== 'twitter') {
    return {
      success: false,
      contentType: 'twitter',
      error: 'Not a Twitter URL',
      errorFriendly: "That doesn't look like a Twitter/X link. Try a URL like twitter.com/user/status/... or switch to another tab.",
    };
  }

  switch (detectedType === contentType ? contentType : detectedType) {
    case 'youtube':
      return ingestYouTube(url, onProgress);
    case 'twitter':
      return ingestTwitter(url, onProgress);
    case 'article':
    default:
      return ingestArticle(url, onProgress);
  }
}
