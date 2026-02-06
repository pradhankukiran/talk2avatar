# talk2avatar — 3D Avatar Chat App

A web app where you speak to a 3D VRM avatar via microphone. The avatar responds with lip-synced speech.

**Pipeline:** User speaks → STT (Web Speech API) → LLM (Groq/Cerebras/OpenRouter) → TTS (HeadTTS/Kokoro) → Avatar speaks with mouth animation

## Prerequisites

1. **Node.js 20+**
2. **API key** for at least one LLM provider: [Groq](https://console.groq.com/), [Cerebras](https://cloud.cerebras.ai/), or [OpenRouter](https://openrouter.ai/)
3. **Chrome or Edge** recommended (WebGPU support for fast TTS). Firefox works with WASM fallback.

## Getting Started

```bash
cp .env.example .env.local
# Fill in your API keys in .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

First run downloads ~200MB voice model (cached in IndexedDB after).

## Usage

- Type a message or click the microphone button to speak
- The avatar will respond with lip-synced speech
- Switch LLM providers using the dropdown in the chat header
- Switch avatars using the thumbnail selector (when multiple avatars are available)

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **React Three Fiber** + **@pixiv/three-vrm** for 3D avatar rendering
- **Groq / Cerebras / OpenRouter** (Llama 3.3 70B) via Vercel AI SDK for LLM
- **HeadTTS** (Kokoro model) for browser-side TTS with viseme data
- **Web Speech API** for speech-to-text
- **Zustand** for state management
- **Tailwind CSS** for styling
