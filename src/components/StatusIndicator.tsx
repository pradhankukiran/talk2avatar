"use client";

import { useAppStore } from "@/stores/app-store";
import type { PipelineStatus } from "@/types";

const statusConfig: Record<PipelineStatus, { label: string; color: string }> = {
  idle: { label: "Ready", color: "var(--success)" },
  listening: { label: "Listening", color: "var(--danger)" },
  thinking: { label: "Thinking", color: "var(--warning)" },
  speaking: { label: "Speaking", color: "var(--info)" },
};

export function StatusIndicator() {
  const status = useAppStore((s) => s.pipelineStatus);
  const { label, color } = statusConfig[status];

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-sm"
      style={{
        background: "rgba(255,255,255,0.6)",
        color: color,
        border: "1px solid rgba(255,255,255,0.5)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: color,
          ...(status !== "idle" ? { animation: "pulse-soft 2s ease-in-out infinite" } : {}),
        }}
      />
      {label}
    </div>
  );
}
