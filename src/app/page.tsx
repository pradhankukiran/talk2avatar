"use client";

import dynamic from "next/dynamic";
import { ChatPanel } from "@/components/ChatPanel";
import { AvatarSelector } from "@/components/AvatarSelector";

const AvatarViewer = dynamic(
  () => import("@/components/AvatarViewer").then((m) => ({ default: m.AvatarViewer })),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden avatar-canvas-wrapper">
      {/* Branding */}
      <div className="absolute top-5 left-6 z-10">
        <span
          className="text-[24px] font-bold tracking-tight"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-sans), sans-serif" }}
        >
          talk2avatar
        </span>
      </div>

      {/* 3D Avatar Viewer — full background */}
      <div className="absolute inset-0">
        <AvatarViewer />
        <AvatarSelector />
      </div>

      {/* Chat Panel — floating overlay on right */}
      <div className="absolute right-0 top-0 bottom-0 w-[400px] max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:w-full max-md:h-[55vh] z-10">
        <ChatPanel />
      </div>
    </div>
  );
}
