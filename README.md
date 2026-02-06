# talk2avatar — 3D Avatar Chat App

A web app where you speak to a 3D VRM avatar via microphone. The avatar responds with lip-synced speech.

**Pipeline:** User speaks → STT (Web Speech API) → LLM (Groq/Cerebras/OpenRouter) → TTS (HeadTTS/Kokoro) → Avatar speaks with mouth animation

## Prerequisites

1. **Node.js 20+** (Node 20 LTS recommended for the most stable native TTS runtime)
2. **API key** for at least one LLM provider: [Groq](https://console.groq.com/), [Cerebras](https://cloud.cerebras.ai/), or [OpenRouter](https://openrouter.ai/)
3. **Modern desktop browser** (for audio playback and microphone support)

## Getting Started

```bash
cp .env.example .env.local
# Fill in your API keys in .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

First run can take longer while the TTS worker initializes and loads voice model assets.

## TTS Device & Debugging

- Server-side TTS runs on CPU via `/api/tts`
- `HEADTTS_DEBUG=1` enables detailed server-side worker/device timing logs
- `NEXT_PUBLIC_TTS_DEBUG=1` enables client pipeline and TTS timing logs in browser console

If you see `Module did not self-register` or `Importing modules failed` in TTS logs, inspect the preceding `HeadTTS Worker` error line for the exact import/native binding cause.

## Usage

- Type a message or click the microphone button to speak
- The avatar will respond with lip-synced speech
- Switch LLM providers using the dropdown in the chat header
- Switch avatars using the thumbnail selector (when multiple avatars are available)

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **React Three Fiber** + **@pixiv/three-vrm** for 3D avatar rendering
- **Groq / Cerebras / OpenRouter** (Llama 3.3 70B) via Vercel AI SDK for LLM
- **HeadTTS** (Kokoro model) for TTS with viseme timing data
- **Web Speech API** for speech-to-text
- **Zustand** for state management
- **Tailwind CSS** for styling
