# OpenPost launch film

A 58-second, 1920x1080, 60 fps launch film made in code. It follows one founder's release from GitHub to every
network and back. The interface is the real OpenPost UI: maintained captures in `assets/screenshots/`, live preview
cards captured from the composer, and light Dither components drawn in `film.js` so they can move. The soundtrack is a
licensed music track and real CC0 recordings, chosen, trimmed, placed and checked with
[earshot](https://github.com/Leonxlnx/earshot).

```sh
devenv shell -- bun run capture:launch-film   # only when the UI or script.json changes
devenv shell -- bun run render:launch-film
```

The render writes `tmp/launch-film/openpost-launch.mp4`. Each step can be rerun alone:

| Step                         | Command                                                                                                     | Output in `tmp/launch-film/`                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Draw the sample launch image | `bun apps/marketing/launch-film/render.mjs --artwork tmp/launch-film/lumen-launch.png`                      | `lumen-launch.png`                                    |
| Capture the UI               | `tests/app/launch-film.spec.ts` uploads that image through the composer and captures each network's preview | `capture/`                                            |
| Render the picture           | `bun apps/marketing/launch-film/render.mjs`                                                                 | `picture.mp4`, `cues.json`                            |
| Mix the sound                | `uv run apps/marketing/launch-film/mix.py tmp/launch-film`                                                  | `sounds/`, `soundtrack.wav`, stems, `mix-report.json` |

To render stills while you edit, run `bun apps/marketing/launch-film/render.mjs --stills 4.2,11,28.6`. Stills also
write `cues.json`, so `mix.py` can run without a full picture render.

## The story

One continuous move. Each scene hands an element to the next one, and every scene change sits on a bar line of the
music (108 BPM).

1. **The problem.** "You just shipped." A GitHub release for Lumen 2.0, a sample product, ticks through its changes.
   "Now tell everyone." The work piles up around it: ten tasks and sixteen networks, faster and faster.
2. **The turn.** The music stops. Everything is pulled into four quadrants, which become the four modules of the
   Converge mark on the drop. OpenPost, and its promise.
3. **The product.** The camera dives through the mark's centre into Workflows: the release docks onto the GitHub
   trigger and the run's pulse travels to Create draft and Review post. Review post opens into the composer, where
   the draft streams in. The composer bursts into five real network previews; X gets its own shorter version. The
   camera zooms through the X card's image into the image editor, the finished image becomes the first shot on a
   video timeline, and a click on Schedule pulls back to the month. Publishing turns one post green and walks another
   through Failed and Retrying to Published. Results climb to the launch-day spike, and a reply goes out from one
   inbox.
4. **The breadth.** Everything else OpenPost does scrolls past on a tilted plane and is pulled back into the mark.
5. **The logo.** The four modules converge again, the music resolves, and the line lands: "Your socials, on
   steroids."

## How it fits together

- `film.js` owns the timeline. Every frame is a pure function of time. `render.mjs` calls `window.film.seek(t)` and
  captures the stage, averaging three subframes over a 180-degree shutter so fast moves blur like a camera.
- Scene times come from the music's measured downbeats (`bar(k)` in `film.js`). The picture's cues for sound come from
  the same timeline, so sync never drifts.
- `script.json` holds the sample product, post, replies and handles. The capture reads the same file.
- Character limits come from `@openpost/platform-text`: X 280, Bluesky 300, Threads and Mastodon 500, LinkedIn 3,000.
- `sounds.json` lists every recording: page, preview URL, sha256, licence as read on the sound's own page, and trims.
  `mix.py` downloads and checks them, cuts the music at bar lines, places each effect on its measured onset or peak,
  sets its level against the music bed, climbs pop runs in pitch, and masters to -14 LUFS with true peak at or below
  -1.5 dBTP.

## Credits and provenance

Publish this line with the film (the track's licence requires it):

> Music: "Corporate Tower" by mareproduction (https://freesound.org/people/mareproduction/sounds/612264/), licensed
> under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Edited: cut and rearranged at bar lines.

- Sound effects are CC0 recordings from Freesound, listed in `sounds.json`.
- Lumen is a sample product. Accounts, analytics and replies are sample data, and the results scenes are labelled.
- Integration marks come from `assets/postiz-socials/`, the set the README uses.

## Checking the sound

You can't judge the soundtrack by reading code. Measure it with earshot after a change:

```sh
E='uvx --python 3.12 --from earshot@git+https://github.com/Leonxlnx/earshot@591fa3e028032e6dce56620a20e932e35667e8d8 earshot'
$E critique tmp/launch-film/openpost-launch.mp4
$E sheet tmp/launch-film/openpost-launch.mp4 -o tmp/launch-film/sheet.png --cues tmp/launch-film/cues.json
$E realness tmp/launch-film/music-stem.wav tmp/launch-film/effects-stem.wav
```

To replace a sound, find candidates on Freesound, read the licence on the sound's own page (CC0 or CC BY only), rank
them with `earshot rank`, trim with `earshot find`, and add the entry to `sounds.json` with its sha256.
