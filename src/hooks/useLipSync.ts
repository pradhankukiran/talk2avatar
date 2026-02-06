"use client";

import React, { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { AudioQueue } from "@/lib/audio-queue";
import {
  getSharedAudioContext,
  resumeSharedAudioContext,
} from "@/lib/audio-context";
import { getVisemeWeights } from "@/lib/viseme-mapping";
import { useAppStore } from "@/stores/app-store";
import type { AudioSegment, VisemeWeights } from "@/types";

// Shared audio queue reference accessible from outside React
let sharedAudioQueue: AudioQueue | null = null;

export function getAudioQueue(): AudioQueue {
  if (!sharedAudioQueue) {
    sharedAudioQueue = new AudioQueue(getSharedAudioContext(), () => {
      // When audio finishes, return to idle if nothing else is happening
      const store = useAppStore.getState();
      if (store.pipelineStatus === "speaking") {
        store.setPipelineStatus("idle");
      }
    });
  }
  return sharedAudioQueue;
}

export async function primeAudioPlayback() {
  getAudioQueue();
  try {
    await resumeSharedAudioContext();
  } catch (err) {
    console.warn("Failed to resume AudioContext:", err);
  }
}

export async function enqueueAudio(segment: AudioSegment) {
  const queue = getAudioQueue();
  await primeAudioPlayback();
  queue.enqueue(segment);
}

export function clearAudioQueue() {
  sharedAudioQueue?.clear();
}

/**
 * Hook that reads the current viseme from the audio queue each frame
 * and returns a ref to blend shape weights for the VRM model.
 * Callers must read `.current` inside useFrame to get the latest weights.
 */
export function useLipSync(): React.MutableRefObject<VisemeWeights> {
  const weightsRef = useRef<VisemeWeights>({});
  const getAvatarType = useCallback(
    () => useAppStore.getState().currentAvatar.type,
    []
  );

  const lastLogRef = useRef(0);

  useFrame(() => {
    if (!sharedAudioQueue) {
      weightsRef.current = {};
      return;
    }

    const viseme = sharedAudioQueue.getCurrentViseme();
    weightsRef.current = getVisemeWeights(viseme, getAvatarType());

    // Debug: log non-silent visemes (throttled to 1/sec)
    if (viseme !== "sil") {
      const now = Date.now();
      if (now - lastLogRef.current > 1000) {
        lastLogRef.current = now;
        console.debug("[LipSync] viseme:", viseme, "weights:", weightsRef.current);
      }
    }
  });

  return weightsRef;
}
