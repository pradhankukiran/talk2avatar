export type LlmProvider = "groq" | "cerebras" | "openrouter";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Avatar {
  id: string;
  name: string;
  vrmPath: string;
  thumbnail: string;
  type: "rpm" | "vroid";
}

export type OculusViseme =
  | "sil"
  | "PP"
  | "FF"
  | "TH"
  | "DD"
  | "kk"
  | "CH"
  | "SS"
  | "nn"
  | "RR"
  | "aa"
  | "E"
  | "I"
  | "O"
  | "U";

export interface AudioSegment {
  audio: AudioBuffer;
  visemes: OculusViseme[];
  vtimes: number[];
  vdurations: number[];
}

export type PipelineStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export interface VisemeWeights {
  [blendShapeName: string]: number;
}
