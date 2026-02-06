import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

type HeadTtsDevice = "cpu";
const requireFromHere = createRequire(import.meta.url);

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

function withRuntimeHint(message: string): string {
  const nodeVersion = process.versions.node;
  if (message.includes("worker-tts.mjs")) {
    return `${message} Missing HeadTTS worker file in deployment bundle. Add Next.js output file tracing includes for @met4citizen/headtts modules.`;
  }
  if (message.includes("Cannot find package") && message.includes("@huggingface/transformers")) {
    return `${message} HeadTTS may have created a local cache-only folder that shadows the real transformers package. This build now pins an explicit transformers.node.mjs path.`;
  }
  if (message.includes("ERR_DLOPEN_FAILED") || message.includes("did not self-register")) {
    return `${message} Native addon load failed for onnxruntime-node on Node ${nodeVersion}. Reinstall dependencies for this runtime and verify compatible prebuilt binaries are available.`;
  }
  if (message.includes("ENOENT") && message.includes("dictionaries")) {
    return `${message} Dictionary file path is missing in runtime bundle. Ensure the server points to '/public/headtts/dictionaries' and file tracing includes it.`;
  }
  if (message.includes("Importing modules failed")) {
    return `${message} Check the preceding 'HeadTTS Worker' error log for the specific root cause (module resolution vs native addon load).`;
  }
  return message;
}

function normalizeBundledPath(candidate: string): string {
  const prefix = "(rsc)/";
  if (candidate.startsWith(prefix)) {
    return path.join(process.cwd(), candidate.slice(prefix.length));
  }
  return candidate;
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

function resolveHeadTtsPackageRoot(): string {
  try {
    const pkgJson = requireFromHere.resolve("@met4citizen/headtts/package.json");
    return normalizeBundledPath(path.dirname(pkgJson));
  } catch {
    return path.join(process.cwd(), "node_modules", "@met4citizen", "headtts");
  }
}

function resolveDictionaryPath(pkgRoot: string): string {
  const candidates = [
    path.join(process.cwd(), "public", "headtts", "dictionaries"),
    path.join(pkgRoot, "dictionaries"),
    path.join(process.cwd(), "node_modules", "@met4citizen", "headtts", "dictionaries"),
  ].map(normalizeBundledPath);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "en-us.txt"))) {
      return candidate;
    }
  }

  return candidates[0];
}

function makeConnectData() {
  const pkgRoot = resolveHeadTtsPackageRoot();
  const dictionaryPath = resolveDictionaryPath(pkgRoot);
  const transformersModule = resolveTransformersModule();
  const voicePath = path.join(process.cwd(), "public", "headtts", "voices");
  const workerPath = getWorkerPath();

  debugLog("runtime context", {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    pid: process.pid,
  });
  debugLog("resolved paths", {
    workerPath,
    workerExists: fs.existsSync(workerPath),
    dictionaryPath,
    dictionaryExists: fs.existsSync(path.join(dictionaryPath, "en-us.txt")),
    transformersModule,
    voicePath,
    voiceExists: fs.existsSync(path.join(voicePath, "af_bella.bin")),
  });

  return {
    transformersModule,
    model: "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped",
    dtype: "q4",
    device: "cpu",
    styleDim: 256,
    frameRate: 40,
    audioSampleRate: 24000,
    languages: ["en-us"],
    dictionaryPath,
    voicePath,
    voices: ["af_bella"],
    deltaStart: -10,
    deltaEnd: 10,
    trace: 0,
  };
}

function getWorkerPath(): string {
  const pkgRoot = resolveHeadTtsPackageRoot();
  const candidates = [
    path.join(process.cwd(), "public", "headtts", "modules", "worker-tts.mjs"),
    path.join(pkgRoot, "modules", "worker-tts.mjs"),
    path.join(
      process.cwd(),
      "node_modules",
      "@met4citizen",
      "headtts",
      "modules",
      "worker-tts.mjs"
    ),
  ].map(normalizeBundledPath);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Cannot find module '${candidates[0]}'`
  );
}

function getOnnxRuntimeCandidates() {
  const base = path.join(process.cwd(), "node_modules", "onnxruntime-node", "bin", "napi-v3");
  const archPath = process.arch === "arm64"
    ? path.join(base, "linux", "arm64")
    : path.join(base, "linux", "x64");

  return {
    binding: path.join(archPath, "onnxruntime_binding.node"),
    coreLibV1: path.join(archPath, "libonnxruntime.so.1"),
    coreLibVersioned: path.join(archPath, "libonnxruntime.so.1.21.0"),
  };
}

async function connectWorker(): Promise<void> {
  const state = getState();
  const workerPath = getWorkerPath();
  const startedAt = Date.now();
  const device: HeadTtsDevice = "cpu";
  const ort = getOnnxRuntimeCandidates();

  debugLog("connect attempt started", {
    device,
    workerPath,
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    onnxBinding: ort.binding,
    onnxBindingExists: fs.existsSync(ort.binding),
    onnxCoreExists: fs.existsSync(ort.coreLibV1) || fs.existsSync(ort.coreLibVersioned),
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const connectTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("HeadTTS worker connect timed out."));
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
      data: makeConnectData(),
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

  const readyPromise = (async () => {
    state.ready = false;
    state.device = null;
    debugLog("initializing worker", {
      device: "cpu",
      pendingRequests: state.pending.size,
    });
    try {
      await connectWorker();
      return;
    } catch (error) {
      const rawError = error instanceof Error ? error : new Error(String(error));
      const hintedError = new Error(withRuntimeHint(rawError.message));
      console.warn("[HeadTTS] worker init failed", {
        device: "cpu",
        error: hintedError.message,
      });
      if (state.worker) {
        try {
          await state.worker.terminate();
        } catch {
          // ignore terminate errors
        }
        state.worker = null;
      }
      state.ready = false;
      state.device = null;
      throw new Error(`Failed to initialize HeadTTS worker: ${hintedError.message}`);
    }
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
