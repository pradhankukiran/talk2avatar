/**
 * HeadTTS singleton wrapper for browser-side TTS.
 * Lazily initialized on first use (requires user interaction for AudioContext).
 */

import { getSharedAudioContext } from "@/lib/audio-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let headttsInstance: any = null;
let initPromise: Promise<void> | null = null;

export async function getHeadTTS(
  onProgress?: (progress: number) => void
) {
  if (headttsInstance) return headttsInstance;
  if (initPromise) {
    await initPromise;
    return headttsInstance;
  }

  initPromise = (async () => {
    try {
      const { HeadTTS } = await import("@met4citizen/headtts");

      headttsInstance = new HeadTTS({
        endpoints: ["wasm"],
        audioCtx: getSharedAudioContext(),
        workerModule: "/headtts/modules/worker-tts.mjs",
        transformersModule: "/headtts/transformers/transformers.min.js",
        dictionaryURL: "/headtts/dictionaries",
        voiceURL: "/headtts/voices",
        languages: ["en-us"],
        voices: ["af_bella"],
        defaultVoice: "af_bella",
        defaultLanguage: "en-us",
        defaultSpeed: 1,
        defaultAudioEncoding: "wav",
      });

      await headttsInstance.connect(
        null,
        onProgress
          ? (e: ProgressEvent) => {
              if (e.lengthComputable && e.total > 0) {
                onProgress(Math.round((e.loaded / e.total) * 100));
              }
            }
          : null
      );

      await headttsInstance.setup({
        voice: "af_bella",
        language: "en-us",
        speed: 1,
        audioEncoding: "wav",
      });
    } catch (err) {
      headttsInstance = null;
      throw err;
    }
  })();

  try {
    await initPromise;
    return headttsInstance;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function isHeadTTSReady(): boolean {
  return headttsInstance !== null;
}
