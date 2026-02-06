"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { StatusIndicator } from "./StatusIndicator";
import type { LlmProvider } from "@/types";

export function ChatPanel() {
  const messages = useAppStore((s) => s.messages);
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const ttsReady = useAppStore((s) => s.ttsReady);
  const ttsProgress = useAppStore((s) => s.ttsProgress);
  const currentProvider = useAppStore((s) => s.currentProvider);
  const setCurrentProvider = useAppStore((s) => s.setCurrentProvider);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header — provider tabs + status */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          {(["groq", "cerebras", "openrouter"] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => setCurrentProvider(provider)}
              className="px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200"
              style={{
                color: currentProvider === provider ? "var(--accent)" : "var(--text-tertiary)",
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}
            >
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </button>
          ))}
        </div>
        <StatusIndicator />
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mx-4 mt-3 flex items-center justify-between rounded-xl px-4 py-2.5 text-[12px] animate-fade-in backdrop-blur-sm"
          style={{
            background: "rgba(254,242,242,0.8)",
            color: "var(--danger)",
            border: "1px solid rgba(254,202,202,0.6)",
          }}
        >
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:opacity-70"
            style={{ color: "var(--danger)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* TTS loading indicator */}
      {!ttsReady && ttsProgress > 0 && (
        <div className="mx-4 mt-3 animate-fade-in">
          <div
            className="text-[11px] font-medium mb-1.5 flex items-center gap-1.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse-soft">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            Loading voice model... {ttsProgress}%
          </div>
          <div
            className="h-1 rounded-full overflow-hidden backdrop-blur-sm"
            style={{ background: "rgba(242,239,232,0.6)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${ttsProgress}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center animate-fade-in">
            <p
              className="text-[14px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Start a conversation
            </p>
            <p
              className="text-[12px] mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Speak or type to chat with the avatar
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className="animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 50, 200)}ms` }}
          >
            <MessageBubble message={msg} />
          </div>
        ))}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  );
}
