# 🧑‍💻 Companion — 3D AI Desktop Character

A floating 3D desktop companion powered by your AI API of choice.
Built with Electron + React Three Fiber + VRM + Zustand.

---

## Quick Start

```bash
npm install
npm run dev
```

---

## Adding Your API Key

Right-click the character → **Settings**, then:

| Provider  | Where to get key | Default model |
|-----------|-----------------|---------------|
| Anthropic | console.anthropic.com | claude-haiku-4-5-20251001 |
| OpenAI    | platform.openai.com   | gpt-4o-mini |
| Ollama    | localhost (no key)    | llama3.2 |

---

## Loading a VRM Character

1. Download a free `.vrm` from [VRoid Hub](https://hub.vroid.com) or make one in [VRoid Studio](https://vroid.com/en/studio) (free)
2. Right-click the character → **Load VRM model**
3. Select your `.vrm` file

Without a VRM, a friendly geometric placeholder is shown.

---

## Project Structure

```
companion/
├── electron/
│   ├── main.ts          ← Transparent window + always-on-top config
│   ├── preload.ts       ← Secure IPC bridge (window.electron)
│   └── ipc/
│       └── ai.ts        ← Streaming AI: Anthropic / OpenAI / Ollama
│
└── src/
    ├── App.tsx           ← Layout: character + slide-up chat
    ├── store/index.ts    ← Zustand store (chat, emotion, AI config)
    └── components/
        ├── Character/
        │   ├── CharacterScene.tsx  ← R3F Canvas, drag-to-move
        │   ├── VRMAvatar.tsx       ← VRM loader, expressions, blink
        │   ├── PlaceholderChar.tsx ← Geometric fallback character
        │   └── SpeechBubble.tsx    ← Floating speech overlay
        └── Chat/
            ├── ChatPanel.tsx       ← Chat UI with streaming
            ├── ContextMenu.tsx     ← Right-click menu
            └── SettingsPanel.tsx   ← AI provider config
```

---

## Interactions

| Action | Effect |
|--------|--------|
| Click character | Toggle chat panel |
| Drag character  | Move window anywhere on screen |
| Right-click     | Context menu (settings, VRM, provider, quit) |
| Enter           | Send message |
| Shift+Enter     | New line in chat |

---

## Packaging

```bash
npm run package        # current platform
npm run package:mac    # macOS DMG (arm64 + x64)
npm run package:win    # Windows NSIS installer
npm run package:linux  # Linux AppImage
```

---

## Swapping AI Providers at Runtime

Right-click → switch provider. The change is instant — no restart needed.
The API key and model are persisted across sessions via localStorage.

---

## Customising the Character

Expressions available in `VRMAvatar.tsx` map to VRM blend shapes:
`Happy`, `Angry`, `Relaxed`, `Surprised`, `Blink_L`, `Blink_R`, `Aa`

Expression names vary by model. Check your VRM's blend shape names if
expressions don't work and update the constants at the top of `VRMAvatar.tsx`.
