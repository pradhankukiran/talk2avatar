declare module "@met4citizen/headtts" {
  export class HeadTTS {
    constructor(settings?: Record<string, unknown>, onerror?: ((err: Error) => void) | null);
    onstart: (() => void) | null;
    onmessage: ((message: HeadTTSMessage) => void) | null;
    onend: (() => void) | null;
    onerror: ((err: Error) => void) | null;
    connect(
      settings?: Record<string, unknown> | null,
      onprogress?: ((event: ProgressEvent) => void) | null,
      onerror?: ((err: Error) => void) | null
    ): Promise<void>;
    clear(): void;
    setup(data: Record<string, unknown>, onerror?: ((err: Error) => void) | null): Promise<void>;
    synthesize(
      data: { input: string | Array<string | Record<string, unknown>>; userData?: unknown },
      onmessage?: ((message: HeadTTSMessage) => void) | null,
      onerror?: ((err: Error) => void) | null
    ): Promise<HeadTTSMessage[]>;
    custom(
      data: Record<string, unknown>,
      onmessage?: ((message: HeadTTSMessage) => void) | null,
      onerror?: ((err: Error) => void) | null
    ): Promise<HeadTTSMessage>;
  }

  export interface HeadTTSMessage {
    type: "audio" | "error" | "custom";
    ref: number;
    data: {
      audio?: AudioBuffer;
      words?: string[];
      wtimes?: number[];
      wdurations?: number[];
      visemes?: string[];
      vtimes?: number[];
      vdurations?: number[];
      phonemes?: string[];
      audioEncoding?: string;
      error?: string;
    };
    userData?: unknown;
  }
}
