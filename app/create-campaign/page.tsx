"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { CAMPAIGN_ICONS, CampaignAvatar } from "@/components/campaign-icon";

const OFFICE_OPTIONS = [
  {
    id: "wooden-office",
    title: "Wooden Studio Office",
    subtitle: "Warm sunlit oak desks with lush greenery & skyline view",
    image: "/offices/wooden-office.webp",
  },
  {
    id: "modern-office",
    title: "Modern Creative Office",
    subtitle: "Sleek neon creator studio with minimalist workstations",
    image: "/offices/modern-office.webp",
  },
] as const;

export default function CreateCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("TubeGuruji Pro");
  const [selectedIcon, setSelectedIcon] = useState("rocket");
  const [customIconUrl, setCustomIconUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<string>("wooden-office");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Logo must be 3 MB or smaller");
      return;
    }
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCustomIconUrl(data.url);
      toast.success("Custom logo uploaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Please enter a campaign name");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          icon: selectedIcon,
          iconUrl: customIconUrl,
          officeImage: selectedOffice,
          timeZone: tz,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");
      toast.success(`Campaign "${data.campaign.name}" is ready with all 4 AI agents!`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create campaign");
      setSubmitting(false);
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/70 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-blue-950/5">
        {/* Header & Step Progress */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Create New Campaign
              </h1>
              <p className="text-xs text-slate-500">
                {step === 1
                  ? "Step 1 of 2 — Name your brand workspace & choose an icon"
                  : "Step 2 of 2 — Select your virtual AI Agent Office"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step >= 1
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
            </span>
            <div className="h-0.5 w-6 rounded bg-slate-200">
              <div
                className={`h-full rounded bg-blue-600 transition-all ${
                  step === 2 ? "w-full" : "w-0"
                }`}
              />
            </div>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === 2
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              2
            </span>
          </div>
        </div>

        {step === 1 ? (
          <div className="mt-5 space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <CampaignAvatar
                icon={selectedIcon}
                iconUrl={customIconUrl}
                name={name || "Campaign"}
                size="lg"
              />
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign / Brand Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. TubeGuruji Pro or Coffee Shop Launch"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-700">
                  Choose a Workspace Icon
                </span>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  {uploadingLogo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-blue-600" />
                  )}
                  Upload Custom Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                {CAMPAIGN_ICONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = !customIconUrl && selectedIcon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCustomIconUrl(null);
                        setSelectedIcon(item.id);
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 transition cursor-pointer ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} ${item.fg}`}
                      >
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    toast.error("Please enter a campaign name first");
                    return;
                  }
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 transition cursor-pointer"
              >
                Next: Choose AI Office
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {OFFICE_OPTIONS.map((office) => {
                const active = selectedOffice === office.id;
                return (
                  <button
                    key={office.id}
                    type="button"
                    onClick={() => setSelectedOffice(office.id)}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition cursor-pointer ${
                      active
                        ? "border-blue-600 ring-2 ring-blue-600/25 bg-blue-50/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="aspect-[3/2] w-full overflow-hidden bg-slate-100">
                      <img
                        src={office.image}
                        alt={office.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">
                          {office.title}
                        </span>
                        {active && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                        {office.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up AI Team...
                  </>
                ) : (
                  <>
                    Create Campaign
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
