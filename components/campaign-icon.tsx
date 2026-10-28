"use client";

import {
  Rocket,
  Sparkles,
  Coffee,
  Megaphone,
  Flame,
  Globe,
  Briefcase,
  Camera,
  Zap,
  Crown,
  type LucideIcon,
} from "lucide-react";

export interface PresetIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
}

export const CAMPAIGN_ICONS: PresetIconOption[] = [
  { id: "rocket", label: "Rocket", icon: Rocket, bg: "bg-blue-100", fg: "text-blue-600" },
  { id: "coffee", label: "Cafe", icon: Coffee, bg: "bg-amber-100", fg: "text-amber-700" },
  { id: "sparkles", label: "AI Brand", icon: Sparkles, bg: "bg-violet-100", fg: "text-violet-600" },
  { id: "megaphone", label: "Agency", icon: Megaphone, bg: "bg-pink-100", fg: "text-pink-600" },
  { id: "flame", label: "Viral", icon: Flame, bg: "bg-orange-100", fg: "text-orange-600" },
  { id: "globe", label: "Global", icon: Globe, bg: "bg-cyan-100", fg: "text-cyan-600" },
  { id: "briefcase", label: "SaaS", icon: Briefcase, bg: "bg-indigo-100", fg: "text-indigo-600" },
  { id: "camera", label: "Studio", icon: Camera, bg: "bg-rose-100", fg: "text-rose-600" },
  { id: "zap", label: "Growth", icon: Zap, bg: "bg-emerald-100", fg: "text-emerald-600" },
  { id: "crown", label: "Pro", icon: Crown, bg: "bg-yellow-100", fg: "text-yellow-700" },
];

export function CampaignAvatar({
  icon,
  iconUrl,
  name,
  size = "md",
}: {
  icon?: string | null;
  iconUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-xl";
  const iconDims = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className={`${dims} object-cover border border-slate-200 shrink-0`}
      />
    );
  }

  const preset = CAMPAIGN_ICONS.find((c) => c.id === icon) || CAMPAIGN_ICONS[0];
  const IconComp = preset.icon;

  return (
    <div
      className={`${dims} ${preset.bg} ${preset.fg} flex items-center justify-center shrink-0 font-semibold`}
    >
      <IconComp className={iconDims} />
    </div>
  );
}
