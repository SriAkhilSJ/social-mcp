"use client";

import { useState } from "react";
import {
  Crop,
  Eraser,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  SunMedium,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

type AspectOption = "1:1" | "4:5" | "9:16" | "16:9";

export function ImageKitEditorModal({
  imageUrl,
  onClose,
  onApply,
}: {
  imageUrl: string;
  onClose: () => void;
  onApply: (newUrl: string) => void;
}) {
  const [history, setHistory] = useState<string[]>([imageUrl]);
  const [busy, setBusy] = useState<string | null>(null);
  const [bgPrompt, setBgPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  const currentUrl = history[history.length - 1];

  async function runTransform(
    label: string,
    edit: {
      kind:
        | "bgremove"
        | "upscale"
        | "retouch"
        | "dropshadow"
        | "changebg"
        | "edit"
        | "crop";
      prompt?: string;
      aspect?: AspectOption;
    }
  ) {
    setBusy(label);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transform",
          url: currentUrl,
          edits: [edit],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transformation failed");
      setHistory((prev) => [...prev, data.url]);
      toast.success(`Applied ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not edit image");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                ImageKit AI Studio — Edit Image
              </h3>
              <p className="text-[11px] text-slate-500">
                Apply AI background removal, upscaling, retouching, smart crops, or generative edits
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Workspace */}
        <div className="grid flex-1 min-h-0 overflow-y-auto md:grid-cols-12">
          {/* Preview Canvas */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-950 p-6 relative min-h-[320px]">
            <img
              src={currentUrl}
              alt="Editing preview"
              className="max-h-[420px] w-auto rounded-2xl object-contain shadow-xl"
            />
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-xs text-white">
                <Loader2 className="h-7 w-7 animate-spin text-blue-400 mb-2" />
                <span className="text-xs font-bold">Applying {busy}...</span>
              </div>
            )}
          </div>

          {/* AI Controls */}
          <div className="md:col-span-5 p-5 space-y-5 border-l border-slate-100 overflow-y-auto">
            {/* One-Click AI Enhancements */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                1-Click AI Enhancements
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    runTransform("Remove Background", { kind: "bgremove" })
                  }
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <Eraser className="h-3.5 w-3.5 text-blue-600" />
                  Remove BG
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runTransform("AI Upscale", { kind: "upscale" })}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5 text-violet-600" />
                  AI Upscale
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runTransform("AI Retouch", { kind: "retouch" })}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <SunMedium className="h-3.5 w-3.5 text-amber-600" />
                  AI Retouch
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    runTransform("Drop Shadow", { kind: "dropshadow" })
                  }
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-emerald-600" />
                  Drop Shadow
                </button>
              </div>
            </div>

            {/* Smart Platform Aspect Crops */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                <Crop className="inline h-3 w-3 mr-1 -mt-0.5" />
                Smart Platform Crop (`fo-auto`)
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["1:1", "4:5", "9:16", "16:9"] as AspectOption[]).map((asp) => (
                  <button
                    key={asp}
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      runTransform(`Crop ${asp}`, { kind: "crop", aspect: asp })
                    }
                    className="rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer"
                  >
                    {asp}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Change Background */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Change Background with Prompt
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={bgPrompt}
                  onChange={(e) => setBgPrompt(e.target.value)}
                  placeholder="e.g. Cozy wooden cafe table at sunrise"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busy !== null || !bgPrompt.trim()}
                  onClick={() => {
                    void runTransform("Change Background", {
                      kind: "changebg",
                      prompt: bgPrompt.trim(),
                    });
                    setBgPrompt("");
                  }}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Generative AI Edit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Generative AI Edit (`e-edit-prompt`)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Add warm golden steam & latte art"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busy !== null || !editPrompt.trim()}
                  onClick={() => {
                    void runTransform("Generative Edit", {
                      kind: "edit",
                      prompt: editPrompt.trim(),
                    });
                    setEditPrompt("");
                  }}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <button
            type="button"
            disabled={history.length <= 1 || busy !== null}
            onClick={() => setHistory((prev) => prev.slice(0, -1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo ({history.length - 1})
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                onApply(currentUrl);
                onClose();
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              Use Edited Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
