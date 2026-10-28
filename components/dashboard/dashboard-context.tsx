"use client";

import { createContext, useContext } from "react";
import type { LiveStatusResponse } from "@/lib/orchestration";

export interface DashboardCampaign {
  id: number;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  officeImage: string;
  endedAt: string | Date | null;
}

export interface DashboardProfile {
  brandName: string | null;
  description: string | null;
  voice: string | null;
  audience: string | null;
  goals: string | null;
  platforms: string[];
  timeZone: string;
  publishMethod: string;
  requiresApproval: boolean;
  dos: string[];
  donts: string[];
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface DashboardContextValue {
  user: DashboardUser;
  campaign: DashboardCampaign;
  campaigns: DashboardCampaign[];
  profile: DashboardProfile | null;
  liveStatus: LiveStatusResponse | null;
  refreshStatus: () => void;
  refreshCampaignData: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used inside DashboardShell");
  }
  return ctx;
}
