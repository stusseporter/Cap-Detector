# Cap Detector

## Overview

Cap Detector is a multi-content fact-checking application that analyzes YouTube videos, articles, Twitter/X threads, and raw text for factual claims versus emotional framing. Users paste a URL or text, and the app extracts content via APIs, then uses AI to analyze claims, identify manipulation tactics, and produce a "cap score" indicating the level of unsubstantiated claims.

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
- **Design**: "Digital Noir" aesthetic with Space Grotesk font, dark theme, amber/red accents

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx/esbuild
- **API Pattern**: REST endpoints with Server-Sent Events (SSE) for real-time progress updates
- **Main Endpoint**: `POST /api/analyze` - accepts URL or text with contentType parameter

### Content Ingestion Pipeline
The application implements a unified `ContentIngestionService` (`server/services/content-ingestion.ts`) that accepts any input type and returns `{ text, title, source, contentType }`.

**Supported content types:**
1. **YouTube Videos** - Transcript fetched via Supadata API, metadata via YouTube oEmbed
2. **Articles/Blogs** - HTML fetched and parsed with @mozilla/readability + jsdom
3. **Twitter/X Threads** - Thread fetched via Supadata API
4. **Raw Text** - Direct text input (100-50,000 characters)

**URL Detection Patterns:**
- YouTube: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `m.youtube.com/`
- Twitter: `twitter.com`, `x.com`
- Articles: Any other URL

### AI Analysis
- **Claim Analysis**: OpenAI API (GPT-5.1) for fact-checking and framing detection
- Analysis outputs include: cap score, claim list with ratings, and identified framing tactics
- Analysis is content-type-aware (adjusts prompts per content type)

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Current Tables**: users (auth support)
- **Session Storage**: Optional postgres session store via connect-pg-simple

### Build System
- Client builds to `dist/public` via Vite
- Server bundles to `dist/index.cjs` via esbuild
- Shared code in `shared/` directory accessible to both client and server

## Key Files

- `server/services/content-ingestion.ts` - Unified content extraction service
- `server/services/analysis.ts` - AI analysis pipeline (OpenAI GPT-5.1)
- `server/routes.ts` - API endpoints with SSE streaming
- `client/src/pages/home.tsx` - Main UI with 4-tab input and results display

## External Dependencies

### AI Services
- **OpenAI API** - Used for content analysis and fact-checking (via Replit AI Integrations)

### Content Extraction
- **Supadata API** - YouTube transcript fetching and Twitter thread extraction
- **@mozilla/readability + jsdom** - Article text extraction from HTML
- **YouTube oEmbed** - Video metadata (title, author, thumbnail) without API key

### Database
- **PostgreSQL** - Primary database (requires DATABASE_URL environment variable)
- **Drizzle ORM** - Database schema management and queries

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL
- `SUPADATA_API_KEY` - Supadata API key for YouTube transcripts and Twitter threads
