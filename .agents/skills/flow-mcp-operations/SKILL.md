---
name: flow-mcp-operations
description: Comprehensive operational manual and tool reference for controlling Google Flow through the google-flow-browser-mcp integration. Use when setting up, executing, or debugging Google Flow browser actions, UI selectors, model parameters, video generation (Veo 3.1 / Nano Banana), and asset pipeline integration.
---

# Google Flow MCP Operational Manual

## 1. Overview & Architecture

The `google-flow-browser-mcp` connects AI agents directly to [Google Flow](https://flow.google.com) via Chrome DevTools Protocol (CDP). It allows automated generation of cinematic images and short-form video scenes using Google's generative models (**Nano Banana Pro**, **Nano Banana 2.1**, **Imagen 4**, **Veo 3.1**, and **Omni Video**).

### Connection Architecture
```
AI Agents (Socialix / OpenPost)
         │
         ▼  (HTTP / WebSocket)
Local Chrome CDP Session (Port 9333 / 9222)
         │
         ▼
Active Google Flow Session (`flow.google.com/project/...`)
   - Authenticated Google Account (Pro tier)
   - Canvas, Scene Timeline, Prompt Toolbar, Model Picker
```

---

## 2. Full MCP Tool Arsenal

### Connection & Status
| Tool | Description | Key Parameters |
|---|---|---|
| `flow_connect` | Connects CDP to Chrome and verifies the Flow project tab | `project_url` |
| `flow_status` | Returns active tab URL, queue status, connection health | none |
| `flow_account_check` | Confirms authenticated Google profile matches expected account | none |
| `flow_screenshot` | Captures high-res viewport screenshot of current Flow canvas | `label` |

### Generation & Studio Control
| Tool | Description | Key Parameters |
|---|---|---|
| `flow_generate_image` | Generates character designs or concept art | `prompt`, `model`, `aspect_ratio` ("9:16", "16:9", "1:1"), `auto_confirm` |
| `flow_generate_video` | Sets up or triggers Veo / Omni video scene generation | `prompt`, `duration` ("4s", "8s"), `ratio` ("9:16"), `auto_confirm: true` |
| `flow_create_scene` | Creates a new timeline scene with character bindings | `scene_name`, `character_ids` |
| `flow_download_latest` | Fetches the most recently completed asset to local storage | `output_dir` |

---

## 3. Proven Google Flow UI Selectors

Google Flow is built with Angular Material and ProseMirror. When automating via CDP, use these verified selectors:

1. **Prompt Input (ProseMirror)**:
   ```css
   .ProseMirror[contenteditable="true"]:visible
   /* Fallback: */
   textarea:visible, [aria-label="What do you want to create?"]
   ```
2. **Start Generation Button**:
   ```css
   button.generate-icon-button, button[aria-label*="Start generation"]
   ```
3. **Aspect Ratio & Settings Trigger**:
   ```css
   button.settings-trigger-button, button[aria-label="Settings trigger"]
   ```
4. **Scene Timeline Clips**:
   ```css
   button[aria-label="Toggle aspect ratio"], button[aria-label="Download scene"]
   ```

---

## 4. Video Generation Execution Protocol

### Step-by-Step Dispatch Workflow:
1. **Modal Dismissal**: Before interacting with the prompt box, send `Escape` to ensure any overlay modal (such as asset picker or filter dialog) is closed.
2. **Focus & Clear ProseMirror**:
   - Focus `.ProseMirror[contenteditable="true"]`.
   - Dispatch `Control+A` followed by `Backspace`.
3. **Inject Refined Prompt**:
   - Type prompt text at natural key delay (~15-20ms).
4. **Trigger Start Generation**:
   - Click `button.generate-icon-button` or `[aria-label*="Start generation"]`.
   - If `auto_confirm: true`, the button is clicked directly to consume generative credits.
5. **Harvest Output**:
   - Poll DOM for new `flow-content.google` image or video element URLs.
   - Stream buffer directly into `.data/media/` for automated post scheduling.
