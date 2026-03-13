import { Fragment } from 'react'

/**
 * Renders text with URLs automatically converted to clickable links.
 * Links open in the user's default browser via Electron's shell.openExternal.
 */

const URL_REGEX = /(https?:\/\/[^\s<>"')\]},]+)/g

interface LinkifiedTextProps {
  text: string
}

export function LinkifiedText({ text }: LinkifiedTextProps) {
  const parts = text.split(URL_REGEX)

  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.electron.openExternal(part)
            }}
            style={{
              color: '#a78bfa',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(167,139,250,0.4)',
              cursor: 'pointer',
              wordBreak: 'break-all'
            }}
            title={part}
          >
            {formatUrl(part)}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

/** Show a shorter display label for long URLs. */
function formatUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    const display = u.hostname + path
    return display.length > 50 ? display.slice(0, 47) + '...' : display
  } catch {
    return url.length > 50 ? url.slice(0, 47) + '...' : url
  }
}
