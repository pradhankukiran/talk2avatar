<p align="center">
  <h1 align="center">talk2avatar</h1>
  <p align="center">
    Real-time conversational AI with a 3D avatar that speaks back &mdash; lip-synced and streamed end-to-end.
  </p>
</p>

<p align="center">
  <a href="https://talk2avatar.vercel.app"><img alt="Live Demo" src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square&logo=vercel&logoColor=white"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r182-000?style=flat-square&logo=three.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white">
  <img alt="License" src="https://img.shields.io/github/license/pradhankukiran/talk2avatar?style=flat-square">
</p>

---

## Overview

talk2avatar is a full-stack web app that lets you have a real-time conversation with a 3D VRM avatar. You type or speak, an LLM responds with streaming tokens, each sentence is synthesized into speech with viseme timing data, and the avatar's lips move in sync &mdash; all pipelined with sub-second time-to-first-audio.

### Pipeline

```
Voice / Text  -->  LLM (streaming)  -->  TTS + Visemes  -->  3D Avatar Lip Sync
   input            Groq / Cerebras       Kokoro 82M          VRM + Three.js
                    / OpenRouter          (HeadTTS)           (React Three Fiber)
```

## Features

- **Streaming LLM** &mdash; Token-by-token responses via Groq, Cerebras, or OpenRouter (switchable at runtime)
- **Sentence-level TTS pipelining** &mdash; Sentences are split from the token stream and synthesized in parallel so speech starts before the full response arrives
- **Real-time lip sync** &mdash; Oculus-standard viseme weights applied per-frame to VRM blend shapes via `expressionManager`
- **Dual TTS engines** &mdash; Server-side ONNX Runtime for speed, client-side WASM fallback for resilience, browser `speechSynthesis` as last resort
- **3D avatar viewer** &mdash; VRM model loading with idle blink animation, cinematic camera reveal, and orbit controls
- **Speech input** &mdash; Browser-native speech-to-text via Web Speech API
- **Responsive glass UI** &mdash; Glass-morphism chat panel, provider tabs, TTS loading progress, animated status indicator

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Node.js runtime) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/) |
| 3D Rendering | [Three.js r182](https://threejs.org/), [React Three Fiber](https://docs.pmnd.rs/react-three-fiber), [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) |
| LLM | [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI-compatible providers (Groq, Cerebras, OpenRouter) |
| TTS | [HeadTTS](https://github.com/nickmilo/headtts) &mdash; Kokoro 82M ONNX model, server + WASM dual-engine |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Speech Input | [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting Started

### Prerequisites

- **Node.js 20+** (LTS recommended for stable native ONNX Runtime bindings)
- **API key** for at least one LLM provider: [Groq](https://console.groq.com/), [Cerebras](https://cloud.cerebras.ai/), or [OpenRouter](https://openrouter.ai/)
- Modern desktop browser with microphone support

### Install

```bash
git clone https://github.com/pradhankukiran/talk2avatar.git
cd talk2avatar
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Add your API keys in `.env.local`:

```env
GROQ_API_KEY=gsk_...
CEREBRAS_API_KEY=csk-...
OPENROUTER_API_KEY=sk-or-...
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click the microphone or type a message to start chatting.

> First run may take longer while the TTS worker initializes and downloads voice model assets.

## Project Structure

```
src/
  app/
    api/
      chat/route.ts          # Streaming LLM endpoint (Groq / Cerebras / OpenRouter)
      tts/route.ts            # Server-side TTS synthesis endpoint
    page.tsx                  # Main page layout
    layout.tsx                # Root layout with fonts
  components/
    AvatarViewer.tsx          # Three.js canvas, camera reveal, orbit controls
    VrmModel.tsx              # VRM loading, idle blink, per-frame lip sync
    ChatPanel.tsx             # Message list, provider tabs, status
    ChatInput.tsx             # Text input + microphone button
  hooks/
    useChat.ts                # Full pipeline: LLM stream -> sentence split -> TTS -> audio queue
    useTTS.ts                 # Server / client WASM / browser TTS fallback chain
    useLipSync.ts             # Per-frame viseme weight interpolation
    useSpeechRecognition.ts   # Web Speech API wrapper
  lib/
    audio-queue.ts            # FIFO audio playback with binary-search viseme tracking
    sentence-splitter.ts      # Streaming token accumulator with sentence boundary detection
    viseme-mapping.ts         # Oculus viseme -> VRM/RPM blend shape weight tables
    headtts-client.ts         # Browser-side HeadTTS singleton (WASM engine)
    audio-context.ts          # Shared AudioContext singleton
    server/
      headtts-worker.ts       # Node.js worker thread managing HeadTTS ONNX inference
  stores/
    app-store.ts              # Zustand global state
  types/
    index.ts                  # Shared type definitions
    headtts.d.ts              # HeadTTS type declarations
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | * | [Groq](https://console.groq.com/) API key |
| `CEREBRAS_API_KEY` | * | [Cerebras](https://cloud.cerebras.ai/) API key |
| `OPENROUTER_API_KEY` | * | [OpenRouter](https://openrouter.ai/) API key |
| `HEADTTS_DEBUG` | No | `1` to enable server-side TTS debug logs |
| `NEXT_PUBLIC_TTS_DEBUG` | No | `1` to enable client-side TTS debug logs |

\* At least one LLM provider key is required.

## Debugging TTS

- Server-side TTS runs on CPU via `/api/tts` using ONNX Runtime
- Set `HEADTTS_DEBUG=1` for detailed server worker and device timing logs
- Set `NEXT_PUBLIC_TTS_DEBUG=1` for client pipeline and TTS timing in browser console
- If you see `Module did not self-register` or `Importing modules failed`, inspect the preceding `HeadTTS Worker` error line for the root cause (module resolution vs native addon)

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpradhankukiran%2Ftalk2avatar&env=GROQ_API_KEY)

The TTS route runs on the Node.js serverless runtime. ONNX Runtime and HeadTTS assets are bundled via `outputFileTracingIncludes` in `next.config.ts`.

## License

[MIT](LICENSE)
