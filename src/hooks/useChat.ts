"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { SentenceSplitter } from "@/lib/sentence-splitter";
import { useTTS } from "@/hooks/useTTS";
import {
  enqueueAudio,
  clearAudioQueue,
  primeAudioPlayback,
} from "@/hooks/useLipSync";
import type { ChatMessage } from "@/types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useChat() {
  const { initialize: initTTS, synthesize } = useTTS();
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useAppStore((s) => s.addMessage);
  const updateLastAssistantMessage = useAppStore((s) => s.updateLastAssistantMessage);
  const setPipelineStatus = useAppStore((s) => s.setPipelineStatus);
  const setError = useAppStore((s) => s.setError);
  const ttsReady = useAppStore((s) => s.ttsReady);
  const currentProvider = useAppStore((s) => s.currentProvider);

  const sendMessage = useCallback(
    async (text: string) => {
      await primeAudioPlayback();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      // Ensure TTS is initialized (first user interaction)
      if (!ttsReady) {
        await initTTS();
      }

      // Abort any in-flight request
      abortRef.current?.abort();
      clearAudioQueue();
      abortRef.current = new AbortController();

      const userMessage: ChatMessage = {
        id: makeId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMessage);

      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      addMessage(assistantMessage);

      setPipelineStatus("thinking");

      // Prepare messages for API (only role + content)
      const allMessages = useAppStore.getState().messages;
      const apiMessages = allMessages
        .filter((m) => m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, provider: currentProvider }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullContent = "";
        let startedSpeaking = false;
        let enqueuedAudio = false;
        let ttsChain = Promise.resolve();

        const splitter = new SentenceSplitter(async (sentence) => {
          ttsChain = ttsChain.then(async () => {
            if (!startedSpeaking) {
              setPipelineStatus("speaking");
              startedSpeaking = true;
            }
            const segment = await synthesize(sentence);
            if (segment) {
              enqueuedAudio = true;
              await enqueueAudio(segment);
            }
          });
        });

        // Read the plain text stream from toTextStreamResponse()
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          if (text) {
            fullContent += text;
            updateLastAssistantMessage(fullContent);
            splitter.add(text);
          }
        }

        // Flush remaining text
        splitter.finish();
        await ttsChain;

        if (!startedSpeaking && fullContent.length > 0) {
          setPipelineStatus("speaking");
        }

        // If we spoke via browser fallback (no queued audio), explicitly return to idle.
        if (startedSpeaking && !enqueuedAudio) {
          setPipelineStatus("idle");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Chat error:", err);
        setError((err as Error).message);
        setPipelineStatus("idle");
      }
    },
    [addMessage, updateLastAssistantMessage, setPipelineStatus, setError, ttsReady, initTTS, synthesize, currentProvider]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    clearAudioQueue();
    setPipelineStatus("idle");
  }, [setPipelineStatus]);

  return { sendMessage, stopGeneration };
}
