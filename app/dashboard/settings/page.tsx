"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Brain,
  Building2,
  Check,
  KeyRound,
  Loader2,
  Pin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { CAMPAIGN_ICONS } from "@/components/campaign-icon";
import {
  PLATFORMS,
  PRIMARY_PLATFORM_IDS,
  type PlatformId,
} from "@/lib/social/platforms";

interface MemoryItem {
  id: number;
  agentId: string;
  kind: string;
  content: string;
  pinned: boolean;
}

interface IntegrationSummary {
  provider: string;
  keyHint: string;
  endpointUrl: string | null;
  model?: string | null;
  accountsCount: number;
}

const KEY_PROVIDERS = [
  {
    id: "flow_mcp",
    title: "Google Flow Video MCP (45,000 Credits — Veo 3.1 / Omni Flash)",
    subtitle:
      "Connects your local Google Flow MCP daemon (start-flow-mcp.bat) to generate 9:16 & 16:9 Veo 3.1 / Omni Flash videos using your 45,000 Flow credits",
    placeholder: "Paste ~/.flow-mcp/token (or enter 'demo')",
    hasEndpoint: true,
    endpointPlaceholder: "http://127.0.0.1:8787 (default flow-mcp port)",
  },
  {
    id: "openai_compatible",
    title: "OpenAI-Compatible Custom LLM (Ollama, DeepSeek, vLLM, LM Studio)",
    subtitle:
      "Connects any local or cloud OpenAI-compatible inference endpoint for AI agent planning & generation",
    placeholder: "API Key (or enter 'not-needed' / 'ollama' for local models)",
    hasEndpoint: true,
    endpointPlaceholder: "Endpoint: http://localhost:11434/v1 or https://api.deepseek.com/v1",
    hasModel: true,
    modelPlaceholder: "Model ID: e.g. deepseek-chat, llama3, qwen2.5, mistral",
  },
  {
    id: "facebook",
    title: "Facebook Pages Direct (Meta Graph API v25.0)",
    subtitle:
      "Publishes & schedules Facebook Page posts, photos & Reels directly via Meta Graph API (or enter 'demo' to test)",
    placeholder: "EAAB... Meta Page or User Access Token (or 'demo')",
    hasEndpoint: true,
    endpointPlaceholder:
      "Optional Facebook Page ID (leave blank to auto-discover /me/accounts)",
  },
  {
    id: "blotato",
    title: "Blotato MCP API Key",
    subtitle:
      "Publishes & syncs Instagram, Facebook, TikTok, YouTube, X & LinkedIn via https://mcp.blotato.com/mcp",
    placeholder: "blt_live_... (or enter 'demo' to test locally)",
  },
  {
    id: "openai",
    title: "OpenAI API Key (@openai/agents)",
    subtitle: "Powers Master Agent planning & multi-agent tool orchestration",
    placeholder: "sk-proj-...",
  },
  {
    id: "gemini",
    title: "Google Gemini API Key (Google AI Pro / Studio)",
    subtitle:
      "Powers Creator Agent image generation (gemini-2.5-flash-image) & Veo API fallback",
    placeholder: "AIzaSy...",
  },
  {
    id: "imagekit",
    title: "ImageKit Private Key",
    subtitle:
      "Powers cloud media uploads & AI transformations (bgremove, upscale, retouch)",
    placeholder: "private_...",
    hasEndpoint: true,
    endpointPlaceholder: "https://ik.imagekit.io/your_id",
  },
  {
    id: "e2b",
    title: "E2B Desktop API Key",
    subtitle: "Spawns live Linux cloud desktops for Research & Creator agents",
    placeholder: "e2b_...",
  },
  {
    id: "openpost",
    title: "OpenPost Self-Hosted MCP Key (Docker :8080)",
    subtitle:
      "Connect self-hosted OpenPost MCP (supports META_APP_ID Facebook, Instagram, YouTube, LinkedIn & X)",
    placeholder: "op_...",
    hasEndpoint: true,
    endpointPlaceholder: "http://localhost:8080/mcp",
  },
];

function SettingsInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const { campaign, profile, refreshCampaignData } = useDashboard();

  const [tab, setTab] = useState<"campaign" | "brief" | "integrations">(
    initialTab === "brief" || initialTab === "integrations"
      ? initialTab
      : "campaign"
  );

  useEffect(() => {
    if (
      initialTab === "campaign" ||
      initialTab === "brief" ||
      initialTab === "integrations"
    ) {
      setTab(initialTab);
    }
  }, [initialTab]);

  // Tab 1: Campaign & Office State
  const [campName, setCampName] = useState(campaign.name);
  const [campIcon, setCampIcon] = useState(campaign.icon || "rocket");
  const [officeTheme, setOfficeTheme] = useState(
    campaign.officeImage?.includes("modern") ? "modern-office" : "wooden-office"
  );
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Tab 2: Brand Brief & Memories State
  const [brandName, setBrandName] = useState(profile?.brandName || campaign.name);
  const [description, setDescription] = useState(profile?.description || "");
  const [voice, setVoice] = useState(
    profile?.voice || "Friendly, authentic, and high-signal"
  );
  const [audience, setAudience] = useState(profile?.audience || "");
  const [goals, setGoals] = useState(profile?.goals || "");
  const [platforms, setPlatforms] = useState<string[]>(
    profile?.platforms || ["instagram", "tiktok", "youtube"]
  );
  const [timeZone, setTimeZone] = useState(profile?.timeZone || "UTC");
  const [dosText, setDosText] = useState((profile?.dos || []).join("\n"));
  const [dontsText, setDontsText] = useState((profile?.donts || []).join("\n"));
  const [savingBrief, setSavingBrief] = useState(false);

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [newMemoryKind, setNewMemoryKind] = useState("preference");

  // Tab 3: Encrypted Integrations State
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [endpointInputs, setEndpointInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const loadFullCampaignAndIntegrations = useCallback(async () => {
    const [cRes, iRes] = await Promise.all([
      fetch("/api/campaigns", { cache: "no-store" }),
      fetch("/api/integrations", { cache: "no-store" }),
    ]);
    if (cRes.ok) {
      const cData = await cRes.json();
      setMemories(cData.memories || []);
    }
    if (iRes.ok) {
      const iData = await iRes.json();
      const list = iData.integrations || [];
      setIntegrations(list);
      setEndpointInputs((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (item.endpointUrl && !next[item.provider]) {
            next[item.provider] = item.endpointUrl;
          }
        }
        return next;
      });
      setModelInputs((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (item.model && !next[item.provider]) {
            next[item.provider] = item.model;
          }
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    setCampName(campaign.name);
    setCampIcon(campaign.icon || "rocket");
    setOfficeTheme(
      campaign.officeImage?.includes("modern") ? "modern-office" : "wooden-office"
    );
    void loadFullCampaignAndIntegrations();
  }, [campaign, loadFullCampaignAndIntegrations]);

  async function handleSaveCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSavingCampaign(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-campaign",
          name: campName,
          icon: campIcon,
          officeImage: officeTheme,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshCampaignData();
      toast.success("Updated Campaign & AI Agent Office!");
    } catch {
      toast.error("Could not update campaign");
    } finally {
      setSavingCampaign(false);
    }
  }

  async function handleSaveBrief(e: React.FormEvent) {
    e.preventDefault();
    setSavingBrief(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-brief",
          brandName,
          description,
          voice,
          audience,
          goals,
          platforms,
          timeZone,
          dos: dosText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          donts: dontsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshCampaignData();
      toast.success("Saved Campaign Brand Brief for all 5 AI agents!");
    } catch {
      toast.error("Could not save brand brief");
    } finally {
      setSavingBrief(false);
    }
  }

  async function handleAddMemory() {
    if (!newMemory.trim()) return;
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-memory",
        content: newMemory.trim(),
        kind: newMemoryKind,
        pinned: true,
      }),
    });
    if (res.ok) {
      setNewMemory("");
      await loadFullCampaignAndIntegrations();
      toast.success("Pinned team memory");
    }
  }

  async function handleTogglePin(id: number) {
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-pin-memory", id }),
    });
    await loadFullCampaignAndIntegrations();
  }

  async function handleDeleteMemory(id: number) {
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-memory", id }),
    });
    await loadFullCampaignAndIntegrations();
  }

  async function handleSaveKey(provider: string) {
    const rawKey = (keyInputs[provider] || "").trim();
    const apiKey =
      rawKey ||
      (provider === "openai_compatible" || provider === "flow_mcp"
        ? "not-needed"
        : "");
    if (!apiKey) {
      toast.error("Enter an API key or token first");
      return;
    }
    setSavingProvider(provider);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          provider,
          apiKey,
          endpointUrl: endpointInputs[provider] || undefined,
          model: modelInputs[provider] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      setIntegrations(data.integrations || []);
      if (data.warning) {
        toast.info(data.warning);
      } else {
        toast.success(`Encrypted & saved ${provider.toUpperCase()} key!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save key");
    } finally {
      setSavingProvider(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setTab("campaign")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "campaign"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Campaign & Office
        </button>

        <button
          type="button"
          onClick={() => setTab("brief")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "brief"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Brain className="h-3.5 w-3.5" />
          Brand Brief & Team Memory
        </button>

        <button
          type="button"
          onClick={() => setTab("integrations")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "integrations"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Integrations & MCP Keys
        </button>
      </div>

      {/* TAB 1: Campaign & Office */}
      {tab === "campaign" && (
        <form
          onSubmit={handleSaveCampaign}
          className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-6"
        >
          <div>
            <label className="block text-xs font-extrabold text-slate-900 mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              className="w-full max-w-md rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-900 mb-2">
              Campaign Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_ICONS.map((item) => {
                const IconComp = item.icon;
                const active = campIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCampIcon(item.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition cursor-pointer ${
                      active
                        ? "border-blue-600 ring-2 ring-blue-500/30 " +
                          item.bg +
                          " " +
                          item.fg
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <IconComp className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-900 mb-2.5">
              AI Agent Office Studio Theme
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  id: "wooden-office",
                  label: "Wooden Studio Office",
                  img: "/offices/wooden-office.webp",
                },
                {
                  id: "modern-office",
                  label: "Modern Creative Office",
                  img: "/offices/modern-office.webp",
                },
              ].map((opt) => {
                const selected = officeTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOfficeTheme(opt.id)}
                    className={`overflow-hidden rounded-2xl border-2 text-left transition cursor-pointer ${
                      selected
                        ? "border-blue-600 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <img
                      src={opt.img}
                      alt={opt.label}
                      className="aspect-[3/2] w-full object-cover"
                    />
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <span className="text-xs font-bold text-slate-900">
                        {opt.label}
                      </span>
                      {selected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingCampaign}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {savingCampaign ? "Saving..." : "Save Campaign Settings"}
          </button>
        </form>
      )}

      {/* TAB 2: Brand Brief & Shared Team Memory */}
      {tab === "brief" && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveBrief}
            className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Campaign Brand Brief (Injected into All 5 Agents)
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Brand / Product Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Brand Voice & Tone
                </label>
                <input
                  type="text"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  placeholder="Warm, witty, craft-obsessed..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                What does your brand offer?
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product, launch offer, or mission..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Specialty coffee lovers & remote creatives"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Campaign Goal
                </label>
                <input
                  type="text"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Drive opening week foot traffic & followers"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Default Target Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_PLATFORM_IDS.map((pid: PlatformId) => {
                  const selected = platforms.includes(pid);
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() =>
                        setPlatforms((prev) =>
                          prev.includes(pid)
                            ? prev.length > 1
                              ? prev.filter((p) => p !== pid)
                              : prev
                            : [...prev, pid]
                        )
                      }
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {PLATFORMS[pid].name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Do&apos;s (one per line)
                </label>
                <textarea
                  rows={3}
                  value={dosText}
                  onChange={(e) => setDosText(e.target.value)}
                  placeholder="Highlight freshly roasted beans&#10;End with a clear neighborhood CTA"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Don&apos;ts (one per line)
                </label>
                <textarea
                  rows={3}
                  value={dontsText}
                  onChange={(e) => setDontsText(e.target.value)}
                  placeholder="Never use generic corporate buzzwords"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                />
              </div>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campaign Timezone
              </label>
              <input
                type="text"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingBrief}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {savingBrief ? "Saving Brief..." : "Save Campaign Brand Brief"}
            </button>
          </form>

          {/* Shared Team Memory */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Shared Campaign Memory (`campaign_memories`)
              </h3>
              <p className="text-xs text-slate-500">
                Persistent facts, preferences, and learnings shared across Master, Research, Creator, Scheduler & Analytics.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <select
                value={newMemoryKind}
                onChange={(e) => setNewMemoryKind(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="preference">Preference</option>
                <option value="fact">Brand Fact</option>
                <option value="decision">Decision</option>
                <option value="learning">Learning</option>
              </select>
              <input
                type="text"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Add a rule or fact your AI team should always remember..."
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleAddMemory}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {memories.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  No campaign memories recorded yet. Agents also save learnings automatically as they work!
                </p>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                        {m.kind}
                      </span>
                      <span className="text-slate-800 truncate">{m.content}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(m.id)}
                        className={`rounded-lg p-1.5 cursor-pointer ${
                          m.pinned
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(m.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Integrations & Encrypted Vault */}
      {tab === "integrations" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-slate-700">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>AES-256-GCM Encrypted Vault:</strong> Every API key is encrypted
              server-side with <code>INTEGRATIONS_ENCRYPTION_KEY</code> before storage
              in <code>user_integrations</code>. Plaintext keys are never returned to the browser.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {KEY_PROVIDERS.map((prov) => {
              const existing = integrations.find((i) => i.provider === prov.id);
              const isSaving = savingProvider === prov.id;

              return (
                <div
                  key={prov.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {prov.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {prov.subtitle}
                      </p>
                    </div>
                    {existing && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          existing.keyHint.startsWith("Live (env")
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-blue-50 border border-blue-200 text-blue-700"
                        }`}
                      >
                        {existing.keyHint.startsWith("Live (env")
                          ? existing.keyHint
                          : `Saved (${existing.keyHint})`}
                      </span>
                    )}
                  </div>

                  {prov.hasEndpoint && (
                    <input
                      type="text"
                      value={endpointInputs[prov.id] || ""}
                      onChange={(e) =>
                        setEndpointInputs((prev) => ({
                          ...prev,
                          [prov.id]: e.target.value,
                        }))
                      }
                      placeholder={prov.endpointPlaceholder}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  )}

                  {"hasModel" in prov && (prov as { hasModel?: boolean }).hasModel && (
                    <input
                      type="text"
                      value={modelInputs[prov.id] || ""}
                      onChange={(e) =>
                        setModelInputs((prev) => ({
                          ...prev,
                          [prov.id]: e.target.value,
                        }))
                      }
                      placeholder={(prov as { modelPlaceholder?: string }).modelPlaceholder}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                    />
                  )}

                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={keyInputs[prov.id] || ""}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({
                          ...prev,
                          [prov.id]: e.target.value,
                        }))
                      }
                      placeholder={prov.placeholder}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveKey(prov.id)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : existing ? (
                        "Update"
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Loading Settings...
        </div>
      }
    >
      <SettingsInner />
    </Suspense>
  );
}
