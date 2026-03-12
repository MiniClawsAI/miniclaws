import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIConfig, Message } from '../../electron/ipc/ai'

export type CharacterEmotion = 'idle' | 'talking' | 'thinking' | 'happy' | 'surprised' | 'wave'

interface CompanionStore {
  // ── AI Config ─────────────────────────────────────────────
  aiConfig: AIConfig
  setAIConfig: (config: Partial<AIConfig>) => void

  // ── Chat ─────────────────────────────────────────────────
  messages: Message[]
  addMessage: (msg: Message) => void
  clearMessages: () => void
  isStreaming: boolean
  setStreaming: (v: boolean) => void
  streamingText: string
  appendStreamText: (chunk: string) => void
  clearStreamText: () => void

  // ── Character ────────────────────────────────────────────
  emotion: CharacterEmotion
  setEmotion: (e: CharacterEmotion) => void
  isChatOpen: boolean
  setChatOpen: (v: boolean) => void
  speechText: string
  setSpeechText: (t: string) => void
  vrmPath: string | null
  setVrmPath: (p: string | null) => void
  characterId: string
  setCharacterId: (id: string) => void
}

export const useStore = create<CompanionStore>()(
  persist(
    (set) => ({
      // ── AI Config defaults ────────────────────────────────
      aiConfig: {
        provider: 'anthropic',
        apiKey: '',
        model: 'claude-haiku-4-5-20251001',
        systemPrompt:
          "You are a friendly 3D desktop companion. Be helpful, witty, and concise — 1-3 sentences unless asked for more. You live on the user's desktop and assist them throughout the day.",
        webSearchEnabled: true,
        tavilyApiKey: ''
      },
      setAIConfig: (config) =>
        set((s) => ({ aiConfig: { ...s.aiConfig, ...config } })),

      // ── Chat ─────────────────────────────────────────────
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),
      isStreaming: false,
      setStreaming: (v) => set({ isStreaming: v }),
      streamingText: '',
      appendStreamText: (chunk) =>
        set((s) => ({ streamingText: s.streamingText + chunk })),
      clearStreamText: () => set({ streamingText: '' }),

      // ── Character ────────────────────────────────────────
      emotion: 'idle',
      setEmotion: (e) => set({ emotion: e }),
      isChatOpen: false,
      setChatOpen: (v) => set({ isChatOpen: v }),
      speechText: '',
      setSpeechText: (t) => set({ speechText: t }),
      vrmPath: null,
      setVrmPath: (p) => set({ vrmPath: p }),
      characterId: 'default',
      setCharacterId: (id) => set({ characterId: id })
    }),
    {
      name: 'companion-store',
      partialize: (s) => ({
        aiConfig: s.aiConfig,
        messages: s.messages.slice(-50), // keep last 50
        vrmPath: s.vrmPath,
        characterId: s.characterId
      })
    }
  )
)
