"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Share2,
  Sparkles,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";

interface ConnectedAcc {
  id: string;
  platform: string;
  name: string;
  username?: string;
  status?: string;
  provider: "blotato" | "openpost" | "facebook";
}

interface IntegrationSummary {
  provider: string;
  keyHint: string;
  endpointUrl: string | null;
  accountsCount: number;
  refreshedAt: string | null;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAcc[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingDemo, setConnectingDemo] = useState(false);

  // Direct Facebook Page Quick-Connect
  const [fbToken, setFbToken] = useState("");
  const [fbPageId, setFbPageId] = useState("");
  const [connectingFb, setConnectingFb] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setIntegrations(data.integrations || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setAccounts(data.accounts || []);
      setIntegrations(data.integrations || []);
      toast.success("Refreshed connected social accounts");
    } catch {
      toast.error("Could not refresh accounts");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConnectDemo() {
    setConnectingDemo(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect-demo", provider: "blotato" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect demo");
      setAccounts(data.accounts || []);
      setIntegrations(data.integrations || []);
      toast.success(
        "Connected 6 Demo channels (Instagram, Facebook Page, TikTok, YouTube, X, LinkedIn)!"
      );
    } catch {
      toast.error("Could not connect demo accounts");
    } finally {
      setConnectingDemo(false);
    }
  }

  async function handleConnectFacebook(e: React.FormEvent) {
    e.preventDefault();
    if (!fbToken.trim()) {
      toast.error(
        "Paste your Meta Facebook Page Access Token (or enter 'demo' to test)"
      );
      return;
    }
    setConnectingFb(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          provider: "facebook",
          apiKey: fbToken.trim(),
          endpointUrl: fbPageId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Facebook connection failed");
      setAccounts(data.accounts || []);
      setIntegrations(data.integrations || []);
      setFbToken("");
      toast.success("Facebook Page connected via Meta Graph API v25.0!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not connect Facebook Page"
      );
    } finally {
      setConnectingFb(false);
    }
  }

  async function handleDisconnect(provider: string) {
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", provider }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
        setIntegrations(data.integrations || []);
        toast.success(`Disconnected ${provider}`);
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  const activeSocialIntegrations = integrations.filter((i) =>
    ["blotato", "openpost", "facebook"].includes(i.provider)
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Connected Social Accounts (Facebook Graph API • Blotato MCP • OpenPost MCP)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Connect Facebook Pages directly via Meta Graph API{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                v25.0
              </code>
              , self-hosted OpenPost Docker, or Blotato MCP — encrypted at rest with AES-256-GCM.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh Accounts
          </button>

          <Link
            href="/dashboard/settings?tab=integrations"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Manage MCP &amp; Video Keys
          </Link>
        </div>
      </div>

      {/* Direct Facebook Page Quick-Connect Card */}
      <form
        onSubmit={handleConnectFacebook}
        className="rounded-3xl border border-[#1877F2]/25 bg-gradient-to-r from-[#1877F2]/5 via-white to-white p-5 shadow-2xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1877F2] text-xs font-extrabold text-white">
              FB
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">
                Connect Facebook Page Directly (Meta Graph API v25.0)
              </h3>
              <p className="text-[11px] text-slate-500">
                Supports Facebook Page Feed posts, Photos &amp; 9:16 Google Flow Video Reels (`pages_manage_posts`, `pages_read_engagement`).
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={connectingDemo}
            onClick={async () => {
              setConnectingDemo(true);
              try {
                const res = await fetch("/api/integrations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "connect-demo",
                    provider: "facebook",
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setAccounts(data.accounts || []);
                  setIntegrations(data.integrations || []);
                  toast.success("Connected Demo Facebook Page!");
                }
              } finally {
                setConnectingDemo(false);
              }
            }}
            className="rounded-xl border border-[#1877F2]/30 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1877F2] hover:bg-blue-50 cursor-pointer"
          >
            + Quick-Test Demo Facebook Page
          </button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-12">
          <input
            type="password"
            value={fbToken}
            onChange={(e) => setFbToken(e.target.value)}
            placeholder="Paste Meta Page / User Access Token (EAAB...)"
            className="sm:col-span-6 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono"
          />
          <input
            type="text"
            value={fbPageId}
            onChange={(e) => setFbPageId(e.target.value)}
            placeholder="Optional Page ID (auto-discovers Pages if blank)"
            className="sm:col-span-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={connectingFb}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-bold text-white hover:bg-[#166FE5] disabled:opacity-50 cursor-pointer"
          >
            {connectingFb ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Connect FB"
            )}
          </button>
        </div>
      </form>

      {/* Active Provider Status Strips */}
      {activeSocialIntegrations.map((integ) => (
        <div
          key={integ.provider}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs"
        >
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <PlugZap className="h-4 w-4 text-emerald-600" />
            <span>
              {integ.provider.toUpperCase()} Connected ({integ.keyHint}) •{" "}
              {integ.accountsCount} channel{integ.accountsCount === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleDisconnect(integ.provider)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <Unplug className="h-3 w-3" />
            Disconnect
          </button>
        </div>
      ))}

      {/* Accounts List */}
      {loading ? (
        <div className="flex h-52 items-center justify-center text-xs text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
          Checking connected social channels...
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Share2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900">
              No Social Accounts Connected Yet
            </h3>
            <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
              Connect your Facebook Page above, add your Blotato / OpenPost MCP key in Settings, or connect all 6 Demo channels (including Facebook) in 1 click!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <Link
              href="/dashboard/settings?tab=integrations"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Open Integrations Vault
            </Link>

            <button
              type="button"
              disabled={connectingDemo}
              onClick={handleConnectDemo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              {connectingDemo ? "Connecting..." : "Connect 6 Demo Accounts (incl. Facebook)"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const spec = PLATFORMS[acc.platform as PlatformId];
            return (
              <div
                key={`${acc.provider}-${acc.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: spec?.color || "#2563EB" }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-xs"
                  >
                    {(spec?.name || acc.platform).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {acc.username || spec?.name || acc.platform}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Ready via{" "}
                      {acc.provider === "facebook"
                        ? "META GRAPH v25.0"
                        : `${acc.provider.toUpperCase()} MCP`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
