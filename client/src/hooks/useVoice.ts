import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceOptions {
  agentId?: string;
}

const AGENT_VOICE: Record<string, { pitch: number; rate: number }> = {
  ceo:          { pitch: 1.0, rate: 0.88 },
  researcher:   { pitch: 0.9, rate: 0.95 },
  cmo:          { pitch: 1.15, rate: 1.0 },
  sales_rep:    { pitch: 1.05, rate: 1.05 },
  dev:          { pitch: 0.82, rate: 0.92 },
  data_analyst: { pitch: 0.88, rate: 0.9  },
};

export function useVoice({ agentId = "ceo" }: UseVoiceOptions = {}) {
  const [isListening, setIsListening]     = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [voiceEnabled, setVoiceEnabled]   = useState(true);
  const [transcript, setTranscript]       = useState("");
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef<((t: string) => void) | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!isSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR() as any;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      const text = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      setTranscript(text);
      if (e.results[e.results.length - 1].isFinal) {
        onTranscriptRef.current?.(text);
        setTranscript("");
        setIsListening(false);
      }
    };
    rec.onend  = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
  }, [isSupported]);

  const startListening = useCallback((onDone: (text: string) => void) => {
    if (!recognitionRef.current) return;
    window.speechSynthesis?.cancel();
    onTranscriptRef.current = onDone;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch { /* already started */ }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const v = AGENT_VOICE[agentId] ?? { pitch: 1, rate: 1 };
    utter.pitch  = v.pitch;
    utter.rate   = v.rate;
    utter.volume = 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend   = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled, agentId]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isListening, isSpeaking, voiceEnabled, setVoiceEnabled, transcript, startListening, stopListening, speak, stopSpeaking, isSupported };
}
