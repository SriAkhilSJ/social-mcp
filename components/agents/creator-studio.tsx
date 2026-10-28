"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  ExternalLink,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  Play,
  Monitor,
  Flame,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Layers,
  Sliders,
  Check,
  Columns2,
  Maximize2,
  X,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface CampaignPost {
  id: number;
  title: string;
  status: string;
  hasMedia: boolean;
}

interface FlowStatusData {
  connected: boolean;
  tab?: {
    title: string;
    url: string;
  } | null;
  daemon?: {
    flow?: {
      signedIn?: boolean;
      plan?: string;
      credits_remaining?: number;
      url?: string;
    };
  } | null;
  localAssets?: Array<{
    url: string;
    name: string;
    time: number;
  }>;
  campaignPosts?: CampaignPost[];
  videoEngineMode?: "coding_agent" | "flow_path";
  messages?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "creator";
  text: string;
  dispatchedPrompt?: string;
  time: string;
}

const PRESET_SUGGESTIONS = [
  {
    label: "🎬 Animate with Veo 3.1",
    message: "Animate this scene into a cinematic 9:16 vertical video using Veo 3.1 with slow camera pan and neon rain",
  },
  {
    label: "🌧️ Rain & Sunglasses",
    message: "Make the lighting more dramatic with heavy rain dripping on his dark sunglasses and neon reflections",
  },
  {
    label: "🏢 Boardroom Ambush",
    message: "Create a wide shot of the luxury syndicate boardroom where mob bosses look stunned as the blind man enters",
  },
  {
    label: "👧 Mafia Boss & Daughter",
    message: "Generate an emotional scene of the dangerous mafia boss protecting his young daughter in the penthouse",
  },
];

export function CreatorStudio({
  campaignId,
  onAssetImported,
  onClose,
}: {
  campaignId: number;
  onAssetImported?: () => void;
  onClose?: () => void;
}) {
  const [data, setData] = useState<FlowStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [isPerforming, setIsPerforming] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number>(38);
  const [videoMode, setVideoMode] = useState<"coding_agent" | "flow_path">("flow_path");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [splitPercent, setSplitPercent] = useState<number>(46);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const [compactTab, setCompactTab] = useState<"chat" | "browser">("chat");

  // Generated Media Assets Dropdown & Modal State
  const [showAssetsDialog, setShowAssetsDialog] = useState(false);
  const [dismissedAssets, setDismissedAssets] = useState<string[]>([]);

  const visibleAssets = (data?.localAssets || []).filter(
    (a) => !dismissedAssets.includes(a.name)
  );

  const handleDismissAsset = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedAssets((prev) => [...prev, name]);
    toast.info(`Removed "${name}" from view`);
  };

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  // ResizeObserver to detect layout width and adapt accordingly
  useEffect(() => {
    if (!studioContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(studioContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Draggable Splitter Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!studioContainerRef.current) return;
      const rect = studioContainerRef.current.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const newPercent = Math.min(78, Math.max(22, (relativeX / rect.width) * 100));
      setSplitPercent(Math.round(newPercent));
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "creator",
      text: "🎨 Welcome to the Studio! I am directly commanding your live Google Flow workspace on the right. You can give me suggestions or creative directives through this chat, and I'll execute them live in the browser preview.",
      time: "Just now",
    },
  ]);

  async function loadFlowStatus() {
    try {
      const res = await fetch("/api/flow");
      if (!res.ok) throw new Error("Could not check Flow");
      const d: FlowStatusData = await res.json();
      setData(d);
      if (d.videoEngineMode) {
        setVideoMode(d.videoEngineMode);
      }
      if (d.messages && d.messages.length > 0) {
        setMessages(d.messages);
      }
      if (d.campaignPosts && d.campaignPosts.length > 0) {
        setSelectedPostId((current) => {
          const exists = d.campaignPosts?.some((p) => p.id === current);
          return exists ? current : d.campaignPosts![0].id;
        });
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSetVideoMode(mode: "coding_agent" | "flow_path") {
    setVideoMode(mode);
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-video-mode", mode }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || "Could not set video mode");
      toast.success(
        mode === "coding_agent"
          ? "Option 1 Active: Video generation by coding agents (Recommended) - Flow bypassed by coding agents."
          : "Option 2 Active: Flow path (Google Flow browser session)."
      );
      void loadFlowStatus();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not switch video mode");
    }
  }

  // Refresh status and stream frame regularly
  useEffect(() => {
    void loadFlowStatus();
    const statusInterval = setInterval(loadFlowStatus, 2000);
    const streamInterval = setInterval(() => {
      setPreviewNonce(Date.now());
    }, 2000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(streamInterval);
    };
  }, []);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isPerforming]);

  async function handleSendSuggestion(suggestText?: string) {
    const textToSend = suggestText || inputMessage;
    if (!textToSend.trim() || isPerforming) return;

    const userMsgId = `u-${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: textToSend,
        time: timeStr,
      },
    ]);

    setInputMessage("");
    setIsPerforming(true);
    setActiveStep("Analyzing directive & tuning camera parameters...");

    try {
      // Simulate step 1
      await new Promise((r) => setTimeout(r, 600));
      setActiveStep("Dispatching instruction to Google Flow via Chrome CDP...");

      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", message: textToSend }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || "Execution failed");

      setActiveStep("Live canvas rendering in progress on Google Flow...");

      // 2. Add creator response
      setMessages((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          sender: "creator",
          text: resJson.reply || "Directive dispatched to Google Flow!",
          dispatchedPrompt: resJson.prompt,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      toast.success("Directive sent! Google Flow is rendering live.");

      // Refresh preview frame and status
      setPreviewNonce(Date.now());
      void loadFlowStatus();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not instruct Creator Agent");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "creator",
          text: `⚠️ Error executing directive: ${(err as Error).message}`,
          time: timeStr,
        },
      ]);
    } finally {
      setIsPerforming(false);
      setActiveStep(null);
    }
  }

  async function handleImportAsset(assetUrl: string) {
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-to-post",
          mediaUrl: assetUrl,
          postId: selectedPostId,
        }),
      });
      if (!res.ok) throw new Error("Failed to link asset");
      const postName =
        data?.campaignPosts?.find((p) => p.id === selectedPostId)?.title ||
        `Post #${selectedPostId}`;
      toast.success(`Visual attached to "${postName}"!`);
      onAssetImported?.();
      void loadFlowStatus();
    } catch {
      toast.error("Could not import asset");
    }
  }

  const isCompact = containerWidth < 768;

  return (
    <div
      ref={studioContainerRef}
      className="flex flex-col h-full w-full rounded-2xl border border-slate-200/90 bg-white shadow-xl overflow-hidden dark:bg-slate-950 dark:border-slate-800"
    >
      {/* Executive Studio Top Bar */}
      <div className="shrink-0 border-b border-slate-800 bg-linear-to-r from-slate-950 via-purple-950 to-slate-950 px-4 py-2.5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 text-base shadow-inner">
              🎨
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate text-white">
                  Creator Studio
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-purple-500/20 border border-purple-400/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                  <Sparkles className="h-2.5 w-2.5 text-purple-300" />
                  Veo 3.1 & Nano Banana
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold border flex items-center gap-1 shrink-0 ${
                    data?.connected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      data?.connected
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  />
                  {data?.connected ? "FLOW LIVE" : "CONNECTING"}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 truncate">
                {data?.tab?.title || "Connecting to Google Flow workspace..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Generated Assets Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setShowAssetsDialog((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-400/50 bg-linear-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              title="Open Generated Assets Dropdown Dialog"
            >
              <Film className="h-3.5 w-3.5 text-purple-300" />
              <span className="hidden sm:inline">Generated Assets</span>
              <span className="rounded-full bg-purple-400/40 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                {visibleAssets.length}
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showAssetsDialog ? "rotate-180" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setPreviewNonce(Date.now());
                void loadFlowStatus();
              }}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/20 transition cursor-pointer"
              title="Refresh Flow live status"
            >
              <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {data?.tab?.url && (
              <a
                href={data.tab.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg bg-linear-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                <span>Open in Chrome</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
                title="Exit Creator Studio"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Coding Agent Video Generation Options Selector & Layout Presets */}
      <div className="shrink-0 px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[11px] uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
            <Sliders className="h-3 w-3" /> Options:
          </span>
          <span className="text-[10px] text-slate-400 hidden lg:inline">
            {videoMode === "coding_agent"
              ? "🛡️ Coding agents generate directly via API/SDK (Flow browser bypassed)"
              : "🌐 Studio Flow browser session active"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Option 1: Video generation by coding agents (Recommended) */}
          <button
            type="button"
            onClick={() => void handleSetVideoMode("coding_agent")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              videoMode === "coding_agent"
                ? "bg-purple-600 text-white shadow-xs ring-1 ring-purple-400"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>⚡ 1. Coding Agents Video</span>
            <span className="rounded bg-emerald-500/20 text-emerald-300 px-1 py-0.2 text-[8.5px] font-black uppercase tracking-wide border border-emerald-500/30">
              Recommended
            </span>
          </button>

          {/* Option 2: Flow path */}
          <button
            type="button"
            onClick={() => void handleSetVideoMode("flow_path")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              videoMode === "flow_path"
                ? "bg-purple-600 text-white shadow-xs ring-1 ring-purple-400"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🌐 2. Flow Path</span>
          </button>

          {/* Layout Resizing Preset Buttons */}
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-800 text-[10px] font-semibold text-slate-400">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 mr-0.5">Layout:</span>
            <button
              type="button"
              onClick={() => setSplitPercent(60)}
              title="Focus Chat (60% Chat / 40% Browser)"
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                splitPercent === 60 ? "bg-slate-700 text-white font-bold" : "hover:text-slate-200"
              }`}
            >
              ◨ Chat 60%
            </button>
            <button
              type="button"
              onClick={() => setSplitPercent(50)}
              title="Balanced 50/50 Split"
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                splitPercent === 50 ? "bg-slate-700 text-white font-bold" : "hover:text-slate-200"
              }`}
            >
              ◫ 50:50
            </button>
            <button
              type="button"
              onClick={() => setSplitPercent(35)}
              title="Focus Browser (35% Chat / 65% Browser)"
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                splitPercent === 35 ? "bg-slate-700 text-white font-bold" : "hover:text-slate-200"
              }`}
            >
              ◧ Browser 65%
            </button>
          </div>
        </div>
      </div>

      {/* Narrow Viewport / Mobile Layout Tabs (Visible when width < 768px) */}
      {isCompact && (
        <div className="shrink-0 flex items-center bg-slate-900 border-b border-slate-800 p-1">
          <button
            type="button"
            onClick={() => setCompactTab("chat")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              compactTab === "chat"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🎨</span>
            <span>Creator Agent Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setCompactTab("browser")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              compactTab === "browser"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🌐</span>
            <span>Google Flow Browser</span>
          </button>
        </div>
      )}

      {/* Main Studio Workstation (Resizable & Responsive) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative select-none">
        {/* LEFT COLUMN: Creator Agent Performing Task & Conversational Suggestion Chat */}
        {(!isCompact || compactTab === "chat") && (
          <div
            style={{ width: isCompact ? "100%" : `${splitPercent}%` }}
            className="flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-900/40 shrink-0 h-full border-r border-slate-200 dark:border-slate-800"
          >
            {/* Agent Status Banner */}
            <div className="shrink-0 p-3 border-b border-slate-200/80 bg-white flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-9 w-9 shrink-0 rounded-xl overflow-hidden border border-purple-200 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-800">
                  <img
                    src="/avatars/creator.png"
                    alt="Creator Agent"
                    className="h-full w-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-lg">
                    🎨
                  </span>
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ${
                      isPerforming ? "bg-emerald-400 animate-ping" : "bg-emerald-500"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      Creator Agent
                    </h2>
                    <span className="rounded bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.2 dark:bg-purple-900/60 dark:text-purple-300">
                      DIRECTOR
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Instructing Google Flow Live • Veo 3.1
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                    isPerforming
                      ? "bg-purple-100 text-purple-700 animate-pulse dark:bg-purple-950/70 dark:text-purple-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  {isPerforming ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>PERFORMING TASK</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      <span>READY FOR DIRECTIVE</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Active Task Progress Banner (when active) */}
            {activeStep && (
              <div className="shrink-0 px-3 py-2 bg-linear-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border-b border-purple-200/60 dark:border-purple-900/40 flex items-center gap-2 text-xs font-semibold text-purple-800 dark:text-purple-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                <span className="truncate">{activeStep}</span>
              </div>
            )}

            {/* Suggestion & Directive Chat Stream */}
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 items-start ${
                    msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-xs ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                    }`}
                  >
                    {msg.sender === "user" ? "👤" : "🎨"}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-tr-xs"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span
                        className={`text-[10px] font-bold ${
                          msg.sender === "user" ? "text-blue-100" : "text-purple-700 dark:text-purple-300"
                        }`}
                      >
                        {msg.sender === "user" ? "You (Creative Director)" : "Creator Agent"}
                      </span>
                      <span
                        className={`text-[9px] ${
                          msg.sender === "user" ? "text-blue-200" : "text-slate-400"
                        }`}
                      >
                        {msg.time}
                      </span>
                    </div>

                    <p className="leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>

                    {/* Dispatched Prompt Chip */}
                    {msg.dispatchedPrompt && (
                      <div className="mt-2 pt-2 border-t border-purple-100 dark:border-slate-700 text-[10px]">
                        <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mb-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Dispatched to Google Flow:
                        </div>
                        <div className="italic text-slate-600 bg-slate-50 rounded-md p-1.5 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-mono text-[9.5px]">
                          "{msg.dispatchedPrompt}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isPerforming && (
                <div className="flex gap-2.5 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-800 text-xs font-bold">
                    🎨
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-white p-3 border border-purple-200 shadow-xs dark:bg-slate-800/80 dark:border-purple-800">
                    <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 font-semibold">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                      <span>Creator Agent is instructing Google Flow in Chrome...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Creative Suggestion Pills */}
            <div className="shrink-0 px-3 py-2 bg-slate-100/70 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto dark:bg-slate-900 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Flame className="h-3 w-3 text-purple-500" /> Suggest:
              </span>
              {PRESET_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSendSuggestion(item.message)}
                  disabled={isPerforming}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:text-purple-700 transition whitespace-nowrap cursor-pointer disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-purple-500"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Chat Composer Input */}
            <div className="shrink-0 p-3 border-t border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendSuggestion();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Suggest to Creator Agent (e.g. 'Make the lighting moodier with rain on sunglasses')..."
                  disabled={isPerforming}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isPerforming}
                  className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  {isPerforming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Suggest</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Interactive Draggable Splitter Handle */}
        {!isCompact && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setSplitPercent(50)}
            className={`relative z-20 w-2.5 hover:w-3 shrink-0 bg-slate-200 dark:bg-slate-800 hover:bg-purple-600 transition-colors cursor-col-resize flex items-center justify-center select-none group ${
              isDragging ? "bg-purple-600 w-3 ring-2 ring-purple-400/50" : ""
            }`}
            title="Drag left/right to resize layout (Double-click to reset 50/50)"
          >
            <div className="flex flex-col gap-1 items-center py-2">
              <span className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
              <span className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
              <span className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Real-Time Live Browser Preview of Google Flow */}
        {(!isCompact || compactTab === "browser") && (
          <div
            style={{ width: isCompact ? "100%" : `${100 - splitPercent}%` }}
            className="flex flex-col min-w-0 bg-slate-950 text-slate-100 shrink-0 h-full"
          >
            {/* Browser Top Chrome Mockup */}
            <div className="shrink-0 px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
              {/* Window Controls & Address Bar */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>

                <div className="flex items-center gap-1 text-slate-400 shrink-0 ml-1">
                  <ArrowLeft className="h-3 w-3 opacity-60" />
                  <ArrowRight className="h-3 w-3 opacity-60" />
                  <button
                    type="button"
                    onClick={() => setPreviewNonce(Date.now())}
                    className="hover:text-white transition cursor-pointer p-0.5"
                    title="Refresh Browser Stream"
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                </div>

                {/* URL Address Bar */}
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 py-1 text-[11px] font-mono text-slate-300 flex-1 min-w-0 border border-slate-800">
                  <span className="text-emerald-400 text-xs">🔒</span>
                  <span className="truncate">
                    {data?.tab?.url || "https://flow.google.com/project"}
                  </span>
                </div>
              </div>

              {/* Stream Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="hidden sm:inline">LIVE BROWSER PREVIEW</span>
                  <span className="sm:hidden">LIVE</span>
                </span>
              </div>
            </div>

            {/* Browser Viewport with Live CDP Frame */}
            <div className="relative flex-1 min-h-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden group">
              {/* Live Captured Screen from Google Flow */}
              <img
                src={`/api/flow/preview?t=${previewNonce}`}
                alt="Google Flow Live Viewport"
                className="h-full w-full object-contain bg-slate-950"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              {/* Floating Live Indicator Corner */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-lg bg-slate-900/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-slate-200 border border-slate-700 shadow-md">
                <Monitor className="h-3 w-3 text-purple-400" />
                <span>Chrome CDP :9333</span>
              </div>
            </div>

            {/* Sleek Bottom Control Bar with Dropdown Dialog Trigger */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAssetsDialog(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 text-purple-200 border border-purple-500/40 px-2.5 py-1 text-xs font-bold transition cursor-pointer"
                >
                  <Film className="h-3.5 w-3.5 text-purple-400" />
                  <span>Generated Assets ({visibleAssets.length})</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Click to open dropdown dialog to inspect video reels & anime artwork
                </span>
              </div>

              {data?.campaignPosts && data.campaignPosts.length > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Target Post:
                  </span>
                  <select
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-slate-200 focus:outline-none"
                  >
                    {data.campaignPosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        Post #{p.id}: {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dropdown Modal Dialog Box: Generated Media Assets with Two Cross-Out Marks */}
      {showAssetsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
            {/* Dialog Header with Cross Mark 1 */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Film className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Generated Media Assets</span>
                    <span className="rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold px-2 py-0.5 border border-purple-500/30">
                      {visibleAssets.length} Available
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review generated 9:16 anime video reels and character concept art. Click any asset to attach to your post.
                  </p>
                </div>
              </div>

              {/* Cross Mark 1: Prominent Top-Right Close Button */}
              <button
                type="button"
                onClick={() => setShowAssetsDialog(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                title="Close dialog (Cross Mark 1)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target Post Selection Bar */}
            {data?.campaignPosts && data.campaignPosts.length > 0 && (
              <div className="bg-slate-950/70 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-300">Target Post for 1-Click Attach:</span>
                  <select
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(Number(e.target.value))}
                    className="rounded-lg border border-purple-500/40 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
                  >
                    {data.campaignPosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        Post #{p.id}: {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-slate-400">
                  Attaching updates the post instantly across the entire platform
                </span>
              </div>
            )}

            {/* Asset Grid with Video Players & Artwork */}
            <div className="flex-1 overflow-y-auto p-5">
              {visibleAssets.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Film className="h-10 w-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-400">No media assets in view</p>
                  <p className="text-xs text-slate-500">
                    Instruct Creator Agent in the chat to generate a new anime video reel or concept art.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {visibleAssets.map((asset, idx) => {
                    const isVideo = asset.name.endsWith(".mp4");
                    return (
                      <div
                        key={idx}
                        className="relative group flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md hover:border-purple-500/50 transition"
                      >
                        {/* Per-Card Cross-out Mark to remove unwanted assets from view */}
                        <button
                          type="button"
                          onClick={(e) => handleDismissAsset(asset.name, e)}
                          className="absolute top-2 right-2 z-10 rounded-full bg-black/75 p-1 text-slate-400 hover:text-rose-400 hover:bg-black transition cursor-pointer"
                          title="Cross out / remove from view"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>

                        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                          {isVideo ? (
                            <video
                              src={asset.url}
                              controls
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <img
                              src={asset.url}
                              alt={asset.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition"
                            />
                          )}
                          <span className="absolute bottom-2 left-2 rounded-md bg-black/80 backdrop-blur px-2 py-0.5 text-[9px] font-bold text-white border border-white/10">
                            {isVideo ? "🎥 9:16 Video Reel (45s)" : "🎨 Anime Artwork"}
                          </span>
                        </div>

                        <div className="p-3 flex flex-col justify-between gap-2 flex-1">
                          <div>
                            <div className="text-xs font-semibold text-slate-200 truncate" title={asset.name}>
                              {asset.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(asset.time).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleImportAsset(asset.url)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 shadow-sm transition cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Attach to Post #{selectedPostId}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dialog Footer with Cross Mark 2 */}
            <div className="border-t border-slate-800 bg-slate-950 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                You can attach any video reel or image directly to Facebook & social posts.
              </span>

              {/* Cross Mark 2: Bottom Close Button */}
              <button
                type="button"
                onClick={() => setShowAssetsDialog(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close Dialog</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
