import { NextResponse } from "next/server";
import { synthesizeHeadTTS } from "@/lib/server/headtts-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBase64Audio(audio: ArrayBuffer | ArrayBufferView): string {
  if (audio instanceof ArrayBuffer) {
    return Buffer.from(audio).toString("base64");
  }
  return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength).toString("base64");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const result = await synthesizeHeadTTS(text);

    return NextResponse.json({
      audioBase64: toBase64Audio(result.audio),
      visemes: result.visemes,
      vtimes: result.vtimes,
      vdurations: result.vdurations,
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "TTS synthesis failed." },
      { status: 503 }
    );
  }
}
