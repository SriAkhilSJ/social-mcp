"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Terminal,
  CheckCircle2,
  Loader2,
  Radio,
  MousePointerClick,
  MessageSquareQuote,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { RemoteControlState } from "@/lib/remote-control";
import type { AgentRoleId } from "@/lib/agent-roles";
import { VoiceAssistant, speakAgentVoice } from "./voice-assistant";

export function LiveControllerHud({
  remoteControl,
  selectedAgent = "master",
  onSwitchView,
  onMessageSent,
}: {
  remoteControl?: RemoteControlState | null;
  selectedAgent?: AgentRoleId;
  onSwitchView?: (view: "creator-studio" | "meeting" | "agents", agentId?: string) => void;
  onMessageSent?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showQuickPills, setShowQuickPills] = useState(false);

  useEffect(() => {
    if (remoteControl?.lastAction) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2500);
      return () => clearTimeout(t);
    }
  }, [remoteControl?.lastAction?.timestamp]);

  const last = remoteControl?.lastAction;
  const recent = remoteControl?.recentActions || [];
  const activeAgent = selectedAgent || remoteControl?.selectedAgent || "master";

  const handleVoiceDirective = async (transcript: string) => {
    const raw = transcript.toLowerCase().trim();

    // 1. Voice Navigation
    if (raw.includes("creator studio") || raw.includes("open studio") || raw.includes("go to studio")) {
      toast.info("🎙️ Jarvis: Switching to Creator Studio");
      onSwitchView?.("creator-studio");
      return;
    }
    if (raw.includes("war room") || raw.includes("meeting")) {
      toast.info("🎙️ Jarvis: Switching to Strategy War Room");
      onSwitchView?.("meeting");
      return;
    }
    if (raw.includes("master agent") || raw.includes("switch to master")) {
      toast.info("🎙️ Jarvis: Switching to Master Agent");
      onSwitchView?.("agents", "master");
      return;
    }
    if (raw.includes("creator agent") || raw.includes("switch to creator")) {
      toast.info("🎙️ Jarvis: Switching to Creator Agent");
      onSwitchView?.("agents", "creator");
      return;
    }
    if (raw.includes("scheduler agent") || raw.includes("switch to scheduler")) {
      toast.info("🎙️ Jarvis: Switching to Scheduler Agent");
      onSwitchView?.("agents", "scheduler");
      return;
    }
    if (raw.includes("analytics agent") || raw.includes("switch to analytics")) {
      toast.info("🎙️ Jarvis: Switching to Analytics Agent");
      onSwitchView?.("agents", "analytics");
      return;
    }
    if (raw.includes("research agent") || raw.includes("switch to research")) {
      toast.info("🎙️ Jarvis: Switching to Research Agent");
      onSwitchView?.("agents", "research");
      return;
    }

    // 2. Directive Dispatch
    if (remoteControl?.viewMode === "creator-studio") {
      try {
        toast.info(`🎙️ Dispatched to Google Flow: "${transcript}"`);
        const res = await fetch("/api/flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chat", message: transcript }),
        });
        const data = await res.json();
        if (data && data.reply) {
          speakAgentVoice(data.reply, "creator");
        }
        onMessageSent?.();
      } catch (e) {
        console.warn("Voice flow dispatch failed", e);
      }
    } else {
      try {
        toast.info(`🎙️ Sent to ${activeAgent.toUpperCase()}: "${transcript}"`);
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chat", agentId: activeAgent, message: transcript }),
        });
        const data = await res.json();
        if (data && data.reply) {
          speakAgentVoice(data.reply, activeAgent);
        }
        onMessageSent?.();
      } catch (e) {
        console.warn("Voice chat dispatch failed", e);
      }
    }
  };

  const QUICK_PROMPTS = [
    { label: "♟️ Ren Campaign Strategy", prompt: "What is our tactical release strategy for An Intelligent Blind Gangster?" },
    { label: "🎨 Flow Rain Scene", prompt: "Direct Google Flow to create a cinematic 9:16 anime scene of Ren Kurokawa in rain with dark glasses." },
    { label: "📊 Facebook Traction", prompt: "Analyze our Facebook Page traction and audience retention curves." },
    { label: "📅 Schedule Queue", prompt: "What posts are currently scheduled in our publishing queue?" },
  ];

  return (
    <div className="w-full mb-2.5 shrink-0 transition-all duration-300">
      <div
        className={`rounded-2xl border px-3.5 py-2.5 shadow-sm transition-all duration-300 ${
          pulse
            ? "border-purple-500/80 bg-linear-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 text-white shadow-purple-500/20 ring-2 ring-purple-500/40"
            : "border-slate-800 bg-slate-950/90 text-slate-100 shadow-slate-950/40"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Live Connection Badge & Current Action */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE CONTROLLER</span>
            </div>

            {remoteControl?.activeButton && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/40 text-purple-300 text-[11px] font-mono shrink-0 animate-pulse">
                <MousePointerClick className="w-3 h-3 text-purple-400" />
                <span>{remoteControl.activeButton}</span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                <span className="text-slate-400 font-normal">Active:</span>
                <span className="text-white font-medium">
                  {last?.description || "Director connected. Watching channel & studio..."}
                </span>
              </div>
              {last?.typedText && (
                <div className="text-[10px] text-purple-300/90 font-mono truncate flex items-center gap-1">
                  <Terminal className="w-2.5 h-2.5 shrink-0 text-purple-400" />
                  <span className="truncate">&gt; {last.typedText}</span>
                  <span className="animate-pulse">█</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick View Switchers & Action History Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Jarvis-like Voice Command & Speech Output */}
            <VoiceAssistant
              selectedAgent={activeAgent}
              onVoiceTranscript={handleVoiceDirective}
              autoSpeakText={last?.toast || last?.description}
            />

            {/* Quick Directive Prompts Button */}
            <button
              type="button"
              onClick={() => setShowQuickPills(!showQuickPills)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-purple-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Click to see sample voice prompts"
            >
              <MessageSquareQuote className="w-3 h-3 text-purple-400" />
              <span className="hidden xl:inline">Prompts</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            <button
              type="button"
              onClick={() => onSwitchView?.("creator-studio")}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                remoteControl?.viewMode === "creator-studio"
                  ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              🎨 Studio
            </button>
            <button
              type="button"
              onClick={() => onSwitchView?.("meeting")}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                remoteControl?.viewMode === "meeting"
                  ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              🎙️ War Room
            </button>
            <button
              type="button"
              onClick={() => onSwitchView?.("agents", "master")}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                remoteControl?.viewMode === "agents"
                  ? "bg-blue-600 text-white border-blue-400 shadow-sm"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              🧠 Master
            </button>

            {recent.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition cursor-pointer"
                title="Toggle Live Action Stream"
              >
                {expanded ? "Hide Log" : `Log (${recent.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Quick Voice Prompt Suggestions Bar (if toggled) */}
        {showQuickPills && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 animate-fadeIn">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">
              Click to speak to {activeAgent.toUpperCase()}:
            </span>
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setShowQuickPills(false);
                  void handleVoiceDirective(qp.prompt);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900/90 text-purple-200 hover:bg-purple-900/50 hover:text-white border border-purple-500/30 transition cursor-pointer"
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        {/* Live Controller Execution Stream Drawer */}
        {expanded && recent.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px]">
            {recent.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-400 py-0.5">
                <span className="text-[10px] text-slate-600">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="text-purple-400 font-bold">[{item.type}]</span>
                <span className="text-slate-200 truncate flex-1">{item.description}</span>
                {item.typedText && (
                  <span className="text-purple-300 text-[10px] max-w-[140px] truncate">
                    &gt; {item.typedText}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}