import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LlmProvider } from "@/types";

const groq = createOpenAICompatible({
  name: "groq",
  baseURL: "https://api.groq.com/openai/v1",
  headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
});

const cerebras = createOpenAICompatible({
  name: "cerebras",
  baseURL: "https://api.cerebras.ai/v1",
  headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
});

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
});

const providers: Record<LlmProvider, { instance: typeof groq; model: string }> = {
  groq: { instance: groq, model: "openai/gpt-oss-120b" },
  cerebras: { instance: cerebras, model: "gpt-oss-120b" },
  openrouter: { instance: openrouter, model: "gpt-oss-120b" },
};

const SYSTEM_PROMPT = `You are a friendly, conversational AI assistant. Keep your responses short and natural — typically 1-3 sentences. Speak as if you're having a casual chat. Do NOT use markdown formatting, bullet points, or lists. Do not use asterisks or any special formatting. Just plain conversational text.`;

export async function POST(req: Request) {
  try {
    const { messages, provider: providerName = "groq" } = await req.json();

    const selected = providers[providerName as LlmProvider] ?? providers.groq;

    const result = streamText({
      model: selected.instance.chatModel(selected.model),
      system: SYSTEM_PROMPT,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get LLM response. Check your API key and try again." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
