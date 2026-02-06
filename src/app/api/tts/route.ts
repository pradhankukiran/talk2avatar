import { NextResponse } from "next/server";
import { getHeadTtsRuntimeInfo, synthesizeHeadTTS } from "@/lib/server/headtts-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBase64Audio(audio: ArrayBuffer | ArrayBufferView): string {
  if (audio instanceof ArrayBuffer) {
    return Buffer.from(audio).toString("base64");
  }
  return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength).toString("base64");
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const debugEnabled = process.env.HEADTTS_DEBUG === "1" || process.env.NODE_ENV !== "production";
  try {
    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const result = await synthesizeHeadTTS(text);
    const runtime = getHeadTtsRuntimeInfo();
    const elapsedMs = Date.now() - startedAt;

    if (process.env.HEADTTS_DEBUG === "1" || process.env.NODE_ENV !== "production") {
      console.log("[TTS API] synthesis success", {
        elapsedMs,
        textLength: text.length,
        device: runtime.device,
        pendingRequests: runtime.pendingRequests,
        visemeCount: result.visemes.length,
      });
    }

    return NextResponse.json({
      audioBase64: toBase64Audio(result.audio),
      visemes: result.visemes,
      vtimes: result.vtimes,
      vdurations: result.vdurations,
      ttsDevice: runtime.device,
      elapsedMs,
    });
  } catch (error) {
    const runtime = getHeadTtsRuntimeInfo();
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error("TTS API error:", error);
    console.error("[TTS API] synthesis failure", {
      elapsedMs,
      device: runtime.device,
      pendingRequests: runtime.pendingRequests,
      error: message,
    });
    const payload: { error: string; details?: string } = { error: "TTS synthesis failed." };
    if (debugEnabled) {
      payload.details = message;
    }
    return NextResponse.json(
      payload,
      { status: 503 }
    );
  }
}
