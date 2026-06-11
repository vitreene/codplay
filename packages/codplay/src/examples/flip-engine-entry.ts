import './flip-engine-example.css'

import { mountFlipEngineDomExample } from './flip-engine-dom-example'

const app = document.querySelector<HTMLElement>('#app')
if (app) {
  mountFlipEngineDomExample(app)
}
