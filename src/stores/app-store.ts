import { create } from "zustand";
import type { Avatar, ChatMessage, LlmProvider, PipelineStatus } from "@/types";
import { avatars } from "@/lib/avatars";

interface AppState {
  // Avatar
  currentAvatar: Avatar;
  setCurrentAvatar: (avatar: Avatar) => void;

  // Messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;

  // Pipeline status
  pipelineStatus: PipelineStatus;
  setPipelineStatus: (status: PipelineStatus) => void;

  // TTS ready state
  ttsReady: boolean;
  setTtsReady: (ready: boolean) => void;

  // TTS loading progress
  ttsProgress: number;
  setTtsProgress: (progress: number) => void;

  // LLM provider
  currentProvider: LlmProvider;
  setCurrentProvider: (provider: LlmProvider) => void;

  // Model loaded
  modelLoaded: boolean;
  setModelLoaded: (loaded: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentAvatar: avatars[0],
  setCurrentAvatar: (avatar) => set({ currentAvatar: avatar }),

  messages: [],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      return { messages: msgs };
    }),

  pipelineStatus: "idle",
  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  ttsReady: false,
  setTtsReady: (ready) => set({ ttsReady: ready }),

  ttsProgress: 0,
  setTtsProgress: (progress) => set({ ttsProgress: progress }),

  currentProvider: "groq",
  setCurrentProvider: (provider) => set({ currentProvider: provider }),

  modelLoaded: false,
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),

  error: null,
  setError: (error) => set({ error }),
}));
