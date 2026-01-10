# Cap Detector

## Overview

Cap Detector is a YouTube video fact-checking application that analyzes video content for factual claims versus emotional framing. Users paste a YouTube URL, and the app automatically extracts or generates a transcript, then uses AI to analyze claims, identify manipulation tactics, and produce a "cap score" indicating the level of unsubstantiated claims in the content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom theme variables
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx/esbuild
- **API Pattern**: REST endpoints with Server-Sent Events (SSE) for real-time progress updates
- **Main Endpoint**: `POST /api/analyze` - accepts YouTube URL or manual transcript

### Transcript Pipeline
The application implements a multi-stage fallback system for obtaining transcripts:
1. **YouTube Captions API** - First attempts to fetch existing captions via youtube-transcript library
2. **Audio Transcription (ASR)** - Falls back to downloading audio via ytdl-core and transcribing with Google Gemini
3. **Manual Input** - Final fallback allows users to paste transcript directly

Key constraints:
- Maximum video duration: 12 minutes (enforced via metadata check)
- Transcript caching: 24-hour TTL using in-memory Map

### AI Analysis
- **Transcription**: Google Gemini API via @google/genai SDK
- **Claim Analysis**: OpenAI API for fact-checking and framing detection
- Analysis outputs include: cap score, claim list with ratings, and identified framing tactics

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Current Tables**: users, conversations, messages (chat feature support)
- **Session Storage**: Optional postgres session store via connect-pg-simple

### Build System
- Client builds to `dist/public` via Vite
- Server bundles to `dist/index.cjs` via esbuild
- Shared code in `shared/` directory accessible to both client and server

## External Dependencies

### AI Services
- **OpenAI API** - Used for transcript analysis and fact-checking (via Replit AI Integrations)
- **Google Gemini API** - Used for audio-to-text transcription (via Replit AI Integrations)

### YouTube Integration
- **ytdl-core** (@distube/ytdl-core) - Downloads audio streams from YouTube videos
- **youtube-transcript** - Fetches existing YouTube captions when available

### Database
- **PostgreSQL** - Primary database (requires DATABASE_URL environment variable)
- **Drizzle ORM** - Database schema management and queries

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Google Gemini API key
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Google Gemini API base URL