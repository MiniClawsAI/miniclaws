import { useState } from 'react'
import { useStore } from '../../store'
import styles from './SettingsPanel.module.css'

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

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { aiConfig, setAIConfig } = useStore()
  const [local, setLocal] = useState({
    ...aiConfig,
    model: validModel(aiConfig.provider, aiConfig.model)
  })

  const save = () => {
    setAIConfig(local)
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

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
            placeholder={local.provider === 'ollama' ? 'Not needed for Ollama' : local.provider === 'gemini' ? 'AIza...' : 'sk-...'}
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

        <div className={styles.field}>
          <label className={styles.toggleRow}>
            <span>Web search</span>
            <input
              type="checkbox"
              checked={local.webSearchEnabled ?? true}
              onChange={(e) => setLocal({ ...local, webSearchEnabled: e.target.checked })}
            />
          </label>
          <span className={styles.hint}>
            Uses free DuckDuckGo search by default. Add a Tavily key below for better results.
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
              Free tier at tavily.com — 1,000 searches/month
            </span>
          </div>
        )}

        <div className={styles.field}>
          <label>System prompt</label>
          <textarea
            rows={4}
            value={local.systemPrompt || ''}
            onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
            placeholder="Describe how MiniClaws should behave..."
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose}>Cancel</button>
          <button className={styles.save} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
