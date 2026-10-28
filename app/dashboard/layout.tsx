import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getRequestScope } from "@/lib/request-scope";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const scope = await getRequestScope();
  if (!scope) {
    redirect("/create-campaign");
  }

  const db = await getDb();
  const [profile] = await db
    .select()
    .from(campaignProfiles)
    .where(eq(campaignProfiles.campaignId, scope.campaignId))
    .limit(1);

  return (
    <DashboardShell
      initialUser={{
        id: user.id,
        name: user.name || "Creator",
        email: user.email,
        avatarUrl: user.avatarUrl || null,
      }}
      initialCampaign={{
        id: scope.campaign.id,
        name: scope.campaign.name,
        icon: scope.campaign.icon,
        iconUrl: scope.campaign.iconUrl,
        officeImage: scope.campaign.officeImage,
        endedAt: scope.campaign.endedAt,
      }}
      initialCampaigns={scope.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        iconUrl: c.iconUrl,
        officeImage: c.officeImage,
        endedAt: c.endedAt,
      }))}
      initialProfile={
        profile
          ? {
              brandName: profile.brandName,
              description: profile.description,
              voice: profile.voice,
              audience: profile.audience,
              goals: profile.goals,
              platforms: profile.platforms || ["instagram", "tiktok", "youtube"],
              timeZone: profile.timeZone || "UTC",
              publishMethod: profile.publishMethod || "blotato",
              requiresApproval: Boolean(profile.requiresApproval),
              dos: profile.dos || [],
              donts: profile.donts || [],
            }
          : null
      }
    >
      {children}
    </DashboardShell>
  );
}
