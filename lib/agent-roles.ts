export type WorkerRoleId = "research" | "creator" | "scheduler" | "analytics";
export type AgentRoleId = "master" | WorkerRoleId;

export const WORKER_IDS: WorkerRoleId[] = [
  "research",
  "creator",
  "scheduler",
  "analytics",
];

export const WORKER_ORDER = WORKER_IDS;

export const ALL_AGENT_IDS: AgentRoleId[] = ["master", ...WORKER_IDS];

export interface AgentRoleMeta {
  id: AgentRoleId;
  name: string;
  shortName: string;
  emoji: string;
  tagline: string;
  description: string;
  color: string;
  bgSoft: string;
  borderSoft: string;
  avatar: string;
  seatIndex: number | null;
  characterId: string | null;
  computer: boolean;
  defaultInstructions: string;
}

export const AGENT_ROLES: Record<AgentRoleId, AgentRoleMeta> = {
  master: {
    id: "master",
    name: "Master Director",
    shortName: "Director",
    emoji: "🎬",
    tagline: "Executive Anime Director & Quality Gate",
    description:
      "Acts as the master anime director with exacting artistic standards (inspired by Eiichiro Oda). Reviews, critiques, and rates every assembled video before approving it for the publishing schedule. Never allows raw clips or mediocre work to pass.",
    color: "#2563EB",
    bgSoft: "bg-blue-50 text-blue-700",
    borderSoft: "border-blue-200",
    avatar: "/agents/data_agent_1/frame-0.webp",
    seatIndex: null,
    characterId: null,
    computer: false,
    defaultInstructions:
      "You are the Master Director — the Executive Anime Director and Quality Gate for the channel. You possess exacting artistic standards (inspired by Eiichiro Oda). You evaluate every deliverable with an uncompromising eye for character conviction, visceral hooks, hand-drawn anime aesthetic, and narrative weight. You strictly forbid raw clips, unfinished stills, or cyberpunk slop from reaching the publishing calendar. You review and rate (1-10) all video cuts before greenlighting them to the Scheduler.",
  },
  research: {
    id: "research",
    name: "Research Agent",
    shortName: "Research",
    emoji: "🔍",
    tagline: "Trends, Competitors & Audience Insights",
    description:
      "Researches viral hooks, competitor angles, hashtags, and niche trends using AI knowledge and its dedicated cloud browser desktop.",
    color: "#7C3AED",
    bgSoft: "bg-violet-50 text-violet-700",
    borderSoft: "border-violet-200",
    avatar: "/agents/data_agent_1/frame-0.webp",
    seatIndex: 0,
    characterId: "data_agent_1",
    computer: true,
    defaultInstructions:
      "You are the Research Agent. Focus strictly on social media trend analysis, competitor breakdowns, viral hooks, audience pain points, and platform-specific hashtag strategies. Use internal knowledge first and open the cloud desktop browser when live research is needed. Save structured findings for the Creator Agent.",
  },
  creator: {
    id: "creator",
    name: "Creator Agent",
    shortName: "Creator",
    emoji: "🎨",
    tagline: "Copywriting, Visuals & Video Studio",
    description:
      "Writes platform-native captions, viral hooks, and generates AI visuals and 9:16 video reels via Google Flow MCP (Veo 3.1 & Omni Flash) and Gemini.",
    color: "#EC4899",
    bgSoft: "bg-pink-50 text-pink-700",
    borderSoft: "border-pink-200",
    avatar: "/agents/data_agent_6/frame-0.webp",
    seatIndex: 1,
    characterId: "data_agent_6",
    computer: true,
    defaultInstructions:
      "You are the Creator Agent. Craft scroll-stopping social media posts, hooks, captions, hashtags, and generate AI visuals & 9:16 video reels (powered by Google Flow MCP with Veo 3.1 & Omni 1.1 Flash, Gemini Image Studio, and ImageKit). You build complete videos by chaining short clips (8-10s) into cohesive 40-45s cinematic reels. YOU CANNOT PUBLISH DIRECTLY TO THE SCHEDULE. When an anime video is completed, you submit the finished cut to the Master Director for rigorous review and rating. Only when the Master Director approves the complete video can Scheduler place it onto the publishing calendar. Never allow raw clips or unapproved stills to enter the schedule.",
  },
  scheduler: {
    id: "scheduler",
    name: "Scheduler Agent",
    shortName: "Scheduler",
    emoji: "📅",
    tagline: "Calendar Optimization & MCP Publishing",
    description:
      "Schedules approved drafts at optimal times in the campaign timezone and dispatches posts through Blotato / OpenPost MCP.",
    color: "#059669",
    bgSoft: "bg-emerald-50 text-emerald-700",
    borderSoft: "border-emerald-200",
    avatar: "/agents/data_agent_7/frame-0.webp",
    seatIndex: 2,
    characterId: "data_agent_7",
    computer: false,
    defaultInstructions:
      "You are the Scheduler Agent. Convert content drafts into scheduled posts on the campaign calendar, respecting campaign timezones, optimal posting windows, and connected Blotato / OpenPost MCP accounts.",
  },
  analytics: {
    id: "analytics",
    name: "Analytics Agent",
    shortName: "Analytics",
    emoji: "📊",
    tagline: "Performance Tracking & Growth Insights",
    description:
      "Syncs real post metrics from connected social platforms via MCP, tracks views and engagement trends, and recommends optimizations.",
    color: "#D97706",
    bgSoft: "bg-amber-50 text-amber-700",
    borderSoft: "border-amber-200",
    avatar: "/agents/data_agent_2/frame-0.webp",
    seatIndex: 3,
    characterId: "data_agent_2",
    computer: false,
    defaultInstructions:
      "You are the Analytics Agent. Retrieve, sync, and interpret real social media performance metrics (views, engagement, publishing success rate, platform breakdown). Never invent fake metrics; clearly explain empty states and actionable growth steps.",
  },
};

export function hasComputer(agentId: string): agentId is "research" | "creator" {
  return agentId === "research" || agentId === "creator";
}

export function getAgentBySeatIndex(idx: number): AgentRoleMeta {
  return (
    Object.values(AGENT_ROLES).find((r) => r.seatIndex === idx) ||
    AGENT_ROLES.research
  );
}
