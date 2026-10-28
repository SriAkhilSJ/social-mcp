import fs from "fs";
import path from "path";
import type { AgentRoleId } from "@/lib/agent-roles";

export interface RemoteAction {
  type: string;
  description: string;
  buttonName?: string;
  typedText?: string;
  agentTarget?: string;
  status?: "typing" | "running" | "rendering" | "completed";
  timestamp: number;
  toast?: string;
}

export interface RemoteControlState {
  viewMode?: "agents" | "meeting" | "creator-studio";
  selectedAgent?: AgentRoleId;
  lastAction?: RemoteAction | null;
  recentActions?: RemoteAction[];
  isTyping?: boolean;
  activeButton?: string | null;
  updatedAt: number;
}

export interface MeetingTurn {
  agentId: AgentRoleId | "user";
  name: string;
  role: string;
  emoji: string;
  avatar: string;
  text: string;
  timestamp: string;
}

export interface MeetingSession {
  topic: string;
  turns: MeetingTurn[];
  activeSpeaker?: AgentRoleId | null;
  updatedAt: number;
}

export interface CreatorStudioMessage {
  id: string;
  sender: "user" | "creator";
  text: string;
  dispatchedPrompt?: string;
  time: string;
}

function getDataDir(): string {
  const dir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const REMOTE_FILE = path.join(getDataDir(), "remote-control.json");
const MEETING_FILE = path.join(getDataDir(), "active-meeting.json");
const CHAT_FILE = path.join(getDataDir(), "creator-studio-chat.json");

export function getRemoteControlState(): RemoteControlState {
  try {
    if (fs.existsSync(REMOTE_FILE)) {
      return JSON.parse(fs.readFileSync(REMOTE_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return {
    viewMode: "creator-studio",
    selectedAgent: "master",
    lastAction: null,
    updatedAt: Date.now(),
  };
}

export function setRemoteControlState(
  patch: Partial<RemoteControlState>
): RemoteControlState {
  const current = getRemoteControlState();
  const next: RemoteControlState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(REMOTE_FILE, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write remote-control.json:", err);
  }
  return next;
}

export function recordRemoteAction(
  action: Omit<RemoteAction, "timestamp">
): RemoteControlState {
  const current = getRemoteControlState();
  const fullAction: RemoteAction = {
    ...action,
    timestamp: Date.now(),
  };
  const recent = [fullAction, ...(current.recentActions || [])].slice(0, 8);
  return setRemoteControlState({
    lastAction: fullAction,
    recentActions: recent,
    isTyping: action.status === "typing",
    activeButton: action.buttonName || null,
  });
}

export function getMeetingSession(): MeetingSession | null {
  try {
    if (fs.existsSync(MEETING_FILE)) {
      return JSON.parse(fs.readFileSync(MEETING_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveMeetingSession(session: MeetingSession): void {
  try {
    fs.writeFileSync(MEETING_FILE, JSON.stringify(session, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write active-meeting.json:", err);
  }
}

export function getCreatorStudioChat(): CreatorStudioMessage[] {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return [
    {
      id: "init-1",
      sender: "creator",
      text: "🎨 Welcome to the Studio! I am directly commanding your live Google Flow workspace on the right. You can give me suggestions or creative directives through this chat, and I'll execute them live in the browser preview.",
      time: "Just now",
    },
  ];
}

export function saveCreatorStudioChat(messages: CreatorStudioMessage[]): void {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write creator-studio-chat.json:", err);
  }
}

export function appendCreatorStudioMessage(
  msg: CreatorStudioMessage
): CreatorStudioMessage[] {
  const current = getCreatorStudioChat();
  const next = [...current, msg];
  saveCreatorStudioChat(next);
  return next;
}
