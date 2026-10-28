import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const mediaDir = path.join(process.cwd(), ".data", "media");
fs.mkdirSync(mediaDir, { recursive: true });

async function main() {
  console.log("=== 🎬 PRODUCING 42-SECOND MASTER ANIME NOIR TRAILER ===");

  // 1. Generate Voiceover Audio via PowerShell Speech
  const psCode = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = -2

# Pick male voice if available
$voices = $s.GetInstalledVoices()
foreach ($v in $voices) {
    if ($v.VoiceInfo.Gender -eq 'Male' -or $v.VoiceInfo.Name -match 'David|George|Mark') {
        $s.SelectVoice($v.VoiceInfo.Name)
        break
    }
}

$s.SetOutputToWaveFile('${path.join(mediaDir, "vo_1.wav").replace(/\\/g, "/")}')
$s.Speak("They thought blinding me would leave me in the dark. They carved out my eyes to steal the syndicate.")

$s.SetOutputToWaveFile('${path.join(mediaDir, "vo_2.wav").replace(/\\/g, "/")}')
$s.Speak("They forgot. A blind man hears the heartbeat of every traitor in the room.")

$s.SetOutputToWaveFile('${path.join(mediaDir, "vo_3.wav").replace(/\\/g, "/")}')
$s.Speak("The eyes only see what is in front of them. My mind sees the entire board.")

$s.SetOutputToWaveFile('${path.join(mediaDir, "vo_4.wav").replace(/\\/g, "/")}')
$s.Speak("Tell my brothers... the game has just begun. An Intelligent Blind Gangster.")

$s.Dispose()
`;
  const psPath = path.join(process.cwd(), ".data", "gen_vo.ps1");
  fs.writeFileSync(psPath, psCode);
  console.log("Synthesizing voiceover tracks...");
  execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { stdio: "inherit" });

  // 2. Define Image Sources
  const img1 = path.join(mediaDir, "ren_kurokawa_closeup_1793175959612.jpg");
  const img2 = path.join(mediaDir, "ren_kurokawa_fullbody_1793175985962.jpg");
  const img3 = path.join(mediaDir, "ren_boardroom_entrance.jpg");
  const img4 = path.join(mediaDir, "ren_chess_checkmate.jpg");

  console.log("Images verified:", {
    img1: fs.existsSync(img1),
    img2: fs.existsSync(img2),
    img3: fs.existsSync(img3),
    img4: fs.existsSync(img4),
  });

  // 3. Render 4 Chained Clips (each ~10.5 seconds, 1080x1920 9:16 vertical)
  console.log("Rendering Clip 1 (Macro Raindrop Lens Hook: 0:00 - 0:10.5)...");
  const clip1 = path.join(mediaDir, "clip_1.mp4");
  execSync(
    `ffmpeg -y -loop 1 -i "${img1}" -i "${path.join(mediaDir, "vo_1.wav")}" ` +
    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=315:s=1080x1920:fps=30,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='AN INTELLIGENT BLIND GANGSTER':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=120:shadowcolor=black:shadowx=3:shadowy=3,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='PILOT TRAILER • PART 1':fontcolor=0xE2E8F0:fontsize=22:x=(w-text_w)/2:y=175[v];[1:a]adelay=1000|1000,volume=1.8[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -t 10.5 "${clip1}"`,
    { stdio: "inherit" }
  );

  console.log("Rendering Clip 2 (The Sensory Threat Escalation: 0:10.5 - 0:21.0)...");
  const clip2 = path.join(mediaDir, "clip_2.mp4");
  execSync(
    `ffmpeg -y -loop 1 -i "${img2}" -i "${path.join(mediaDir, "vo_2.wav")}" ` +
    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.12)':x='iw/2-(iw/zoom/2)':y='ih*0.35-(ih/zoom*0.35)':d=315:s=1080x1920:fps=30,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='REN KUROKAWA':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=120:shadowcolor=black:shadowx=3:shadowy=3[v];[1:a]adelay=800|800,volume=1.8[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -t 10.5 "${clip2}"`,
    { stdio: "inherit" }
  );

  console.log("Rendering Clip 3 (The Tactical Cane Parry: 0:21.0 - 0:31.5)...");
  const clip3 = path.join(mediaDir, "clip_3.mp4");
  execSync(
    `ffmpeg -y -loop 1 -i "${img3}" -i "${path.join(mediaDir, "vo_3.wav")}" ` +
    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='max(1.15-0.0008*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=315:s=1080x1920:fps=30,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='TACTICAL CHECKMATE':fontcolor=0xFBBF24:fontsize=34:x=(w-text_w)/2:y=120:shadowcolor=black:shadowx=3:shadowy=3[v];[1:a]adelay=600|600,volume=1.8[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -t 10.5 "${clip3}"`,
    { stdio: "inherit" }
  );

  console.log("Rendering Clip 4 (The Checkmate Cliffhanger: 0:31.5 - 0:42.0)...");
  const clip4 = path.join(mediaDir, "clip_4.mp4");
  execSync(
    `ffmpeg -y -loop 1 -i "${img4}" -i "${path.join(mediaDir, "vo_4.wav")}" ` +
    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.001,1.2)':x='iw/2-(iw/zoom/2)':y='ih*0.4-(ih/zoom*0.4)':d=315:s=1080x1920:fps=30,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='THE GAME HAS JUST BEGUN':fontcolor=0xEF4444:fontsize=36:x=(w-text_w)/2:y=120:shadowcolor=black:shadowx=3:shadowy=3,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='EPISODE 1 COMING SOON':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=175[v];[1:a]adelay=800|800,volume=1.8[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -t 10.5 "${clip4}"`,
    { stdio: "inherit" }
  );

  // 4. Assemble the 4 clips into 42s Master Cut
  console.log("Assembling 4 cuts into master reel...");
  const concatList = path.join(mediaDir, "concat.txt");
  fs.writeFileSync(concatList, `file '${clip1.replace(/\\/g, "/")}'\nfile '${clip2.replace(/\\/g, "/")}'\nfile '${clip3.replace(/\\/g, "/")}'\nfile '${clip4.replace(/\\/g, "/")}'\n`);

  const masterVideo = path.join(mediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${masterVideo}"`,
    { stdio: "inherit" }
  );

  console.log("Master video assembled successfully!");
  console.log("Path:", masterVideo);
  console.log("Size:", fs.statSync(masterVideo).size, "bytes");

  // Also copy to public directory for direct preview
  const pubDir = path.join(process.cwd(), "public", "media");
  fs.mkdirSync(pubDir, { recursive: true });
  fs.copyFileSync(masterVideo, path.join(pubDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4"));
}

main().catch(console.error);
