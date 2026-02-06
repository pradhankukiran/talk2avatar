"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { primeAudioPlayback } from "@/hooks/useLipSync";
import { useAppStore } from "@/stores/app-store";

export function ChatInput() {
  const [input, setInput] = useState("");
  const { sendMessage, stopGeneration } = useChat();
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);

  const onSpeechResult = useCallback(
    (transcript: string) => {
      sendMessage(transcript);
    },
    [sendMessage]
  );

  const { isListening, transcript, isSupported, startListening, stopListening } =
    useSpeechRecognition(onSpeechResult);

  const toggleListening = useCallback(async () => {
    await primeAudioPlayback();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setInput("");
      sendMessage(text);
    },
    [input, sendMessage]
  );

  const isBusy = pipelineStatus === "thinking" || pipelineStatus === "speaking";

  return (
    <div className="px-4 py-3">
      {/* Interim speech transcript */}
      {isListening && transcript && (
        <div
          className="mb-2 text-[12px] italic truncate animate-fade-in"
          style={{ color: "var(--text-tertiary)" }}
        >
          {transcript}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {isSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
            style={{
              background: isListening ? "var(--danger)" : "rgba(255,255,255,0.6)",
              color: isListening ? "white" : "var(--text-tertiary)",
              border: isListening ? "none" : "1px solid rgba(255,255,255,0.5)",
              backdropFilter: "blur(8px)",
              ...(isListening ? { animation: "breathe 2s ease-in-out infinite" } : {}),
            }}
            title={isListening ? "Stop listening" : "Start listening"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-[18px] h-[18px]"
            >
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
              <path d="M6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 1 1-12 0Z" />
            </svg>
          </button>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Type a message..."}
          disabled={isListening}
          className="flex-1 text-[14px] px-4 py-2.5 rounded-xl outline-none transition-all duration-200 disabled:opacity-50 backdrop-blur-sm"
          style={{
            background: "rgba(255,255,255,0.55)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,124,102,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        {isBusy ? (
          <button
            type="button"
            onClick={stopGeneration}
            className="flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:opacity-90"
            style={{
              background: "var(--danger)",
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || isListening}
            className="flex-shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              background: "var(--accent)",
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
