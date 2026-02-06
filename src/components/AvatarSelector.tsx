"use client";

import { useAppStore } from "@/stores/app-store";
import { avatars } from "@/lib/avatars";

export function AvatarSelector() {
  const currentAvatar = useAppStore((s) => s.currentAvatar);
  const setCurrentAvatar = useAppStore((s) => s.setCurrentAvatar);

  if (avatars.length <= 1) return null;

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2 glass-panel rounded-2xl px-3 py-2 animate-slide-up"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {avatars.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => setCurrentAvatar(avatar)}
          className="relative w-12 h-12 rounded-xl overflow-hidden transition-all duration-200"
          style={{
            border: currentAvatar.id === avatar.id
              ? "2px solid var(--accent)"
              : "2px solid var(--border)",
            transform: currentAvatar.id === avatar.id ? "scale(1.1)" : "scale(1)",
            boxShadow: currentAvatar.id === avatar.id ? "var(--shadow-md)" : "none",
          }}
          title={avatar.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar.thumbnail}
            alt={avatar.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-xs font-bold" style="background:var(--surface-muted);color:var(--text-secondary)">${avatar.name[0]}</span>`;
            }}
          />
        </button>
      ))}
    </div>
  );
}
