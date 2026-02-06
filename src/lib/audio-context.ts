"use client";

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

export async function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}
