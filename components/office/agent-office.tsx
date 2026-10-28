"use client";

import { useEffect, useState } from "react";
import {
  AGENT_ROLES,
  getAgentBySeatIndex,
  type AgentRoleId,
  type WorkerRoleId,
} from "@/lib/agent-roles";
import type { LiveStatusResponse } from "@/lib/orchestration";
import { CheckCircle2, AlertCircle, Clock, Loader2, Sparkles } from "lucide-react";

interface OfficeSeat {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  zIndex: number;
  character: {
    id: string;
    name: string;
    width: number;
    height: number;
    thumbnail: string;
    sprite: string;
    animations?: {
      typing?: string[];
    };
  };
}

interface OfficeBundle {
  office: {
    name: string;
    width: number;
    height: number;
    background: string;
  };
  seats: OfficeSeat[];
}

const STATUS_BADGE: Record<
  string,
  { label: string; dot: string; pill: string }
> = {
  idle: {
    label: "Idle",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600",
  },
  scheduled: {
    label: "Pending",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700",
  },
  queued: {
    label: "Queued",
    dot: "bg-blue-400 animate-pulse",
    pill: "bg-blue-50 text-blue-700",
  },
  running: {
    label: "Working...",
    dot: "bg-emerald-500 animate-ping",
    pill: "bg-emerald-50 text-emerald-700",
  },
  waiting_for_user: {
    label: "Needs Login",
    dot: "bg-amber-500 animate-ping",
    pill: "bg-amber-100 text-amber-800",
  },
  needs_input: {
    label: "Waiting",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700",
  },
  done: {
    label: "Done",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-700",
  },
  expired: {
    label: "Expired",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600",
  },
};

export function AgentOffice({
  officeKey = "wooden-office",
  selectedAgentId,
  onSelectAgent,
  liveStatus,
}: {
  officeKey?: string;
  selectedAgentId?: AgentRoleId | null;
  onSelectAgent?: (agentId: AgentRoleId) => void;
  liveStatus?: LiveStatusResponse | null;
}) {
  const [scene, setScene] = useState<OfficeBundle | null>(null);
  const [frameTick, setFrameTick] = useState(0);
  const [hoveredAgent, setHoveredAgent] = useState<WorkerRoleId | null>(null);

  const normalizedKey =
    officeKey?.includes("modern") ? "modern-office" : "wooden-office";

  useEffect(() => {
    let active = true;
    fetch(`/office-studio/${normalizedKey}.json`)
      .then((r) => r.json())
      .then((json: OfficeBundle) => {
        if (active) setScene(json);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [normalizedKey]);

  // Animate typing frames when any agent is running
  useEffect(() => {
    const anyWorking = Object.values(liveStatus?.agents || {}).some(
      (a) => a.status === "running" || a.status === "queued"
    );
    const id = setInterval(() => {
      setFrameTick((t) => (t + 1) % 240);
    }, anyWorking ? 140 : 600);
    return () => clearInterval(id);
  }, [liveStatus]);

  if (!scene) {
    return (
      <div className="h-full w-full flex items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Loading AI Agent Office...
        </div>
      </div>
    );
  }

  const officeW = scene.office.width || 1536;
  const officeH = scene.office.height || 1024;
  const masterBusy = (liveStatus?.activePlanCount || 0) > 0;

  return (
    <div className="relative h-full w-full flex flex-col justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-900/95 shadow-sm select-none">
      {/* Top Floating Master Coordinator Bar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => onSelectAgent?.("master")}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-3.5 py-2 shadow-lg backdrop-blur-md border transition cursor-pointer ${
            selectedAgentId === "master"
              ? "bg-blue-600 text-white border-blue-500 ring-2 ring-blue-400/50"
              : "bg-white/95 text-slate-900 border-slate-200/90 hover:bg-white"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/15 text-base">
            🧠
          </span>
          <div className="text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold leading-none">
              Master Agent
              <span
                className={`h-2 w-2 rounded-full ${
                  masterBusy ? "bg-emerald-400 animate-ping" : "bg-emerald-500"
                }`}
              />
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                selectedAgentId === "master" ? "text-blue-100" : "text-slate-500"
              }`}
            >
              {masterBusy
                ? `Coordinating ${liveStatus?.activePlanCount} active plan`
                : "Click to assign tasks"}
            </div>
          </div>
        </button>

        <div className="pointer-events-auto hidden sm:flex items-center gap-1.5 rounded-full bg-slate-900/75 backdrop-blur px-3 py-1 text-[11px] font-medium text-slate-200 border border-white/10">
          <Sparkles className="h-3 w-3 text-blue-400" />
          {normalizedKey === "modern-office" ? "Modern Office" : "Wooden Office"}
        </div>
      </div>

      {/* Responsive Fixed-Ratio Isometric Stage */}
      <div className="relative w-full aspect-[3/2] max-h-full mx-auto overflow-hidden">
        <img
          src={scene.office.background}
          alt={scene.office.name}
          className="h-full w-full object-cover pointer-events-none"
          draggable={false}
        />

        {scene.seats.map((seat, idx) => {
          const role = getAgentBySeatIndex(idx);
          const workerId = role.id as WorkerRoleId;
          const agentLive = liveStatus?.agents?.[workerId];
          const stateKey = agentLive?.status || "idle";
          const badge = STATUS_BADGE[stateKey] || STATUS_BADGE.idle;
          const isSelected = selectedAgentId === workerId;
          const isRunning = stateKey === "running";
          const frames = seat.character.animations?.typing || [seat.character.sprite];
          const frameSrc = isRunning
            ? frames[frameTick % frames.length]
            : frames[0] || seat.character.sprite;

          const leftPct = (seat.x / officeW) * 100;
          const topPct = (seat.y / officeH) * 100;
          const widthPct = (seat.width / officeW) * 100;

          return (
            <div
              key={seat.id}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                zIndex: isSelected || hoveredAgent === workerId ? 25 : seat.zIndex + 5,
              }}
              onMouseEnter={() => setHoveredAgent(workerId)}
              onMouseLeave={() => setHoveredAgent(null)}
              onClick={() => onSelectAgent?.(workerId)}
              className="absolute group cursor-pointer"
            >
              {/* Floating Agent Name & Live Status Pill above head */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-md transition-all border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-500 scale-105 ring-2 ring-blue-400/50"
                      : isRunning
                      ? "bg-emerald-600 text-white border-emerald-500 scale-105"
                      : "bg-white/95 text-slate-800 border-slate-200/90 group-hover:scale-105"
                  }`}
                >
                  <span>{role.emoji}</span>
                  <span>{role.name}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelected || isRunning ? "bg-white animate-pulse" : badge.dot
                    }`}
                  />
                </div>
              </div>

              {/* Rich Live Task Hover Popover */}
              {hoveredAgent === workerId && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-[106%] left-1/2 -translate-x-1/2 mb-7 w-64 rounded-2xl bg-white/98 backdrop-blur-md p-3.5 shadow-2xl border border-slate-200 z-40 text-left pointer-events-auto"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{role.emoji}</span>
                      <span>{role.name}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.pill}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    {agentLive?.currentStep ||
                      agentLive?.taskTitle ||
                      role.tagline}
                  </p>

                  {agentLive?.summary && stateKey === "done" && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50/80 p-2 text-[10px] text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                      <span className="line-clamp-2">{agentLive.summary}</span>
                    </div>
                  )}

                  {agentLive?.error && stateKey === "failed" && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-[10px] text-red-700">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{agentLive.error}</span>
                    </div>
                  )}

                  {agentLive?.artifacts && agentLive.artifacts.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
                      {agentLive.artifacts
                        .filter((a) => a.type === "image" && a.url)
                        .slice(0, 3)
                        .map((art) => (
                          <img
                            key={art.id}
                            src={art.url!}
                            alt={art.name}
                            className="h-10 w-10 rounded-lg object-cover border border-slate-200"
                          />
                        ))}
                      <span className="text-[10px] font-medium text-slate-500">
                        {agentLive.artifactCount} output
                        {agentLive.artifactCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {AGENT_ROLES[workerId].computer ? "Cloud VM Ready" : "MCP Ready"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectAgent?.(workerId)}
                      className="font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Open Chat →
                    </button>
                  </div>
                </div>
              )}

              {/* Selection Glow Ring */}
              {isSelected && (
                <div className="absolute -inset-2 rounded-full bg-blue-500/20 blur-md pointer-events-none" />
              )}

              {/* Character Sprite */}
              <img
                src={frameSrc}
                alt={role.name}
                draggable={false}
                className={`relative w-full h-auto drop-shadow-xl transition-transform duration-200 ${
                  isSelected
                    ? "scale-105"
                    : "group-hover:scale-105"
                } ${!isRunning ? "animate-float-slow" : ""}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
