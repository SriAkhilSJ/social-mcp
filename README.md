# Socialix — AI Social Media Agent Team Studio

Full-stack AI Social Media Agent Team application built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, **InsForge / PostgreSQL + Drizzle ORM**, **OpenAI Agents SDK (`@openai/agents`)**, **Google Gemini (`gemini-2.5-flash-image`)**, **ImageKit AI Transformations**, **Inngest**, **E2B Cloud Desktop Sandboxes (`@e2b/desktop`)**, and **Blotato MCP (`https://mcp.blotato.com/mcp`)**.

---

## Key Features

- **Animated Isometric AI Agent Office (`1536×1024`)**: Choose between **Wooden Studio Office** and **Modern Creative Office** with live 27-frame typing animations, floating status pills, and hover popovers above all 4 specialist agents plus the **Master Agent** coordinator.
- **5-Agent Coordinated Workflow**:
  - **🧠 Master Agent**: Breaks goals into dependency-ordered plans (`depends_on`), delegates to specialists, tracks steps, and reviews final deliverables.
  - **🔍 Research Agent**: Researches hooks, competitor angles, and hashtags with access to a live cloud Linux browser VM.
  - **🎨 Creator Agent**: Writes platform-native copy & hashtags, generates visuals via Gemini / Studio, and applies ImageKit AI transformations.
  - **📅 Scheduler Agent**: Schedules drafts at optimal campaign-timezone slots and dispatches via **Blotato MCP** (or optional self-hosted **OpenPost MCP**).
  - **📊 Analytics Agent**: Syncs real post reach, views, engagement, and publishing success rates via MCP.
- **E2B Cloud Computer & Zero-Credential Takeover**: Live cloud desktop preview, full-screen viewer, `Start VM`, `Pause`, and `Take Over / Login` → `Done` handoff so passwords never pass through chat.
- **Manual Post Composer + ImageKit AI Studio**: Multi-platform live preview (`Instagram`, `TikTok`, `YouTube`, `X`, `LinkedIn`) and built-in **Edit Image** modal (`Remove BG`, `AI Upscale`, `AI Retouch`, `Drop Shadow`, `Smart Crop`, `Change Background`, `Generative Edit`).
- **Drag-and-Drop Campaign Calendar**: Month and Week views with timezone awareness, HTML5 drag-and-drop rescheduling synced to Blotato MCP, and a right-side preview drawer.
- **Google Flow Video MCP (`Veo 3.1` & `Omni 1.1 Flash`)**: Generate `9:16` Reels/Shorts and `16:9` videos directly using your Google Flow credit balance via `start-flow-mcp.bat` (`http://127.0.0.1:8787`), Gemini Veo API, or animated Studio Motion Reels in the composer & Creator Agent.
- **Facebook Pages & Reels + Multi-Channel Publishing**: Direct **Meta Graph API `v25.0`** Facebook Page discovery, Feed/Photo/Reel publishing, scheduling & insights sync alongside **Blotato MCP** and self-hosted **OpenPost Docker MCP** (`openpost-launch.bat`).
- **AES-256-GCM Encrypted Integrations Vault**: Per-user encrypted API keys (`INTEGRATIONS_ENCRYPTION_KEY`) for Google Flow MCP, Facebook Graph API, Blotato, OpenAI, Gemini, ImageKit, E2B, and OpenPost MCP.

---

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

- **Database**: Connects automatically to `DATABASE_URL` (InsForge / PostgreSQL) when configured, or zero-config embedded PostgreSQL (`@electric-sql/pglite` in `.data/pgdata`) applying all 11 SQL migrations in `migrations/`.
- **Background Worker (Optional)**: Run `npm run inngest:dev` alongside `npm run dev` to inspect the 15-minute cron scheduler and `task/execute` worker at `/api/inngest`.
