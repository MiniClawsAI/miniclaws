import type { RegisteredTool, ToolResult } from '../tool-registry'
import { captureScreen } from '../system-api'

const PERMISSION_MSG =
  'SCREEN_PERMISSION_NEEDED: I need your permission to see your screen! ' +
  'I just opened the privacy settings for you — enable MiniClaws (or the Electron app) ' +
  'in the Screen Recording list, then restart me and I\'ll be able to see your screen.'

export const seeScreenTool: RegisteredTool = {
  name: 'see_screen',
  version: '1.0.0',
  description:
    'Capture a screenshot of the user\'s screen to see what they are currently looking at.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  permissions: {
    system: { screen: true }
  },
  destructive: false,
  statusMessage: 'Looking at your screen...',

  async handler(): Promise<ToolResult> {
    try {
      const capture = await captureScreen({ maxWidth: 1280, quality: 80 })
      return {
        type: 'image',
        mimeType: capture.mimeType,
        base64: capture.base64,
        text: `Screenshot captured (${capture.width}×${capture.height})`
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'PERMISSION_DENIED') {
        return PERMISSION_MSG
      }
      return `Screen capture failed: ${msg}`
    }
  }
}
