"use client";

import { useCallback, useRef } from "react";
import { getSharedAudioContext } from "@/lib/audio-context";
import { useAppStore } from "@/stores/app-store";
import { getHeadTTS } from "@/lib/headtts-client";
import type { AudioSegment, OculusViseme } from "@/types";

function isTtsDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TTS_DEBUG === "1") return true;
  if (process.env.NEXT_PUBLIC_TTS_DEBUG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function previewText(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

export function useTTS() {
  const initializingRef = useRef(false);
  const serverTtsUnavailableRef = useRef(false);
  const setTtsReady = useAppStore((s) => s.setTtsReady);
  const setTtsProgress = useAppStore((s) => s.setTtsProgress);
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

  const synthesizeWithClientHeadTTS = useCallback(
    async (text: string): Promise<AudioSegment | null> => {
      try {
        const headtts = await getHeadTTS((progress) => setTtsProgress(progress));
        const messages = await headtts.synthesize({ input: text });
        const audioMessage = messages.find(
          (message: { type?: string; data?: { audio?: AudioBuffer } }) =>
            message?.type === "audio" && message?.data?.audio
        ) as
          | {
              data?: {
                audio?: AudioBuffer;
                visemes?: string[];
                vtimes?: number[];
                vdurations?: number[];
              };
            }
          | undefined;

        if (!audioMessage?.data?.audio) {
          throw new Error("Client HeadTTS response missing audio");
        }

        if (isTtsDebugEnabled()) {
          console.debug("[TTS client] client-side HeadTTS success", {
            textLength: text.length,
            preview: previewText(text),
            visemeCount: audioMessage.data.visemes?.length ?? 0,
          });
        }

        return {
          audio: audioMessage.data.audio,
          visemes: (audioMessage.data.visemes ?? []) as OculusViseme[],
          vtimes: (audioMessage.data.vtimes ?? []) as number[],
          vdurations: (audioMessage.data.vdurations ?? []) as number[],
        };
      } catch (err) {
        if (isTtsDebugEnabled()) {
          console.warn("[TTS client] client-side HeadTTS failed", {
            textLength: text.length,
            preview: previewText(text),
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return null;
      }
    },
    [setTtsProgress]
  );

  const synthesize = useCallback(
    async (text: string): Promise<AudioSegment | null> => {
      const totalStart = performance.now();
      if (serverTtsUnavailableRef.current) {
        const clientSegment = await synthesizeWithClientHeadTTS(text);
        if (clientSegment) return clientSegment;
      }
      try {
        const networkStart = performance.now();
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const networkMs = Math.round(performance.now() - networkStart);

        if (!res.ok) {
          const errorData = (await res.json().catch(() => ({}))) as {
            error?: string;
            details?: string;
          };
          const reason = [errorData.error, errorData.details].filter(Boolean).join(" | ");
          throw new Error(reason || `TTS HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          audioBase64?: string;
          visemes?: string[];
          vtimes?: number[];
          vdurations?: number[];
          ttsDevice?: string | null;
          elapsedMs?: number;
        };

        if (!data.audioBase64) {
          throw new Error("TTS response missing audio");
        }

        const decodeStart = performance.now();
        const audio = await decodeBase64Audio(data.audioBase64);
        const decodeMs = Math.round(performance.now() - decodeStart);
        const totalMs = Math.round(performance.now() - totalStart);

        if (isTtsDebugEnabled()) {
          console.debug("[TTS client] synthesize success", {
            textLength: text.length,
            preview: previewText(text),
            networkMs,
            decodeMs,
            totalMs,
            apiElapsedMs: data.elapsedMs ?? null,
            device: data.ttsDevice ?? "unknown",
            visemeCount: data.visemes?.length ?? 0,
          });
        }

        return {
          audio,
          visemes: (data.visemes ?? []) as OculusViseme[],
          vtimes: (data.vtimes ?? []) as number[],
          vdurations: (data.vdurations ?? []) as number[],
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        serverTtsUnavailableRef.current = true;
        if (isTtsDebugEnabled()) {
          console.warn("[TTS client] synthesize failed, using browser fallback", {
            textLength: text.length,
            preview: previewText(text),
            error: reason,
            totalMs: Math.round(performance.now() - totalStart),
          });
        }
        const clientSegment = await synthesizeWithClientHeadTTS(text);
        if (clientSegment) {
          return clientSegment;
        }
        const spoke = await speakWithBrowserTTS(text);
        if (!spoke) {
          console.error("TTS synthesize failed and fallback failed:", err);
          setError("TTS failed. Browser speech fallback also failed.");
        }
        return null;
      }
    },
    [decodeBase64Audio, speakWithBrowserTTS, setError, synthesizeWithClientHeadTTS]
  );

  return { initialize, synthesize };
}
