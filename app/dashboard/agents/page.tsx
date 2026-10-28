"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { AgentPanel } from "@/components/agents/agent-panel";
import { MeetingRoom } from "@/components/agents/meeting-room";
import { CreatorStudio } from "@/components/agents/creator-studio";
import { AgentOffice } from "@/components/office/agent-office";
import { LiveControllerHud } from "@/components/agents/live-controller-hud";
import {
  AGENT_ROLES,
  WORKER_ORDER,
  type AgentRoleId,
  type WorkerRoleId,
} from "@/lib/agent-roles";

function AgentsWorkspaceInner() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get("agent") as AgentRoleId | null;

  const { campaign, liveStatus, refreshStatus } = useDashboard();
  const [selectedAgent, setSelectedAgent] = useState<AgentRoleId>(
    initialParam && AGENT_ROLES[initialParam] ? initialParam : "master"
  );
  const [viewMode, setViewMode] = useState<"agents" | "meeting" | "creator-studio">("agents");
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [showOffice, setShowOffice] = useState(true);

  useEffect(() => {
    if (initialParam && AGENT_ROLES[initialParam]) {
      setSelectedAgent(initialParam);
      setViewMode("agents");
    }
  }, [initialParam]);

  const lastRemoteTimestampRef = useRef<number>(0);

  // Sync with remote control instructions (view switching, agent selection, action toasts)
  useEffect(() => {
    const rc = liveStatus?.remoteControl;
    if (!rc || !rc.updatedAt || rc.updatedAt <= lastRemoteTimestampRef.current) return;
    lastRemoteTimestampRef.current = rc.updatedAt;

    if (rc.viewMode && rc.viewMode !== viewMode) {
      setViewMode(rc.viewMode);
    }
    if (rc.selectedAgent && rc.selectedAgent !== selectedAgent) {
      setSelectedAgent(rc.selectedAgent);
    }
    if (rc.lastAction?.toast) {
      toast.info(rc.lastAction.toast);
    }
  }, [liveStatus?.remoteControl, viewMode, selectedAgent]);

  // Auto-switch to whichever agent is currently executing (when in single-agent view)
  useEffect(() => {
    if (!autoSwitch || !liveStatus?.agents || viewMode === "meeting") return;
    const runningWorker = WORKER_ORDER.find(
      (id) => liveStatus.agents[id]?.status === "running"
    );
    if (runningWorker && runningWorker !== selectedAgent) {
      setSelectedAgent(runningWorker);
    }
  }, [liveStatus, autoSwitch, selectedAgent, viewMode]);

  const masterBusy = (liveStatus?.activePlanCount || 0) > 0;

  return (
    <div className="h-[calc(100vh-4rem)] p-3 lg:p-4 flex flex-col min-h-0 overflow-hidden">
      {/* Real-time Antigravity Director Command & Control HUD */}
      <LiveControllerHud
        remoteControl={liveStatus?.remoteControl}
        selectedAgent={selectedAgent}
        onSwitchView={(v, ag) => {
          setViewMode(v);
          if (ag && AGENT_ROLES[ag as AgentRoleId]) {
            setSelectedAgent(ag as AgentRoleId);
          }
        }}
        onMessageSent={refreshStatus}
      />

      <div className="flex flex-1 min-h-0 gap-3.5 overflow-hidden">
        {/* Left Vertical Agent Selector Rail */}
        <div className="w-16 sm:w-56 shrink-0 flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-2xs overflow-y-auto">
          {/* Toggles: Auto-Follow + 3D Studio View */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setAutoSwitch((v) => !v)}
              title={
                autoSwitch
                  ? "Auto-switching active view to running agent (click to pause)"
                  : "Auto-switch paused (click to enable)"
              }
              className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                autoSwitch
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    autoSwitch ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <span className="hidden sm:inline">Auto-Follow</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider">
                {autoSwitch ? "ON" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowOffice((v) => !v)}
              title={showOffice ? "Hide 3D Studio to expand chat width" : "Show 3D Studio"}
              className="hidden xl:flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-bold bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>🏢</span>
                <span className="hidden sm:inline">3D Studio</span>
              </span>
              <span className="text-[10px] font-semibold text-blue-600">
                {showOffice ? "Hide" : "Show"}
              </span>
            </button>
          </div>

          {/* 5-Agent Strategy War Room Button */}
          <button
            type="button"
            onClick={() => setViewMode("meeting")}
            className={`w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${
              viewMode === "meeting"
                ? "bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400"
                : "bg-indigo-50/90 text-indigo-950 hover:bg-indigo-100/90 border border-indigo-200/90 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200"
            }`}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-lg">
              🎙️
              <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-xs font-black truncate flex items-center gap-1">
                <span>War Room</span>
                <span className="text-[9px] bg-indigo-200 text-indigo-900 rounded px-1 font-extrabold dark:bg-indigo-700 dark:text-white">
                  5-AGENTS
                </span>
              </div>
              <div
                className={`text-[10px] truncate ${
                  viewMode === "meeting" ? "text-indigo-100" : "text-indigo-600 dark:text-indigo-400"
                }`}
              >
                Round-table strategy
              </div>
            </div>
          </button>

          {/* Creator Studio • Live Google Flow Console Button */}
          <button
            type="button"
            onClick={() => setViewMode("creator-studio")}
            className={`w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${
              viewMode === "creator-studio"
                ? "bg-linear-to-r from-purple-600 via-pink-600 to-purple-700 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400"
                : "bg-purple-50/90 text-purple-950 hover:bg-purple-100/90 border border-purple-200/90 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-200"
            }`}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-lg">
              🎨
              <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-xs font-black truncate flex items-center gap-1">
                <span>Creator Studio</span>
                <span className="text-[9px] bg-purple-200 text-purple-900 rounded px-1 font-extrabold dark:bg-purple-700 dark:text-white">
                  FLOW
                </span>
              </div>
              <div
                className={`text-[10px] truncate ${
                  viewMode === "creator-studio" ? "text-purple-100" : "text-purple-600 dark:text-purple-400"
                }`}
              >
                Direct Google Flow Live
              </div>
            </div>
          </button>

          {/* Highlighted Master Agent Coordinator Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedAgent("master");
              setViewMode("agents");
            }}
            className={`w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${
              selectedAgent === "master" && viewMode === "agents"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "bg-blue-50/70 text-slate-900 hover:bg-blue-100/70 border border-blue-200/70"
            }`}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white/90 border border-white/40 flex items-center justify-center text-lg">
              🧠
              <span
                className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ${
                  masterBusy ? "bg-emerald-400 animate-ping" : "bg-emerald-500"
                }`}
              />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-xs font-extrabold truncate">Master Agent</div>
              <div
                className={`text-[10px] truncate ${
                  selectedAgent === "master" ? "text-blue-100" : "text-blue-700"
                }`}
              >
                {masterBusy ? "Coordinating plan..." : "Team Coordinator"}
              </div>
            </div>
          </button>

          <div className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:block">
            Specialist Agents
          </div>

          {/* 4 Worker Agents */}
          <div className="space-y-1.5">
            {WORKER_ORDER.map((workerId: WorkerRoleId) => {
              const role = AGENT_ROLES[workerId];
              const st = liveStatus?.agents?.[workerId]?.status || "idle";
              const isSelected = selectedAgent === workerId;

              return (
                <button
                  key={workerId}
                  type="button"
                  onClick={() => {
                    setSelectedAgent(workerId);
                    setViewMode("agents");
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl p-2 text-left transition cursor-pointer ${
                    isSelected && viewMode === "agents"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={role.avatar}
                      alt={role.name}
                      className="h-full w-full object-cover object-top"
                    />
                    <span
                      className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ring-1 ring-white ${
                        st === "running"
                          ? "bg-emerald-500 animate-ping"
                          : st === "done"
                          ? "bg-emerald-500"
                          : st === "failed"
                          ? "bg-red-500"
                          : "bg-slate-400"
                      }`}
                    />
                  </div>
                  <div className="hidden sm:block min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">
                        {role.emoji} {role.shortName}
                      </span>
                      {st === "running" && (
                        <span className="text-[9px] font-bold text-emerald-400">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {liveStatus?.agents?.[workerId]?.currentStep ||
                        role.tagline}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Panel: 5-Agent Strategy War Room, Live Creator Studio, or Selected Agent Focus */}
        <div className="flex-1 min-w-0 h-full flex flex-col min-h-0 overflow-hidden">
          {viewMode === "creator-studio" ? (
            <CreatorStudio
              campaignId={campaign.id}
              onAssetImported={refreshStatus}
              onClose={() => setViewMode("agents")}
            />
          ) : viewMode === "meeting" ? (
            <MeetingRoom
              campaignId={campaign.id}
              onPlanCreated={() => {
                refreshStatus();
                setViewMode("agents");
                setSelectedAgent("master");
              }}
            />
          ) : (
            <AgentPanel
              agentId={selectedAgent}
              campaignId={campaign.id}
              liveStatus={liveStatus}
              onStatusRefresh={refreshStatus}
              onOpenCreatorStudio={() => setViewMode("creator-studio")}
            />
          )}
        </div>

        {/* Right Synchronized Interactive Office Preview (hidden in Creator Studio full-immersion view) */}
        {showOffice && viewMode !== "creator-studio" && (
          <div className="hidden xl:flex xl:w-[35%] shrink-0 flex-col h-full min-h-0 overflow-hidden">
            <AgentOffice
              officeKey={campaign.officeImage}
              selectedAgentId={selectedAgent}
              onSelectAgent={(id) => setSelectedAgent(id)}
              liveStatus={liveStatus}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Loading AI Agent Team...
        </div>
      }
    >
      <AgentsWorkspaceInner />
    </Suspense>
  );
}
