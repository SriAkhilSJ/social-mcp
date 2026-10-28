---
name: google-flow-director
description: Operate Google Flow MCP for Veo 3.1 & Omni Video generation, viral anime reels prompt engineering, retention hooks, and character consistency.
---

# 🎬 Google Flow Director & Veo 3.1 Video Engineering Skill

This skill equips agents with deep operating knowledge of **Google Flow MCP** (`flow.google.com`), **Veo 3.1**, and short-form viral anime reels video engineering.

---

## 1. Google Flow Architecture & MCP Ecosystem

Google Flow is Google's creative studio for video and image generation. It runs in Chrome and can be commanded via Chrome DevTools Protocol (CDP) or MCP:

- **Local MCP Reference:** `google-flow-browser-mcp/` (based on `TMSSS05/google-flow-browser-mcp`, `hitjcl/google-flow-mcp`, and `vynnlee/google-flow-mcp`).
- **CDP Port:** Default Chrome debugging port `9333` (or `9222`).
- **Target URL:** `https://flow.google.com/project/<project_id>` and `/scene/<scene_id>`.
- **Primary Video Models in Flow:**
  - `Veo 3.1 - Fast` (Quick iteration, 4s/8s duration)
  - `Veo 3.1 - Quality` (Maximum visual fidelity and physics)
  - `Omni Flash` (Turn-by-turn video editing and transitions)
  - `Nano Banana Pro / 2.1` (Image & Character baseline generation)

### Key DOM Selectors in Google Flow
- **Prompt Input:** `.ProseMirror[contenteditable="true"]` (aria-label: `"What do you want to create?"` or `"Select a clip to edit"`)
- **Generate Button:** `button.generate-icon-button` (`aria-label="Start generation"`)
- **Settings Trigger:** `button.settings-trigger-button`
- **Aspect Ratio Toggles:** `mat-button-toggle:has-text("9:16")`, `button:has-text("16:9")`
- **Duration Buttons:** `button:has-text("4s")`, `button:has-text("8s")`
- **Add Clip:** `button.add-clip-button` (`aria-label="Add clip"`)
- **Upload Media:** `button.sidebar-upload-btn`

---

## 2. The Golden Veo 3.1 Prompt Framework

Veo 3.1 is sensitive to directorial framing. Never use vague keywords. Always structure prompts using the **5-Part Formula**:

```
[Aspect Ratio & Format] + [The Hook / Action] + [Subject & Style Blueprint] + [Camera & Pacing Mechanics] + [Lighting & Native Audio Cues]
```

### Prompt Anatomy Rules:
1. **Aspect Ratio First:** Always start with `9:16 vertical video.` to lock portrait composition.
2. **Minimal Lateral Motion:** Vertical phone screens are narrow. Side-to-side pans cause distortion. Use **push-ins, slow pull-backs, or locked macro shots**.
3. **Timed Multi-Beat Segmenting:** Tell Veo when actions occur:
   `[00:00-00:02] ... [00:02-00:05] ... [00:05-00:08]`
4. **Native Audio Cues:** Veo supports native synchronized audio. Explicitly specify the soundscape:
   `Native audio: heavy rain downpour on pavement, muffled sub-bass pulse, metallic cane tap echo.`
5. **Character Style Anchoring:** Reference classic anime cel styles, chiaroscuro lighting, and exact clothing to avoid AI character drift.

---

## 3. Viral Retention Hooks for Short-Form Anime (30–60s)

To pass the first 1.5 seconds retention filter on Facebook Reels, TikTok, and YouTube Shorts:

### Hook Pattern 1: The Sudden Awakening (Visual Shock)
```
9:16 vertical video. [00:00-00:02] Extreme macro close-up of a blind man's dark sunglasses in heavy rain, a single neon red reflection glistening on the lens. Sudden camera whip-pan backward to reveal Ren Kurokawa in a bespoke black suit, tapping his cane on the wet pavement. Dark noir anime aesthetic, 1990s cel style, high-contrast rim lighting. Snappy fast-cut pacing. Native audio: sharp water splash dropping into a deep sub-bass boom and echoing cane tap.
```

### Hook Pattern 2: The Silent Infiltration (Tense Psychological)
```
9:16 vertical video. [00:00-00:03] Slow push-in tracking shot through heavy wooden boardroom doors swinging open. In the center of the frame, a blind Japanese mob boss stands calmly with a white walking cane. Mob executives in the background freeze in terror. Chiaroscuro lighting, dramatic shadows, cinematic anime masterpiece. Native audio: heavy door creak followed by absolute silence and the rhythmic tap of a cane.
```

### Hook Pattern 3: The Checkmate (High-IQ Strategy)
```
9:16 vertical video. [00:00-00:03] Close-up low angle shot of hands in black leather gloves calmly sliding a white chess king across a rain-streaked glass table. Background Tokyo skyline illuminated by neon red and cyan towers. Slow-motion cinematic drift. Native audio: muffled rain outside, the crisp wooden clack of the chess piece, and a deep atmospheric synth hum.
```

---

## 4. Operational Checklist for Creator Studio Agent

1. **Verify Chrome CDP Connection:** Check `http://127.0.0.1:9333/json` to confirm Flow tab is open.
2. **Set Format to 9:16:** Ensure portrait ratio is active for vertical reels.
3. **Inject Native Audio into Every Directive:** Always include the `Native audio:` tag.
4. **Monitor Credits:** Ensure Flow Pro credits are tracked via CDP (`flow-credit-cost-label`).
5. **Auto-Download:** When video rendering completes in Flow, extract via CDP `Page.setDownloadBehavior` into `.data/media/`.
