import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, users } from "@/db/schema";
import { getCurrentUser } from "./auth";

export interface RequestScope {
  userId: string;
  user: typeof users.$inferSelect;
  campaignId: number;
  campaign: typeof campaigns.$inferSelect;
  campaigns: Array<typeof campaigns.$inferSelect>;
}

export async function getRequestScope(explicitCampaignId?: number | null): Promise<RequestScope | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const db = await getDb();
  const userCampaigns = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.userId, user.id), isNull(campaigns.endedAt)))
    .orderBy(desc(campaigns.createdAt));

  if (userCampaigns.length === 0) return null;

  let active =
    (explicitCampaignId
      ? userCampaigns.find((c) => c.id === explicitCampaignId)
      : undefined) ||
    (user.activeCampaignId
      ? userCampaigns.find((c) => c.id === user.activeCampaignId)
      : undefined) ||
    userCampaigns.find((c) => !c.endedAt) ||
    userCampaigns[0];

  if (!active) active = userCampaigns[0];

  if (user.activeCampaignId !== active.id) {
    await db
      .update(users)
      .set({ activeCampaignId: active.id, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return {
    userId: user.id,
    user,
    campaignId: active.id,
    campaign: active,
    campaigns: userCampaigns,
  };
}
