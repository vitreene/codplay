import { fileURLToPath } from 'node:url'
import base from '../../../vite.config.ts'

export default {
  ...base,
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  test: {
    include: [fileURLToPath(new URL('./probe-question-preview.probe.ts', import.meta.url))],
    environment: 'jsdom',
  },
}
