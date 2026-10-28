"use client";

import { useState } from "react";
import {
  Maximize2,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AGENT_ROLES } from "@/lib/agent-roles";
import type { SandboxView } from "@/lib/sandbox";

export function ComputerPanel({
  agentId,
  sandbox,
  onUpdated,
}: {
  agentId: "research" | "creator";
  sandbox?: SandboxView;
  onUpdated?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const role = AGENT_ROLES[agentId];
  const state = sandbox?.status || "none";
  const inUserControl = sandbox?.control === "user";

  async function runSandboxAction(
    action: "start" | "pause" | "take-over" | "hand-back"
  ) {
    setBusy(action);
    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sandbox action failed");
      setPreviewNonce((n) => n + 1);
      onUpdated?.();
      if (action === "take-over") {
        setViewerOpen(true);
        toast.success(`You now control ${role.name}'s Cloud Desktop`);
      } else if (action === "hand-back") {
        toast.success(`Handed control back to ${role.name}`);
      } else if (action === "start") {
        toast.success(`${role.name} Cloud Desktop started`);
      } else if (action === "pause") {
        toast.success(`${role.name} Cloud Desktop paused`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update desktop");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-white">
              {role.name} — Cloud Linux Desktop
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                state === "running"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : state === "paused"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {inUserControl ? "User In Control" : state.toUpperCase()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" />
            Big Screen
          </button>
        </div>

        <div
          onClick={() => setViewerOpen(true)}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden bg-slate-900 group"
        >
          <img
            src={`/api/sandbox/preview?agent=${agentId}&t=${previewNonce}`}
            alt={`${role.name} Desktop Preview`}
            className="h-full w-full object-cover transition group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="rounded-xl bg-white/95 px-4 py-2 text-xs font-bold text-slate-900 shadow-lg">
              Click to Open Full Cloud Desktop
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {state !== "running" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runSandboxAction("start")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                Start VM
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runSandboxAction("pause")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </button>
            )}

            {inUserControl ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runSandboxAction("hand-back")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Done — Hand Back to Agent
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runSandboxAction("take-over")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                Take Over / Login
              </button>
            )}
          </div>

          <span className="text-[11px] text-slate-400">
            Auto-pauses after 3m idle
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <span>
          <strong>Zero-credential exposure:</strong> When a platform asks to sign in,
          click <strong>Take Over / Login</strong> to enter credentials directly inside the
          isolated cloud VM. Agents never see or store your passwords.
        </span>
      </div>

      {viewerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{role.emoji}</span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {role.name} — Live E2B Cloud Computer (1280×800)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Passwords typed here go straight into the sandbox browser — never through chat.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inUserControl ? (
                  <button
                    type="button"
                    onClick={() => runSandboxAction("hand-back")}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Done (Resume Agent)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => runSandboxAction("take-over")}
                    className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Take Over Control
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="aspect-[16/10] w-full bg-slate-900">
              <img
                src={`/api/sandbox/preview?agent=${agentId}&t=${previewNonce}`}
                alt="Cloud Desktop Stream"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamComputers({
  sandboxes,
  onUpdated,
}: {
  sandboxes?: SandboxView[];
  onUpdated?: () => void;
}) {
  const researchSbx = sandboxes?.find((s) => s.agentId === "research");
  const creatorSbx = sandboxes?.find((s) => s.agentId === "creator");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ComputerPanel
        agentId="research"
        sandbox={researchSbx}
        onUpdated={onUpdated}
      />
      <ComputerPanel
        agentId="creator"
        sandbox={creatorSbx}
        onUpdated={onUpdated}
      />
    </div>
  );
}
