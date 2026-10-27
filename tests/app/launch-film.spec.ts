import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createWorkspace, registerUser } from "./helpers";
import {
  fixtureDirectory,
  rasterFixtureFiles,
  uploadImageFixture,
  prepareProductPage,
} from "./product-capture-fixtures";
import script from "../../apps/marketing/launch-film/script.json" with { type: "json" };

// Opt-in capture of real light-scheme UI for the launch film in apps/marketing/launch-film.
// The film animates these element captures; accounts and replies are sample fixtures.
test.skip(process.env.OPENPOST_CAPTURE_LAUNCH_FILM !== "1", "Run bun run capture:launch-film.");

const outputDirectory = "tmp/launch-film/capture";
test.use({
  actionTimeout: 15_000,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 3,
  colorScheme: "light",
  locale: "en-US",
  timezoneId: "Europe/Lisbon",
  serviceWorkers: "block",
  trace: "off",
});
test.setTimeout(300_000);

async function previewCard(page: Page) {
  const card = page.locator(".social-preview[data-platform]").first();
  await expect(card).toBeVisible();
  await page.waitForTimeout(600);
  // Hide the account tab's media edit overlay; the film shows the post as published.
  await card.evaluate((element) => {
    for (const button of element.querySelectorAll("button")) {
      if (getComputedStyle(button).position === "absolute") button.style.visibility = "hidden";
      const parent = button.parentElement;
      if (
        parent &&
        getComputedStyle(parent).position === "absolute" &&
        parent.closest("figure, [class*=media]")
      )
        parent.style.visibility = "hidden";
    }
  });
  return card;
}

test("captures launch film UI", async ({ page, request }) => {
  await mkdir(outputDirectory, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const auth = await registerUser(request, `launch-film-${randomUUID()}@example.com`);
  const workspace = await createWorkspace(request, auth.token, "Personal");
  const [backgroundMediaID, logoMediaID] = await Promise.all([
    uploadImageFixture(
      request,
      auth.token,
      workspace.id,
      "lisbon-tram.png",
      await readFile(join(fixtureDirectory, rasterFixtureFiles["lisbon-tram"])),
    ),
    uploadImageFixture(
      request,
      auth.token,
      workspace.id,
      "logo.png",
      await readFile(join(fixtureDirectory, rasterFixtureFiles["openpost-logo"])),
    ),
  ]);
  await prepareProductPage({
    page,
    request,
    auth,
    workspace,
    backgroundMediaID,
    logoMediaID,
    scheme: "light",
    composerAccountIDs: [
      "account-linkedin",
      "account-threads",
      "account-x",
      "account-mastodon",
      "account-bluesky",
    ],
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });

  await page.goto(`/?workspace=${workspace.id}`);
  await expect(page.getByTestId("compose-shell")).toBeVisible();
  await expect(page.getByTestId("composer-account-loading")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#post-textarea-0").fill(script.draft);
  // Attach the sample launch image through the real Device upload.
  const composer = page.getByTestId("text-thread-composer-content");
  await composer.getByRole("button", { name: "Add media" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("tab", { name: "Device" }).click();
  await picker
    .locator('input[type="file"]')
    .first()
    .setInputFiles("tmp/launch-film/lumen-launch.png");
  await picker.getByRole("button", { name: /^Upload 1 file/ }).click();
  await expect(composer.getByRole("button", { name: "Remove media" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(800);
  await page.locator(":focus").evaluate((element) => (element as HTMLElement).blur());
  await page.screenshot({ path: join(outputDirectory, "composer.png") });

  // Each destination tab renders the network's own preview card.
  const destinations = page.getByRole("group", { name: "Destinations" }).getByRole("button");
  const count = await destinations.count();
  for (let index = 1; index < count; index++) {
    await destinations.nth(index).click();
    const card = await previewCard(page);
    const platform = await card.getAttribute("data-platform");
    await card.screenshot({ path: join(outputDirectory, `preview-${platform}.png`) });
    if (platform !== "x") continue;
    // X gets its own shorter version, edited in the account tab.
    const editor = card.locator('textarea, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(script.short);
    await page.locator(":focus").evaluate((element) => (element as HTMLElement).blur());
    const shortCard = await previewCard(page);
    await shortCard.screenshot({ path: join(outputDirectory, "preview-x-short.png") });
  }

  await page.route("**/api/v1/engagement?**", (route) =>
    route.fulfill({
      json: {
        total: script.comments.length,
        next_cursor: "",
        sync_states: [],
        items: script.comments.map(([network, author_name, body], index) => {
          const platform = network.toLowerCase();
          return {
            id: `launch-comment-${index}`,
            workspace_id: workspace.id,
            author_name,
            author_handle: author_name.toLowerCase().replace(" ", ""),
            body,
            platform,
            social_account_id: `account-${platform}`,
            account_username: "rodrgds",
            author_avatar_url: "",
            author_remote_id: `author-${index}`,
            attachments: [],
            can_reply: true,
            can_like: true,
            can_unlike: false,
            can_delete: false,
            can_hide: false,
            is_ours: false,
            liked: false,
            hidden: false,
            parent_remote_id: "",
            conversation_remote_id: "",
            remote_id: `comment-${index}`,
            rendition_id: `rendition-${index}`,
            publication_id: "published-aug-19",
            publication_title: script.short,
            created_at: "2026-08-20T13:00:00Z",
            updated_at: "2026-08-20T13:00:00Z",
            last_seen_at: "2026-08-20T13:00:00Z",
          };
        }),
      },
    }),
  );
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.getByText(script.comments[0][2])).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outputDirectory, "inbox.png") });

  expect(errors).toEqual([]);
});
