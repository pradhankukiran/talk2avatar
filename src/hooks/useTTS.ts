"use client";

import { useCallback, useRef } from "react";
import { getSharedAudioContext } from "@/lib/audio-context";
import { useAppStore } from "@/stores/app-store";
import type { AudioSegment, OculusViseme } from "@/types";

export function useTTS() {
  const initializingRef = useRef(false);
  const setTtsReady = useAppStore((s) => s.setTtsReady);
  const setError = useAppStore((s) => s.setError);

  const canUseBrowserSpeech = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }, []);

  const speakWithBrowserTTS = useCallback(async (text: string): Promise<boolean> => {
    if (!canUseBrowserSpeech()) return false;

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);

      synth.speak(utterance);
    });
  }, [canUseBrowserSpeech]);

  const decodeBase64Audio = useCallback(async (base64: string): Promise<AudioBuffer> => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const audioArrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    return getSharedAudioContext().decodeAudioData(audioArrayBuffer);
  }, []);

  const initialize = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      setTtsReady(true);
    } finally {
      initializingRef.current = false;
    }
  }, [setTtsReady]);

  const synthesize = useCallback(
    async (text: string): Promise<AudioSegment | null> => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          throw new Error(`TTS HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          audioBase64?: string;
          visemes?: string[];
          vtimes?: number[];
          vdurations?: number[];
        };

        if (!data.audioBase64) {
          throw new Error("TTS response missing audio");
        }

        const audio = await decodeBase64Audio(data.audioBase64);
        return {
          audio,
          visemes: (data.visemes ?? []) as OculusViseme[],
          vtimes: (data.vtimes ?? []) as number[],
          vdurations: (data.vdurations ?? []) as number[],
        };
      } catch (err) {
        const spoke = await speakWithBrowserTTS(text);
        if (!spoke) {
          console.error("TTS synthesize failed and fallback failed:", err);
          setError("TTS failed. Browser speech fallback also failed.");
        }
        return null;
      }
    },
    [decodeBase64Audio, speakWithBrowserTTS, setError]
  );

  return { initialize, synthesize };
}
