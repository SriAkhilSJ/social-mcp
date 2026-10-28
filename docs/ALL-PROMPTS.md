# Social Media AI Agent — All Build Prompts

Every prompt used to build this project, from an empty Next.js app to the Analytics page, in the order they were given.
Each chapter has a short explanation of what it builds, followed by the main prompt and any follow-up prompts used to refine or fix it.

> Prompts have been lightly cleaned (typos fixed) but keep their original meaning. Secrets such as API keys and project IDs are replaced with placeholders.

**Tech stack:** Next.js 16 + React 19 · InsForge (auth, database, storage) · OpenAI Agents SDK · Inngest (background jobs) · E2B Desktop sandbox · Gemini + ImageKit (images) · Blotato (social publishing and analytics)

---

## Chapter 1 — Connect the InsForge Backend

**What it does:** Logs in to the InsForge CLI, installs the InsForge skills, and links the project. After this, the AI uses InsForge for all backend work (database, auth, storage).

```text
I'm using InsForge as my backend. Login through:

npx @insforge/cli login --user-api-key <YOUR_INSFORGE_USER_API_KEY>

Then install the InsForge CLI and skills for this project, and link it with:

npx @insforge/cli link --project-id <YOUR_INSFORGE_PROJECT_ID>

Use the InsForge CLI and skills for backend tasks.
```

Follow-up:
```text
Is InsForge connected?
```

---

## Chapter 2 — Authentication (Sign In / Sign Up)

**What it does:** Adds sign-in and sign-up pages with Google and email/password login through InsForge Auth. It protects `/dashboard` and saves the user's profile to the database the first time they log in.

```text
Implement Sign In and Sign Up pages and add InsForge Authentication to our app. Add Gmail and email/password
authentication, and only navigate to the /dashboard page once the user is authenticated. After the user signs in or
signs up successfully for the first time, make sure to save the user information to the database.
```

---

## Chapter 3 — Create Campaign Wizard

**What it does:** Adds a two-step onboarding flow. New users name their campaign, pick an icon, and choose an "AI Agent Office" theme. Users who already have a campaign go straight to the dashboard.

```text
When a user signs in or signs up, check if they have an existing campaign in the `campaign` table. If not, redirect
them to the **Create Campaign** page.

**Step 1:** Enter a campaign name and select an icon or upload a custom one. Click **Next**.

**Step 2:** Display AI Agent Office images from the `public/offices` folder and allow the user to select one.

On clicking **Create Campaign**, save the campaign details to the database and redirect the user to the **Dashboard**.

If the user already has a campaign, navigate directly to the Dashboard.

Implement it with a professional UI/UX page.
```

Follow-ups (design polish):
```text
Update the UI/UX with a professional Dribbble-template style for all the pages, including this Create Campaign page.
I don't want any scrolling on this page, so make sure it fits properly; use cards if needed. Use blue as the primary
color for this application.
```
```text
Let's implement something like this (reference image attached), not full page.
```

---

## Chapter 4 — Dashboard Layout and Navigation

**What it does:** Builds the app shell: a collapsible icon sidebar, a campaign switcher, and the menu items for every future page.

```text
Create a modern Dribbble-inspired dashboard layout based on the reference image. Add a collapsible sidebar (icons only
by default) with colorful icon backgrounds, a logo at the top, a campaign switcher dropdown with an option to create a
new campaign, and sidebar menus: Overview, AI Agent, Posts, Calendar, Analytics, Accounts, and Settings. Include a clean
dashboard header. Do not implement individual pages yet. Focus on polished UI/UX, smooth animations, and proper spacing.
```

---

## Chapter 5 — Overview Page and AI Agent Office Preview

**What it does:** The left half of the Overview page shows campaign status, upcoming posts, and recent activity. The right half shows a reusable animated "office" in which the AI agent characters are placed from JSON layout files.

```text
Implement the Overview page layout based on the attached mockup. Use the left half of the screen (next to the sidebar)
to display campaign status, upcoming scheduled posts, and recent activity. Keep the right half blank for now. Show
clean, attractive empty states for new users when no data is available. Maintain a modern, polished UI/UX consistent
with the dashboard design.
```

```text
Implement a reusable AI Agent Office component on the right side of the Overview page. Based on the campaign's selected
office, load the appropriate JSON file from /office-studio/wooden-office.json or /office-studio/modern-office.json and
render the office layout. Position AI agent characters accurately according to the JSON data and apply their
corresponding animations. Ensure the office scales responsively while maintaining fixed relative character positions,
even when the window is resized.
```

Follow-ups:
```text
For some reason the office background image is not showing. Fix it, or else use the related office image from the
public folder and update it in the JSON.
```
```text
Can you make it full height? Is it possible?
```
```text
Let's add a popover just above each agent showing the agent name, like Research Agent, Creator Agent, etc., for a social
media agent platform, and along with the name show proper related icons/emoji.
```

---

## Chapter 6 — AI Agent Page (Chat UI)

**What it does:** Builds the Agent page with an agent selector, Chat/History/Settings tabs, and click-to-select from the office preview. The same component is reused on the Overview page.

```text
Implement the AI Agent page based on the attached mockup. Keep the existing reusable Office Preview component on the
right. On the left, display all agents in a single row with their avatars and names. When an agent is selected, show
Chat, History, and Settings tabs below, with the Chat UI open by default. Highlight the selected agent with a distinct
background color and popover. Also add an agent click handler to the Office Preview so clicking any character selects
that agent and displays its corresponding tabs and content. Keep the selection synchronized between both sections and
maintain the existing UI/UX style.
```

Follow-ups:
```text
There is a lot of space between cards, and because of that the chat box is very small. Also make the agent row and its
cards smaller.
```
```text
Inside the Overview page, when the user clicks on any agent in the office preview section, show the chat option on the
left side for that AI agent. Make sure the user does not jump to the Agent page. Just show the agent's profile image and
name and the same Chat, History and Settings tabs. Reuse this component and do not create a new one. Also make sure the
office preview uses the same component everywhere.
```

---

## Chapter 7 — OpenAI Agents SDK and Chat History

**What it does:** Connects the four agents (Research, Creator, Scheduler, Analytics) to the OpenAI Agents SDK, each with its own role instructions. Chats are saved to the database and load 10 messages at a time.

```text
https://developers.openai.com/api/docs/guides/agents/quickstart : Implement and integrate the OpenAI Agents SDK using a
reusable OpenAI client instance. Connect it to our existing four AI agents, each with dedicated system instructions
based on its role: Research, Content Creation, Scheduling, and Analytics. Integrate all agents with the existing Chat UI
for real-time, two-way conversations. Ensure each agent strictly follows its assigned instructions, maintains
conversation context, and responds according to its specific responsibilities. Keep the implementation modular,
reusable, and secure. Refer to the URL for docs if needed.
```

```text
Save the chat conversation with each agent for that user in the database. Load the last 10 messages, and on scroll load
10 more, to avoid loading too much at the same time.
```

**Architecture planning (no code):** Before building further, a workflow plan was written to [agent-workflow.md](../agent-workflow.md):
```text
Based on our app structure, help me restructure my workflow. The idea is to integrate a cloud VM desktop (Linux OS) with
file storage, a browser, a terminal, etc. Each campaign is connected to one VM sandbox so agents can share it. The
Research Agent goes to Instagram/TikTok or any platform the user wants, asks the user to log in if needed, and saves the
session so other agents can use it any time, even after the VM is paused and resumed. After research, it saves the
information to a file on the VM desktop (named by date, etc.). The Creator Agent reads that file and creates posts using
ChatGPT or ImageKit, then saves them to another file. The Scheduler Agent schedules them based on time, date and
timezone, notifies the user, and saves everything to the database. The last agent publishes at the specific time using
an Inngest function. (Do not implement)
```
```text
Write it in a .md file.
```
```text
A few things: video can only be published to social media platforms from the cloud VM, so the AI agent helps post it.
In Settings we are adding a toggle to publish either through the VM cloud or through Blotato (fast post). The VM can also
be used by multiple agents at the same time. Update the .md file.
```

---

## Chapter 8 — Master Agent Orchestration

**What it does:** Adds a Master Agent that takes user requests, plans tasks, assigns them to sub-agents, tracks progress, and reviews results. Sub-agents only take tasks from the Master. The Publisher agent is replaced by an Analytics agent.

```text
Implement the Master Agent feature with a larger, highlighted card alongside the four smaller agent cards on the Agent
page. The Master Agent should have its own Chat UI and act as the main coordinator: receiving user requests, planning
tasks, assigning work to appropriate agents, tracking progress, reviewing outputs, and requesting clarification from
users when needed. Other agents can communicate with the Master Agent to ask questions or provide updates. Save all
conversations, tasks, assignments, statuses, and agent responses in the appropriate database tables. Add a Master Agent
chat option to the Overview page. Regular agents should only accept task instructions from the Master Agent; users can
chat with them to ask questions but cannot assign tasks directly. Ensure proper agent orchestration, task dependencies,
error handling, and reusable architecture while maintaining the existing UI/UX.
```

Follow-ups:
```text
On the Agent page, the Master Agent chat shows loading and the send button is disabled. Something is wrong; fix it.
```
```text
Replace the existing Publisher agent with an Analytics agent, which gives performance analytics based on a user request
or a user-requested schedule through the Master Agent. Update all instructions and the office preview popover name
everywhere.
```

---

## Chapter 9 — Inngest Task Scheduling

**What it does:** Moves agent work into background jobs. A cron job runs every 15 minutes and queues tasks that are due. An executor runs each task at its scheduled time. Repeating tasks reschedule themselves, and no task runs twice.

```text
Build the Inngest task scheduling workflow on top of the existing Master Agent orchestration. Inngest is already
installed. Don't add new agent tools yet.

1. Master Agent plans tasks and saves them to the DB: agentType, instructions, scheduledAt, an optional repeat rule
   (with nextRunAt), status pending. The Master Agent decides when each task should run and spreads tasks out sensibly.
2. Inngest setup: client, /api/inngest route, working with the local dev server.
3. Cron function every 15 min: find pending tasks with scheduledAt in the next 15 min, set them to queued in one atomic
   update, and send a task/execute event for each. If the Master Agent creates a task due in under 15 min, send its
   event right away.
4. Executor function (task/execute): step.sleepUntil(scheduledAt), run the matching agent, save the result to the DB,
   set status to done or failed. Use retries, and use concurrency limits per user and per agent.
5. Repeating tasks: after a run, calculate nextRunAt from the repeat rule and reschedule the task as pending.
6. No task should ever run twice. Follow the existing code patterns and DB setup.
Plan first and show me the plan before coding.
```

Follow-ups:
```text
Make the concurrency limit 50 per agent across all users, remove the example code as well, and start implementing.
```
```text
"The agent couldn't reply right now. Please try again." Error while chatting with the Master and other agents.
```
```text
http://localhost:3000/api/agents/chat error: failed to fetch. Fix the chat issue.
```

---

## Chapter 10 — E2B Desktop Sandbox for Agents

**What it does:** Gives each campaign a shared cloud Linux desktop (E2B). Agents can browse, click and type in it, and store files there. When a login is needed, the run pauses, the user logs in through a live stream, and the agent continues. Independent tasks run in parallel.

> A shorter, file-agnostic version of this chapter is in [chapter-10-e2b-sandbox.md](chapter-10-e2b-sandbox.md).

```text
Add E2B desktop sandbox support (@e2b/desktop) for all our AI agents, starting with Research and Creator. Build on the
existing Master Agent orchestration (OpenAI Agents SDK).

1. Sandbox (lib/sandbox): create, pause, resume and kill sandboxes, and get the live stream URL. Use one sandbox per
   campaign, shared by all of that campaign's agents, so logins and files carry over. Store the sandboxId on the
   campaign and use folders /campaign/research, /campaign/assets and /campaign/output. Only one agent uses the sandbox
   at a time.
2. Shared tools for every agent:
    - computer_action: screenshot, click, type, scroll, open_url, run
    - file_storage: read, write, list and delete sandbox files, and upload a file to ImageKit to get a permanent URL
    - request_user_action: needs approval, so it interrupts the run (e.g. login required)
    - report_result: returns structured results plus artifacts (type, name, URL, metadata) to the Master Agent
3. Creator Agent: a generate_image tool that uses OpenAI or ImageKit, with a configurable default and a fallback to the
   other. Generated images are uploaded to ImageKit and returned through report_result.
4. Hand-off: the Master Agent saves the artifacts to the DB, linked to the campaign and task, and passes the relevant
   ones to the next agent.
5. Pause/resume: on an interruption, save the RunState, set the task to waiting_for_user, pause the sandbox and notify
   the UI. "Login now" resumes the sandbox and shows the live stream; the user logs in and the agent never handles
   passwords. "Done" loads the RunState, approves the interruption and continues the run.
6. Task state in the DB: queued → running → waiting_for_user → running → done/failed/expired. Each task stores
   campaignId, sandboxId, runState, current step, artifacts and error.
7. Run agents in a background worker, not in Next.js requests. Auto-pause idle sandboxes, expire tasks that are never
   resumed, and kill the sandbox when the campaign ends, after its files are uploaded.
8. UI: a task status view, a live sandbox view with a "Done" button, and a results view with artifact previews. The
   Office Agent preview popover must:
    - show the live status from the DB, never a stale or hard-coded value
    - show the agent, task, current step, elapsed time, sandbox state and artifact count
    - when waiting_for_user, show the reason and a "Login now" button
    - when done, show a summary and previews; when failed or expired, show the reason and a "Retry" button

Keep this generic: a new agent should only need its own instructions and extra tools. Keep API keys on the server only.
Follow existing code patterns. Plan first and show me the plan before coding, including the DB schema changes, the
popover components you will change, and why the popover shows the wrong status today.

Inside each selected agent's tabs, add a new option called "Computer" that shows a small preview of the sandbox, and on
click opens it on a big screen.
```

Answers to the plan questions:
```text
1. Use Inngest, 2. Do it, 3. Whichever is good, 4. Auto-pause after 3 minutes if it's idle, 5. (Ignore for now). Start
implementing.
```

Follow-ups (agent behavior in the sandbox):
```text
When the Master Agent assigns a task to an agent and the user then adds some important information, add it to the
existing task and pass it to the agent. Do not create a new task; update the existing agent task. Make sure the
Research and Creator agents always use the browser in the sandbox to get the latest information unless the user
specifically says otherwise. But if the agent has internal knowledge, don't use the browser every time.
```
```text
When an agent uses the browser, make sure it opens the browser, clicks into it, opens the URL, and if login is needed,
tells the user. The agent can do all operations and go back and forth with the AI model to perform actions in the E2B
sandbox desktop. Refer to this doc: https://docs.e2b.dev/agents/codex
```
```text
It looks like it's not able to perform any action inside the VM sandbox desktop after it starts. Refer to this doc:
https://docs.e2b.dev/agents/codex. Do we need an AI agent with access to the sandbox to perform the task, or can our AI
agent do it?
```
```text
A few things: make sure our agent checks with the AI model on what to do. For example, if it opens an incorrect
Instagram URL, it should check with the AI model, fix the URL, and try again. It should do the same for other tasks.
Also, once a task is handed over to a specific agent, make sure that agent executes properly and does not get stuck,
because right now nothing is working properly with the E2B sandbox.
```
```text
Can you make multiple agents run in parallel (1 agent per task) when the assigned subtasks are not under one task and
do not depend on each other?
```
```text
Don't use the browser every time. If the AI agent knows the answer, answer from knowledge; there is no need to use the
browser unless the AI doesn't have the answer and needs to check. Also, to generate post images, use the Gemini AI model,
and use ImageKit for AI transformations.
```
```text
Apply DB changes.
```

UI and bug-fix follow-ups:
```text
On the Agent page, let's move the top agent row to a vertical side bar with just icons; hover shows the name, and click
shows the chat and everything to its right, so the chat area gets full height.
```
```text
Remove this text: "AI Agents — Give the Master Agent your requests; it plans the work and runs the team".
```
```text
After the app runs, it goes into an infinite loading loop. Fix it.
```
```text
The Master Agent assigned a task to the Research Agent, but the status is not updated and nothing shows. Even under the
Computer tab it's just loading.
```
```text
When the Master Agent assigns a task, make sure it's sent to the agent. The bubble popover is not updating; I have to
refresh manually. Fix that.
```

---

## Chapter 11 — Agent Focus, Time Limits and Tools

**What it does:** Keeps agents focused on social media and gives each agent a time limit. Adds real tools: web research for the Research Agent, and post, caption and hashtag writing plus Gemini image generation and ImageKit edits for the Creator Agent. Generated images show in the chat.

> See also [chapter-11-campaign-brief-and-memory.md](chapter-11-campaign-brief-and-memory.md).

```text
All these agents are built for a social media platform, so make sure they focus on social-media-related questions,
answers and work.
```
```text
Make sure the Research Agent finishes its job in 3 to 5 minutes max, then the Creator Agent generates content within 3
to 5 minutes, and scheduling does the same or less. If it takes longer, use whatever information the agent has and
return the result.
```
```text
When the user asks to generate an image or something, the Creator should create the image unless it has a question.
Use the Gemini image model, or ImageKit if set up.
```

Main tools prompt:
```text
Implement OpenAI Agent SDK tools for the Research and Creator Agents using the existing architecture.

The Research Agent should use its AI knowledge first, and when live or in-depth research is needed, use the integrated
E2B desktop browser to search Google, YouTube, Instagram, or any other platform. Support browser interactions, user
login when required, and saving research findings, sources, and results to the database.

The Creator Agent should have tools to generate text posts, captions, hashtags, and content ideas, generate images using
Gemini, transform images using ImageKit, and save generated content as drafts in the database. Ensure each agent
automatically selects the appropriate tools when needed, follows its assigned role, and integrates with the existing
Master Agent orchestration.

Make sure to update the database tables accordingly, and make sure images display in the result.

Also make sure the agent saves proper output from each assigned agent task in the database so it's easy to find later.
```

Follow-ups:
```text
"Image: not generated because no image tool is configured." Try and test it and let me know the result. Use Gemini to
generate it.
```
```text
When the Creator Agent generates an image and saves it to storage, also show a small preview inside the chat so the user
knows the image was generated.
```

---

## Chapter 12 — Posts Page and Image Editing

**What it does:** Adds a Posts library and a manual post composer with a live platform preview, ImageKit AI image editing (also exposed as an agent tool), and scheduling with date, time and timezone.

```text
Implement a new **Posts** page to display all AI-generated and manually created posts. Add a **Create Post** dropdown
with two options: **Create Manually** and **Create Using AI Agent**. The AI option redirects to the Agent page, while
Manual opens the Create Post page with a form on the left and a live platform-specific preview on the right.

Include fields for title, caption, hashtags, platform selection (Instagram, YouTube, TikTok), and image upload or
ImageKit AI image generation. Add an **Edit Image** dialog with ImageKit AI transformation features based on the
documentation (https://imagekit.io/docs/image-transformation). Save edited images and URLs, and update the live preview
instantly. Also make the ImageKit tools reusable so they can be used as tools for the AI agent as well. I will add all
.env keys.

Allow users to select a scheduling date, time, and timezone. On clicking **Schedule Post**, save all post details, media
URLs, platform selections, and scheduling information to the database with a scheduled/pending status. Display the
saved post on the Posts page. Actual publishing will be implemented later. Maintain the existing polished UI/UX design.
```

Follow-ups:
```text
Don't show the top section ("Your content library … Scheduled / Drafts / AI ready" stats).
```
```text
On the Posts page, when a scheduled post exists and has not been posted yet, allow the user to edit it and reschedule
it if they want.
```

---

## Chapter 13 — Blotato: Connect Accounts and Schedule Posts

**What it does:** Each user pastes their own Blotato API key (stored encrypted). The Accounts page lists their connected social accounts. Scheduled posts are published through Blotato, and the Scheduler Agent uses Blotato MCP tools. The Master Agent delegates scheduling instead of publishing directly.

```text
Let's implement the Accounts page, where we show all of the user's connected social media accounts.

Add Blotato integration (multi-user, each user uses their own Blotato account) to post and schedule on Instagram,
TikTok and YouTube.

**Flow:** The user connects their social accounts and generates an API key on Blotato. They paste the key in our
**Settings → Integrations** page. We check the key, fetch and show their connected accounts, and add a
"Refresh accounts" button.

**Posting:** Scheduled posts publish through the existing Inngest job by calling Blotato's API. The chat agent uses
Blotato's MCP (`https://mcp.blotato.com/mcp`, `blotato-api-key` header).

**Rules:** Store keys encrypted in InsForge, server-side only. The composer only shows connected platforms. YouTube is
video/Shorts only.
```

Follow-ups:
```text
Use Blotato MCP tools to schedule the posts on the Posts page, and whenever the user schedules, make sure it's scheduled
through the Blotato platform. Use the proper MCP tool for it.
```
```text
Add Blotato scheduling MCP tools to the Scheduler Agent so it uses them to schedule posts as the user requests.
```
```text
When I told the Master Agent to publish, it published directly to Blotato. It should give the task to the Scheduler
Agent, which should schedule it and add the scheduled post to the database so it's visible to users on the Posts page
as well.
```
```text
Sometimes the Master Agent asks too many questions. Fix it so the Master Agent thinks before asking questions and
replies with what it is doing. Its job is to plan, assign to sub-agents, and collect results from the other agents.
```
```text
An AI-agent-generated post image gives an error while scheduling: "Some images aren't stored for this campaign. Upload
them again."
```

---

## Chapter 14 — Calendar Page

**What it does:** Adds month and week calendar views of scheduled posts, drag-and-drop rescheduling, and a platform-specific preview panel.

```text
Implement a modern **Calendar** page to display all scheduled posts from the database. Include **Monthly and Weekly
views**, with options to navigate between months/weeks and jump to today. Display scheduled posts as attractive cards
with image thumbnails, platform icons, titles, and scheduled times. Clicking a post should open a detailed preview with
editing options.

Enable **drag-and-drop rescheduling** to any date and time, automatically updating the database.

Ensure the calendar respects the user's timezone, supports campaign-specific posts, and shows clean empty states.
Maintain the existing polished, responsive UI/UX design. Also, on clicking a post, show a preview on the right side too,
with details based on which platform it is for.
```

---

## Chapter 15 — Analytics Page and Analytics Agent Tools

**What it does:** Adds an Analytics dashboard with KPI cards, activity and engagement charts, and a platform donut chart. Real metrics are synced from Blotato and stored in the database, and the Analytics Agent gets tools to read and explain them. No fake data is shown.

```text
Implement a modern **Analytics** page with summary cards showing Total Posts Published, Total Views, Publishing Success
Rate, and Estimated Time Saved. Below, add interactive charts for daily posting activity, views and engagement trends,
and a donut chart showing platform-wise performance (Instagram, YouTube, TikTok, etc.). Include date-range filters and
campaign selection.

Integrate **Blotato MCP tools** to fetch real analytics data from connected social media accounts. Create reusable
analytics tools and assign them to the existing **Analytics AI Agent**, allowing it to retrieve, analyze, and explain
real performance data. Store and sync analytics in the database, handle missing metrics gracefully, and avoid displaying
fake data. Maintain a clean, responsive, Dribbble-inspired UI/UX consistent with the dashboard.
```

---

## Appendix — Tips for Using These Prompts

- **Run the chapters in order.** Each one builds on the code from the previous chapters.
- **Attach reference images** where a prompt mentions a "mockup" or "reference image" (Chapters 3–6).
- **Ask for a plan first** on big features (Chapters 9 and 10 do this). Review the plan, answer its questions, then say "start implementing".
- **Set up `.env` keys before testing**: InsForge, OpenAI, Inngest, E2B, Gemini, ImageKit, and an encryption key for the Blotato keys.
- The follow-up prompts show the real fixes that were needed along the way. Use them if you hit the same issues.
