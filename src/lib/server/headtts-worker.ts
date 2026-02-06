import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

type HeadTtsDevice = "webgpu" | "cpu" | "wasm";

type WorkerMessage = {
  type?: string;
  ref?: number;
  data?: {
    audio?: ArrayBuffer | ArrayBufferView;
    visemes?: string[];
    vtimes?: number[];
    vdurations?: number[];
    error?: string;
  };
};

type PendingRequest = {
  resolve: (data: NonNullable<WorkerMessage["data"]>) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type HeadTtsServerState = {
  worker: Worker | null;
  ready: boolean;
  readyPromise: Promise<void> | null;
  device: HeadTtsDevice | null;
  nextId: number;
  pending: Map<number, PendingRequest>;
};

declare global {
  var __headttsServerState: HeadTtsServerState | undefined;
}

function getState(): HeadTtsServerState {
  if (!global.__headttsServerState) {
    global.__headttsServerState = {
      worker: null,
      ready: false,
      readyPromise: null,
      device: null,
      nextId: 1,
      pending: new Map(),
    };
  }
  return global.__headttsServerState;
}

function clearPending(state: HeadTtsServerState, error: Error) {
  for (const [, req] of state.pending) {
    clearTimeout(req.timeout);
    req.reject(error);
  }
  state.pending.clear();
}

function isDebugEnabled(): boolean {
  if (process.env.HEADTTS_DEBUG === "1") return true;
  if (process.env.HEADTTS_DEBUG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function debugLog(message: string, details?: Record<string, unknown>) {
  if (!isDebugEnabled()) return;
  if (details) {
    console.log(`[HeadTTS] ${message}`, details);
    return;
  }
  console.log(`[HeadTTS] ${message}`);
}

function previewText(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

function parseDevicePriority(): HeadTtsDevice[] {
  const value = process.env.HEADTTS_DEVICE_PRIORITY?.trim();
  const defaultDevices: HeadTtsDevice[] = ["cpu"];
  if (!value) return defaultDevices;

  const parsed = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is HeadTtsDevice => (
      part === "webgpu" || part === "cpu" || part === "wasm"
    ));

  let unique = Array.from(new Set(parsed));
  if (unique.length === 0) return defaultDevices;

  const forceWebGpu = process.env.HEADTTS_FORCE_WEBGPU === "1";
  if (!forceWebGpu && unique.includes("webgpu")) {
    console.warn(
      "[HeadTTS] Skipping 'webgpu' device in Node runtime; this backend currently supports cpu/cuda only. Set HEADTTS_FORCE_WEBGPU=1 to force attempts."
    );
    unique = unique.filter((device) => device !== "webgpu");
  }

  if (!unique.includes("cpu")) unique.push("cpu");
  return unique.length > 0 ? unique : defaultDevices;
}

function withRuntimeHint(message: string): string {
  const nodeVersion = process.versions.node;
  if (message.includes("Cannot find package") && message.includes("@huggingface/transformers")) {
    return `${message} HeadTTS may have created a local cache-only folder that shadows the real transformers package. This build now pins an explicit transformers.node.mjs path.`;
  }
  if (message.includes("ERR_DLOPEN_FAILED")) {
    return `${message} Native addon load failed for onnxruntime-node on Node ${nodeVersion}. Reinstall dependencies for this runtime and verify compatible prebuilt binaries are available.`;
  }
  if (message.includes("Importing modules failed")) {
    return `${message} Check the preceding 'HeadTTS Worker' error log for the specific root cause (module resolution vs native addon load).`;
  }
  return message;
}

function resolveTransformersModule(): string {
  const candidates = [
    path.join(
      process.cwd(),
      "node_modules",
      "@huggingface",
      "transformers",
      "dist",
      "transformers.node.mjs"
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "@met4citizen",
      "headtts",
      "node_modules",
      "@huggingface",
      "transformers",
      "dist",
      "transformers.node.mjs"
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return "@huggingface/transformers";
}

function makeConnectData(device: HeadTtsDevice) {
  const pkgRoot = path.join(process.cwd(), "node_modules", "@met4citizen", "headtts");
  const transformersModule = resolveTransformersModule();

  return {
    transformersModule,
    model: "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped",
    dtype: "q4",
    device,
    styleDim: 256,
    frameRate: 40,
    audioSampleRate: 24000,
    languages: ["en-us"],
    dictionaryPath: path.join(pkgRoot, "dictionaries"),
    voicePath: path.join(process.cwd(), "public", "headtts", "voices"),
    voices: ["af_bella"],
    deltaStart: -10,
    deltaEnd: 10,
    trace: 0,
  };
}

function getWorkerPath(): string {
  return path.join(
    process.cwd(),
    "node_modules",
    "@met4citizen",
    "headtts",
    "modules",
    "worker-tts.mjs"
  );
}

async function connectWorkerForDevice(device: HeadTtsDevice): Promise<void> {
  const state = getState();
  const workerPath = getWorkerPath();
  const startedAt = Date.now();

  debugLog("connect attempt started", {
    device,
    workerPath,
    pid: process.pid,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const connectTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`HeadTTS worker connect timed out for device '${device}'.`));
    }, 180_000);

    const worker = new Worker(workerPath);
    state.worker = worker;

    const finalizeAsError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);
      reject(error);
    };

    worker.on("message", (raw: unknown) => {
      const message = raw as WorkerMessage;

      if (message.type === "ready") {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimeout);
          state.ready = true;
          state.device = device;
          debugLog("worker ready", {
            device,
            startupMs: Date.now() - startedAt,
          });
          resolve();
        }
        return;
      }

      if (typeof message.ref === "number") {
        const req = state.pending.get(message.ref);
        if (!req) return;

        state.pending.delete(message.ref);
        clearTimeout(req.timeout);

        if (message.type === "audio" && message.data) {
          req.resolve(message.data);
          return;
        }

        const msg = message.data?.error || "HeadTTS synthesis failed.";
        req.reject(new Error(msg));
      }
    });

    worker.on("error", (error) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      finalizeAsError(normalizedError);
      state.ready = false;
      state.device = null;
      state.worker = null;
      clearPending(state, normalizedError);
    });

    worker.on("exit", (code) => {
      const exitError = new Error(`HeadTTS worker exited with code ${code}`);
      if (!settled && code !== 0) {
        finalizeAsError(exitError);
      }
      state.ready = false;
      state.device = null;
      state.worker = null;
      clearPending(state, exitError);
    });

    worker.postMessage({
      type: "connect",
      data: makeConnectData(device),
    });
  });
}

async function ensureWorkerReady(): Promise<void> {
  const state = getState();
  if (state.ready && state.worker) return;
  if (state.readyPromise) {
    await state.readyPromise;
    return;
  }

  const devices = parseDevicePriority();
  const readyPromise = (async () => {
    let lastError: Error | null = null;

    debugLog("initializing worker with device priority", {
      devices,
      pendingRequests: state.pending.size,
    });

    for (const device of devices) {
      state.ready = false;
      state.device = null;

      try {
        await connectWorkerForDevice(device);
        return;
      } catch (error) {
        const rawError = error instanceof Error ? error : new Error(String(error));
        lastError = new Error(withRuntimeHint(rawError.message));
        console.warn(`[HeadTTS] device '${device}' failed, trying next fallback`, {
          error: lastError.message,
        });

        if (state.worker) {
          try {
            await state.worker.terminate();
          } catch {
            // ignore terminate errors
          }
          state.worker = null;
        }
      }
    }

    state.ready = false;
    state.device = null;
    throw new Error(
      `Failed to initialize HeadTTS on any device (${devices.join(", ")}): ${lastError?.message ?? "unknown error"}`
    );
  })();

  state.readyPromise = readyPromise;
  try {
    await readyPromise;
  } finally {
    if (state.readyPromise === readyPromise) {
      state.readyPromise = null;
    }
  }
}

export function getHeadTtsRuntimeInfo() {
  const state = getState();
  return {
    ready: state.ready,
    device: state.device,
    pendingRequests: state.pending.size,
  };
}

export type HeadTtsAudioResult = {
  audio: ArrayBuffer | ArrayBufferView;
  visemes: string[];
  vtimes: number[];
  vdurations: number[];
};

export async function synthesizeHeadTTS(text: string): Promise<HeadTtsAudioResult> {
  await ensureWorkerReady();
  const state = getState();
  const worker = state.worker;
  const device = state.device;

  if (!worker || !state.ready) {
    throw new Error("HeadTTS worker is not ready.");
  }

  const id = state.nextId++;
  const startedAt = Date.now();

  debugLog("synthesize started", {
    requestId: id,
    device,
    textLength: text.length,
    preview: previewText(text),
  });

  return new Promise<HeadTtsAudioResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pending.delete(id);
      console.error("[HeadTTS] synthesize timed out", {
        requestId: id,
        device,
        timeoutMs: 180_000,
        textLength: text.length,
        preview: previewText(text),
      });
      reject(new Error("HeadTTS synthesis timed out."));
    }, 180_000);

    state.pending.set(id, {
      resolve: (data) => {
        const audio = data.audio;
        if (!audio) {
          console.error("[HeadTTS] synthesize missing audio", {
            requestId: id,
            device,
            elapsedMs: Date.now() - startedAt,
            textLength: text.length,
          });
          reject(new Error("HeadTTS response did not include audio."));
          return;
        }
        debugLog("synthesize completed", {
          requestId: id,
          device,
          elapsedMs: Date.now() - startedAt,
          textLength: text.length,
          visemeCount: data.visemes?.length ?? 0,
        });
        resolve({
          audio,
          visemes: data.visemes ?? [],
          vtimes: data.vtimes ?? [],
          vdurations: data.vdurations ?? [],
        });
      },
      reject: (error) => {
        console.error("[HeadTTS] synthesize failed", {
          requestId: id,
          device,
          elapsedMs: Date.now() - startedAt,
          textLength: text.length,
          preview: previewText(text),
          error: error.message,
        });
        reject(error);
      },
      timeout,
    });

    worker.postMessage({
      type: "synthesize",
      id,
      data: {
        input: text,
        voice: "af_bella",
        language: "en-us",
        speed: 1,
        audioEncoding: "wav",
      },
    });
  });
}
