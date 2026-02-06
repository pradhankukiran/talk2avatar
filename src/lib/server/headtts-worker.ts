import path from "node:path";
import { Worker } from "node:worker_threads";

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
  nextId: number;
  pending: Map<number, PendingRequest>;
};

declare global {
  // eslint-disable-next-line no-var
  var __headttsServerState: HeadTtsServerState | undefined;
}

function getState(): HeadTtsServerState {
  if (!global.__headttsServerState) {
    global.__headttsServerState = {
      worker: null,
      ready: false,
      readyPromise: null,
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

function makeConnectData() {
  const pkgRoot = path.join(process.cwd(), "node_modules", "@met4citizen", "headtts");

  return {
    transformersModule: "@huggingface/transformers",
    model: "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped",
    dtype: "q4",
    device: "cpu",
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

async function ensureWorkerReady(): Promise<void> {
  const state = getState();
  if (state.ready && state.worker) return;
  if (state.readyPromise) {
    await state.readyPromise;
    return;
  }

  const workerPath = getWorkerPath();

  const readyPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const connectTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      state.ready = false;
      reject(new Error("HeadTTS server worker connect timed out."));
    }, 180_000);

    const worker = new Worker(workerPath);
    state.worker = worker;

    worker.on("message", (raw: unknown) => {
      const message = raw as WorkerMessage;

      if (message.type === "ready") {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimeout);
          state.ready = true;
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
      if (!settled) {
        settled = true;
        clearTimeout(connectTimeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
      state.ready = false;
      state.worker = null;
      clearPending(state, error instanceof Error ? error : new Error(String(error)));
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        clearTimeout(connectTimeout);
        reject(new Error(`HeadTTS worker exited with code ${code}`));
      }
      state.ready = false;
      state.worker = null;
      clearPending(state, new Error(`HeadTTS worker exited with code ${code}`));
    });

    worker.postMessage({
      type: "connect",
      data: makeConnectData(),
    });
  });

  state.readyPromise = readyPromise;
  try {
    await readyPromise;
  } finally {
    if (state.readyPromise === readyPromise) {
      state.readyPromise = null;
    }
  }
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

  if (!worker || !state.ready) {
    throw new Error("HeadTTS worker is not ready.");
  }

  const id = state.nextId++;

  return new Promise<HeadTtsAudioResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pending.delete(id);
      reject(new Error("HeadTTS synthesis timed out."));
    }, 180_000);

    state.pending.set(id, {
      resolve: (data) => {
        const audio = data.audio;
        if (!audio) {
          reject(new Error("HeadTTS response did not include audio."));
          return;
        }
        resolve({
          audio,
          visemes: data.visemes ?? [],
          vtimes: data.vtimes ?? [],
          vdurations: data.vdurations ?? [],
        });
      },
      reject,
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
