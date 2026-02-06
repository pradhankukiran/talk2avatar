"use client";

import type { ChatMessage } from "@/types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-1 py-1 text-[18px] leading-relaxed uppercase tracking-wide ${
          isUser ? "text-right" : "text-left"
        }`}
        style={{
          color: isUser ? "var(--accent-hover)" : "var(--text-primary)",
        }}
      >
        {message.content || (
          <span className="inline-flex gap-1.5 items-center py-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
              style={{ background: "var(--text-tertiary)" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
              style={{ background: "var(--text-tertiary)", animationDelay: "0.2s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
              style={{ background: "var(--text-tertiary)", animationDelay: "0.4s" }}
            />
          </span>
        )}
      </div>
    </div>
  );
}
