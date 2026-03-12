import { useState } from 'react'
import { useStore } from '../../store'
import styles from './SettingsPage.module.css'

const MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku' },
    { value: 'claude-sonnet-4-5-20251001', label: 'Claude 4.5 Sonnet' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
}

function validModel(provider: string, model?: string): string {
  const list = MODELS[provider]
  if (!list) return model || ''
  if (model && list.some((m) => m.value === model)) return model
  return list[0].value
}

export function SettingsPage() {
  const { aiConfig, setAIConfig } = useStore()
  const [local, setLocal] = useState({
    ...aiConfig,
    model: validModel(aiConfig.provider, aiConfig.model),
    webSearchEnabled: aiConfig.webSearchEnabled ?? true
  })
  const [saved, setSaved] = useState(false)

  const save = () => {
    setAIConfig(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      {/* ── LLM Provider Section ─────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>LLM Provider</h2>

        <div className={styles.field}>
          <label>Provider</label>
          <select
            value={local.provider}
            onChange={(e) => {
              const provider = e.target.value as any
              const models = MODELS[provider]
              setLocal({ ...local, provider, model: models ? models[0].value : '' })
            }}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google (Gemini)</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>

        <div className={styles.field}>
          <label>API Key</label>
          <input
            type="password"
            placeholder={
              local.provider === 'ollama' ? 'Not needed for Ollama'
              : local.provider === 'gemini' ? 'AIza...'
              : 'sk-...'
            }
            value={local.apiKey || ''}
            onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
            disabled={local.provider === 'ollama'}
          />
        </div>

        <div className={styles.field}>
          <label>Model</label>
          {MODELS[local.provider] ? (
            <select
              value={validModel(local.provider, local.model)}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
            >
              {MODELS[local.provider].map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="llama3.2"
              value={local.model || ''}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
            />
          )}
        </div>

        {local.provider === 'ollama' && (
          <div className={styles.field}>
            <label>Ollama URL</label>
            <input
              type="text"
              placeholder="http://localhost:11434"
              value={local.baseUrl || ''}
              onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
            />
          </div>
        )}
      </section>

      {/* ── Web Search Section ───────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Web Search</h2>

        <div className={styles.field}>
          <label className={styles.toggleRow}>
            <span>Enable web search</span>
            <input
              type="checkbox"
              checked={local.webSearchEnabled}
              onChange={(e) => setLocal({ ...local, webSearchEnabled: e.target.checked })}
            />
          </label>
          <span className={styles.hint}>
            Uses free DuckDuckGo search by default
          </span>
        </div>

        {local.webSearchEnabled && (
          <div className={styles.field}>
            <label>Tavily API key <span className={styles.optional}>(optional)</span></label>
            <input
              type="password"
              placeholder="tvly-... (leave blank for free search)"
              value={local.tavilyApiKey || ''}
              onChange={(e) => setLocal({ ...local, tavilyApiKey: e.target.value })}
            />
            <span className={styles.hint}>
              Improves search quality. Free tier at tavily.com (1,000 searches/month)
            </span>
          </div>
        )}
      </section>

      {/* ── System Prompt Section ────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Behavior</h2>

        <div className={styles.field}>
          <label>System prompt</label>
          <textarea
            rows={5}
            value={local.systemPrompt || ''}
            onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
            placeholder="Describe how the companion should behave..."
          />
        </div>
      </section>

      {/* ── Save Button ──────────────────────────────────── */}
      <div className={styles.actions}>
        <button className={styles.save} onClick={save}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
