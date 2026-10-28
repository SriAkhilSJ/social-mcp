import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignMemories, campaignProfiles } from "@/db/schema";
import { platformRules } from "@/lib/social/platforms";

export async function getCampaignBrief(campaignId: number) {
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(campaignProfiles)
    .where(eq(campaignProfiles.campaignId, campaignId))
    .limit(1);
  return profile || null;
}

export async function getCampaignMemoriesList(campaignId: number, limit = 15) {
  const db = await getDb();
  return db
    .select()
    .from(campaignMemories)
    .where(eq(campaignMemories.campaignId, campaignId))
    .orderBy(desc(campaignMemories.pinned), desc(campaignMemories.id))
    .limit(limit);
}

export async function buildBriefPromptBlock(campaignId: number): Promise<string> {
  const profile = await getCampaignBrief(campaignId);
  const memories = await getCampaignMemoriesList(campaignId, 10);

  const lines: string[] = [];
  if (profile) {
    lines.push("### Campaign Brand Brief");
    if (profile.brandName) lines.push(`- Brand: ${profile.brandName}`);
    if (profile.description) lines.push(`- Description: ${profile.description}`);
    if (profile.voice) lines.push(`- Brand Voice: ${profile.voice}`);
    if (profile.audience) lines.push(`- Target Audience: ${profile.audience}`);
    if (profile.goals) lines.push(`- Goals: ${profile.goals}`);
    if (profile.timeZone) lines.push(`- Time Zone: ${profile.timeZone}`);
    if (profile.platforms?.length) {
      lines.push(`- Target Platforms: ${profile.platforms.join(", ")}`);
      const rules = platformRules(profile.platforms);
      if (rules) {
        lines.push("### Platform Formatting Rules");
        lines.push(rules);
      }
    }
    if (profile.dos?.length) lines.push(`- Do's: ${profile.dos.join("; ")}`);
    if (profile.donts?.length) lines.push(`- Don'ts: ${profile.donts.join("; ")}`);
  }

  if (memories.length > 0) {
    lines.push("### Team Memories & Preferences");
    for (const m of memories) {
      lines.push(`- [${m.kind}${m.pinned ? ", pinned" : ""}] ${m.content}`);
    }
  }

  return lines.join("\n");
}

export async function rememberIfPreferenceDetected(params: {
  userId: string;
  campaignId: number;
  text: string;
}): Promise<void> {
  const match = params.text.match(
    /\b(never\s+[^.!?\n]+|always\s+[^.!?\n]+|don'?t\s+ever\s+[^.!?\n]+|prefer\s+[^.!?\n]+|avoid\s+[^.!?\n]+)/i
  );
  if (!match) return;
  const content = match[1].trim().slice(0, 300);
  if (content.length < 10) return;

  const db = await getDb();
  const existing = await db
    .select()
    .from(campaignMemories)
    .where(
      and(
        eq(campaignMemories.campaignId, params.campaignId),
        eq(campaignMemories.content, content)
      )
    )
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(campaignMemories).values({
    userId: params.userId,
    campaignId: params.campaignId,
    agentId: "master",
    kind: "preference",
    content,
    pinned: true,
  });
}
