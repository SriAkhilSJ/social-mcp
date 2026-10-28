"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio, Play, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AgentRoleId } from "@/lib/agent-roles";

// Tuned voice profiles for each agent with prioritized Chrome/Windows English voices
export const AGENT_VOICE_CONFIGS: Record<
  AgentRoleId,
  {
    name: string;
    pitch: number;
    rate: number;
    samplePhrase: string;
    voiceNameKeywords: string[];
  }
> = {
  master: {
    name: "Master Agent (Jarvis)",
    pitch: 0.85, // Deep, authoritative, British/American gentleman
    rate: 1.0,
    samplePhrase: "Jarvis online. All systems nominal. Master Agent ready to coordinate campaign strategy.",
    voiceNameKeywords: [
      "Google UK English Male",
      "Microsoft David",
      "David",
      "George",
      "Daniel",
      "Google US English",
      "en-GB",
      "en-US",
    ],
  },
  creator: {
    name: "Creator Agent",
    pitch: 0.95, // Dramatic, storyteller, cinematic director
    rate: 0.95,
    samplePhrase: "Creator Agent here. Ready to direct cinematic noir scenes and Google Flow visuals.",
    voiceNameKeywords: [
      "Google US English",
      "Microsoft Mark",
      "Christopher",
      "Eric",
      "Guy",
      "Natural",
      "en-US",
    ],
  },
  analytics: {
    name: "Analytics Agent",
    pitch: 1.05, // Crisp, rapid, precise analyst
    rate: 1.15,
    samplePhrase: "Analytics Agent active. Tracking viral retention curves and audience metrics.",
    voiceNameKeywords: [
      "Google US English",
      "Microsoft David",
      "Alex",
      "James",
      "en-US",
    ],
  },
  research: {
    name: "Research Agent",
    pitch: 1.15, // Inquisitive, energetic intelligence officer
    rate: 1.1,
    samplePhrase: "Research Agent reporting. Deep-diving market trends and villain backstories.",
    voiceNameKeywords: [
      "Google UK English Female",
      "Microsoft Zira",
      "Jenny",
      "en-GB",
      "en-US",
    ],
  },
  scheduler: {
    name: "Scheduler Agent",
    pitch: 1.0, // Structured, methodical, calm
    rate: 1.05,
    samplePhrase: "Scheduler Agent standing by. Posting calendars and distribution slots aligned.",
    voiceNameKeywords: [
      "Google UK English Female",
      "Microsoft Zira",
      "Sonia",
      "en-US",
      "en-GB",
    ],
  },
};

// Robust helper to speak using tuned English voice and avoid Chrome speech bugs
export function speakAgentVoice(
  text: string,
  agentId: AgentRoleId = "master",
  soundEnabled = true
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !soundEnabled) return;

  try {
    const cleanText = text
      .replace(/[*_#`~>\[\]\(\)]/g, " ")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[\r\n]+/g, ". ")
      .slice(0, 320)
      .trim();

    if (!cleanText) return;

    window.speechSynthesis.cancel();

    // Small delay to prevent Chrome cancel+speak queue cancellation bug
    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const cfg = AGENT_VOICE_CONFIGS[agentId] || AGENT_VOICE_CONFIGS.master;

        utterance.pitch = cfg.pitch;
        utterance.rate = cfg.rate;

        const voices = window.speechSynthesis.getVoices();
        // Priority 1: match agent voice keywords
        let matched = voices.find((v) =>
          cfg.voiceNameKeywords.some((kw) =>
            v.name.toLowerCase().includes(kw.toLowerCase()) ||
            v.lang.toLowerCase().includes(kw.toLowerCase())
          )
        );

        // Priority 2: fallback to any English voice (never non-English default)
        if (!matched) {
          matched =
            voices.find((v) => v.lang.startsWith("en")) ||
            voices.find((v) => v.name.toLowerCase().includes("english"));
        }

        if (matched) {
          utterance.voice = matched;
          utterance.lang = matched.lang;
        } else {
          utterance.lang = "en-US";
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis invocation failed:", err);
      }
    }, 60);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}

export function VoiceAssistant({
  selectedAgent = "master",
  onVoiceTranscript,
  autoSpeakText,
}: {
  selectedAgent?: AgentRoleId;
  onVoiceTranscript?: (transcript: string) => void;
  autoSpeakText?: string | null;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const lastSpokenRef = useRef<string>("");

  // Load available system voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      if (vs && vs.length > 0) setAvailableVoices(vs);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Setup SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRec && "speechSynthesis" in window) {
      setSpeechSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        finalTranscriptRef.current = "";
        setInterimText("");
        toast.info(`🎙️ Jarvis Ear Active: Speak to ${AGENT_VOICE_CONFIGS[selectedAgent]?.name.split(" ")[0]} now...`);
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }
        const combined = (final + " " + interim).trim();
        finalTranscriptRef.current = combined;
        setInterimText(combined);
      };

      rec.onend = () => {
        setIsListening(false);
        const textToDispatch = finalTranscriptRef.current.trim();
        if (textToDispatch) {
          toast.success(`🎙️ Dispatched: "${textToDispatch}"`);
          onVoiceTranscript?.(textToDispatch);
        }
        setInterimText("");
      };

      rec.onerror = (err: any) => {
        setIsListening(false);
        const code = err.error || "unknown";
        if (code === "not-allowed" || code === "service-not-allowed") {
          toast.error("Microphone blocked. Click the lock/camera icon in Chrome address bar and allow Microphone.", {
            duration: 6000,
          });
        } else if (code === "audio-capture") {
          toast.error("No microphone detected. Please check your mic connection or input device.");
        } else if (code === "network") {
          toast.error("Speech recognition network error. Ensure internet connection to Google speech services.");
        } else if (code !== "no-speech") {
          toast.error(`Microphone error: ${code}`);
        }
      };

      recognitionRef.current = rec;
    }
  }, [selectedAgent, onVoiceTranscript]);

  // Handle auto-speaking incoming agent instructions / messages
  useEffect(() => {
    if (!autoSpeakText || !soundEnabled || autoSpeakText === lastSpokenRef.current) return;
    lastSpokenRef.current = autoSpeakText;
    speakText(autoSpeakText, selectedAgent);
  }, [autoSpeakText, soundEnabled, selectedAgent]);

  const toggleListening = () => {
    if (!speechSupported) {
      toast.error("Speech recognition not supported in this browser. Please open in Google Chrome.");
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
    } else {
      finalTranscriptRef.current = "";
      setInterimText("");
      try {
        recognitionRef.current?.start();
      } catch {
        try {
          recognitionRef.current?.stop();
          setTimeout(() => recognitionRef.current?.start(), 150);
        } catch (e: any) {
          toast.error("Could not start speech recognition. " + (e?.message || ""));
        }
      }
    }
  };

  const speakText = useCallback(
    (text: string, agentId: AgentRoleId = selectedAgent) => {
      if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      try {
        window.speechSynthesis.cancel();
        const cleanText = text
          .replace(/[*_#`~>\[\]\(\)]/g, " ")
          .replace(/https?:\/\/\S+/g, "")
          .slice(0, 320)
          .trim();

        if (!cleanText) return;

        setTimeout(() => {
          try {
            window.speechSynthesis.resume();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const cfg = AGENT_VOICE_CONFIGS[agentId] || AGENT_VOICE_CONFIGS.master;

            utterance.pitch = cfg.pitch;
            utterance.rate = cfg.rate;

            const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
            let matched = voices.find((v) =>
              cfg.voiceNameKeywords.some((kw) =>
                v.name.toLowerCase().includes(kw.toLowerCase()) ||
                v.lang.toLowerCase().includes(kw.toLowerCase())
              )
            );

            if (!matched) {
              matched =
                voices.find((v) => v.lang.startsWith("en")) ||
                voices.find((v) => v.name.toLowerCase().includes("english"));
            }

            if (matched) {
              utterance.voice = matched;
              utterance.lang = matched.lang;
            } else {
              utterance.lang = "en-US";
            }

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = (e) => {
              setIsSpeaking(false);
              console.warn("Speech error:", e.error);
            };

            window.speechSynthesis.speak(utterance);
          } catch (e) {
            console.warn("Speak execution error:", e);
          }
        }, 60);
      } catch (err) {
        console.warn("Speech synthesis invocation failed:", err);
      }
    },
    [soundEnabled, selectedAgent, availableVoices]
  );

  const testCurrentVoice = () => {
    const cfg = AGENT_VOICE_CONFIGS[selectedAgent] || AGENT_VOICE_CONFIGS.master;
    toast.info(`🔊 Playing ${cfg.name} aloud...`);
    speakText(cfg.samplePhrase, selectedAgent);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs shadow-xs">
      {/* Mic Button (Voice In / STT) */}
      <button
        type="button"
        onClick={toggleListening}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer select-none ${
          isListening
            ? "bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/40 ring-2 ring-rose-400"
            : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        }`}
        title={isListening ? "Listening... click to stop and send" : `Click to speak to ${AGENT_VOICE_CONFIGS[selectedAgent]?.name.split(" ")[0]} (Jarvis Voice In)`}
      >
        {isListening ? (
          <>
            <Radio className="w-3.5 h-3.5 text-white animate-spin" />
            <span className="text-[10px] tracking-wide font-mono font-bold">
              {interimText ? interimText.slice(0, 16) + "..." : "Listening..."}
            </span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] hidden sm:inline">Voice Command</span>
          </>
        )}
      </button>

      {/* Test Voice Sample Button (Instant TTS check) */}
      <button
        type="button"
        onClick={testCurrentVoice}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 text-purple-300 hover:text-white hover:bg-purple-950/60 border border-purple-500/30 transition cursor-pointer"
        title={`Click to test ${AGENT_VOICE_CONFIGS[selectedAgent]?.name} voice out loud`}
      >
        <Play className="w-2.5 h-2.5 fill-purple-400 text-purple-400" />
        <span className="text-[9px] font-bold hidden sm:inline">Test Voice</span>
      </button>

      {/* Speaker Toggle (Voice Out / TTS Mute) */}
      <button
        type="button"
        onClick={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          if (!next && typeof window !== "undefined") {
            window.speechSynthesis.cancel();
          }
          toast.info(next ? "🔊 Agent Voice Feedback Enabled" : "🔇 Agent Voice Feedback Muted");
        }}
        className={`p-1 rounded-lg transition cursor-pointer ${
          soundEnabled
            ? "text-purple-400 hover:text-purple-300 hover:bg-slate-800"
            : "text-slate-500 hover:text-slate-400"
        }`}
        title={soundEnabled ? "Agent voice output is ON (click to mute)" : "Agent voice output is MUTED (click to enable)"}
      >
        {soundEnabled ? (
          <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? "animate-bounce text-emerald-400" : ""}`} />
        ) : (
          <VolumeX className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Voice Badge Indicator */}
      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider hidden lg:inline">
        {AGENT_VOICE_CONFIGS[selectedAgent]?.name.split(" ")[0]}
      </span>
    </div>
  );
}