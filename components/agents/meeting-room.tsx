"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Play,
  Send,
  Loader2,
  CheckCircle2,
  Users,
  Flame,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AGENT_ROLES, type AgentRoleId } from "@/lib/agent-roles";

export interface MeetingMessage {
  agentId: AgentRoleId | "user";
  name: string;
  role: string;
  emoji: string;
  avatar: string;
  text: string;
  timestamp: string;
}

const PRESET_TOPICS = [
  "Launch Strategy: 'An Intelligent Blind Gangster' — The Syndicate Betrayal & Rise to Power",
  "Episode 1 Hook: The night they blinded him, and how he dismantled them in the dark",
  "How to scale 'An Intelligent Blind Gangster' to 1M+ views on Facebook Reels & TikTok",
  "Veo 3.1 Visual Direction: Noir anime, dark glasses, rain-soaked streets, and high-IQ chess moves",
];

const BOARDROOM_SEATS: AgentRoleId[] = [
  "master",
  "analytics",
  "research",
  "creator",
  "scheduler",
];

export function MeetingRoom({
  campaignId,
  onPlanCreated,
}: {
  campaignId: number;
  onPlanCreated?: (planId?: number) => void;
}) {
  const [topic, setTopic] = useState(PRESET_TOPICS[0]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<AgentRoleId | null>(null);
  const [userContribution, setUserContribution] = useState("");
  const [executing, setExecuting] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeSpeaker]);

  useEffect(() => {
    let mounted = true;
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/agents/meeting");
        if (!res.ok) return;
        const data = await res.json();
        if (data.session?.turns && data.session.turns.length > 0 && mounted) {
          setMessages((current) => {
            if (current.length === data.session.turns.length) return current;
            return data.session.turns;
          });
          if (data.session.topic) setTopic(data.session.topic);
        }
      } catch {
        // ignore
      }
    };
    void fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleStartMeeting = async (selectedTopic?: string) => {
    const meetingTopic = selectedTopic || topic;
    setLoading(true);
    setMessages([]);
    setActiveSpeaker("master");

    try {
      const res = await fetch("/api/agents/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start-meeting",
          topic: meetingTopic,
        }),
      });

      if (!res.ok) throw new Error("Failed to start meeting");
      const data = await res.json();
      const turns: MeetingMessage[] = data.turns || [];

      // Animate speaker turns smoothly
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        if (turn.agentId !== "user") {
          setActiveSpeaker(turn.agentId as AgentRoleId);
        }
        setMessages((prev) => [...prev, turn]);
        await new Promise((r) => setTimeout(r, 600));
      }
      setActiveSpeaker(null);
      toast.success("5-Agent Strategy Meeting concluded! Ready for execution.");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Meeting failed to start");
      setActiveSpeaker(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUserReply = async () => {
    const text = userContribution.trim();
    if (!text || loading) return;

    const userMsg: MeetingMessage = {
      agentId: "user",
      name: "You (Executive Producer)",
      role: "Channel Owner",
      emoji: "👑",
      avatar: "/agents/data_agent_1/frame-0.webp",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setUserContribution("");
    setLoading(true);
    setActiveSpeaker("master");

    try {
      const res = await fetch("/api/agents/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user-reply",
          topic,
          userMessage: text,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("Agents failed to answer");
      const data = await res.json();
      const turns: MeetingMessage[] = data.turns || [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        if (turn.agentId !== "user") {
          setActiveSpeaker(turn.agentId as AgentRoleId);
        }
        setMessages((prev) => [...prev, turn]);
        await new Promise((r) => setTimeout(r, 500));
      }
      setActiveSpeaker(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Meeting communication error");
      setActiveSpeaker(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteStrategy = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/agents/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute-plan",
          topic,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "Strategy deployed to AI Office!");
        if (onPlanCreated) onPlanCreated(data.planId);
      } else {
        throw new Error(data.error || "Deployment failed");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not deploy strategy");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      {/* Top War Room Header */}
      <div className="shrink-0 border-b border-slate-100 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 text-white dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 text-xs">
                🎙️
              </span>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                5-Agent Strategy War Room
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="hidden sm:block mt-0.5 text-[11px] text-slate-300 truncate">
              5 agents analyze your Facebook posts for <strong className="text-amber-300 font-semibold">The Blind Janitor</strong> & <strong className="text-amber-300 font-semibold">Mafia Boss Dad</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setActiveSpeaker(null);
                  toast.success("Boardroom discussion cleared");
                }}
                disabled={loading}
                className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-red-500/20 hover:text-red-300 transition cursor-pointer"
                title="Clear boardroom transcript"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
                <span>Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleStartMeeting()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-95 transition cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-white" />
              )}
              <span>{messages.length === 0 ? "Start Meeting" : "Restart"}</span>
            </button>
          </div>
        </div>

        {/* Boardroom Seating Dock */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5 overflow-x-auto">
          {BOARDROOM_SEATS.map((agentId) => {
            const role = AGENT_ROLES[agentId];
            const isSpeaking = activeSpeaker === agentId;
            return (
              <div
                key={agentId}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition shrink-0 ${
                  isSpeaking
                    ? "bg-blue-500/30 border-blue-400 shadow-sm shadow-blue-500/30 ring-1 ring-emerald-400 scale-102"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="relative h-6 w-6 rounded-md overflow-hidden border border-white/30 bg-slate-800 flex items-center justify-center text-xs shrink-0">
                  {role.avatar ? (
                    <img
                      src={role.avatar}
                      alt={role.name}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    role.emoji
                  )}
                  {isSpeaking && (
                    <span className="absolute inset-0 ring-1 ring-emerald-400 rounded-md animate-pulse" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>{role.emoji}</span>
                    <span>{role.shortName}</span>
                  </div>
                </div>
                {isSpeaking && (
                  <span className="text-[9px] font-bold text-emerald-300 animate-pulse">
                    ●
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Agendas / Topics */}
      <div className="shrink-0 bg-slate-50 px-3 py-1.5 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto dark:bg-slate-800/50 dark:border-slate-800">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Flame className="h-3 w-3 text-amber-500" /> Agenda:
        </span>
        {PRESET_TOPICS.map((t, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setTopic(t);
              handleStartMeeting(t);
            }}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition whitespace-nowrap cursor-pointer ${
              topic === t
                ? "bg-white text-blue-700 border-blue-300 shadow-2xs font-bold dark:bg-slate-700 dark:text-blue-300 dark:border-blue-500"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
            }`}
          >
            {t.length > 40 ? t.slice(0, 40) + "..." : t}
          </button>
        ))}
      </div>

      {/* Main Boardroom Transcript Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/40">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-xl border border-blue-200 mb-2 shadow-xs dark:bg-slate-800 dark:border-slate-700">
              🎙️
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              The Boardroom Table is Ready
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-3 dark:text-slate-400">
              Click &quot;Start Meeting&quot; above to have all 5 agents analyze your 63 Facebook posts and devise a viral battle plan.
            </p>
            <button
              type="button"
              onClick={() => handleStartMeeting()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer shadow-xs transition"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              Call Meeting to Order
            </button>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.agentId === "user";
          const role = !isUser ? AGENT_ROLES[m.agentId as AgentRoleId] : null;

          return (
            <div
              key={idx}
              className={`flex gap-2.5 items-start ${
                isUser ? "flex-row-reverse" : "flex-row"
              } animate-in fade-in duration-300`}
            >
              <div
                className={`relative h-9 w-9 shrink-0 rounded-xl overflow-hidden border shadow-2xs ${
                  isUser
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
                }`}
              >
                {m.avatar ? (
                  <img src={m.avatar} alt={m.name} className="h-full w-full object-cover object-top" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-base">
                    {m.emoji}
                  </span>
                )}
              </div>

              <div
                className={`flex-1 min-w-0 max-w-[90%] rounded-2xl p-3 shadow-2xs ${
                  isUser
                    ? "bg-amber-500 text-slate-950 font-medium"
                    : "bg-white border border-slate-200/90 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-extrabold flex items-center gap-1 truncate">
                      <span>{m.emoji}</span>
                      <span>{m.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                      • {m.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{m.timestamp}</span>
                </div>

                <div className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words font-normal">
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}

        {loading && activeSpeaker && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-800 text-xs font-medium animate-pulse dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span>
              <strong>{AGENT_ROLES[activeSpeaker]?.name}</strong> is formulating strategy...
            </span>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Bottom Control Bar & User Interjection */}
      <div className="shrink-0 border-t border-slate-200/90 bg-white p-2.5 sm:p-3 space-y-2 dark:bg-slate-900 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUserReply();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={userContribution}
              onChange={(e) => setUserContribution(e.target.value)}
              placeholder="Chime in or direct the boardroom (e.g. 'What if we reveal the cat's true power in Ep #26?')..."
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={!userContribution.trim() || loading}
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer dark:bg-blue-600 dark:hover:bg-blue-500 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

        {messages.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 dark:text-slate-400 truncate min-w-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">
                Consensus on <strong>{topic.slice(0, 35)}...</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleExecuteStrategy}
              disabled={executing || loading}
              className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition cursor-pointer disabled:opacity-60 shrink-0"
            >
              {executing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Approve & Deploy 5 Agents</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
