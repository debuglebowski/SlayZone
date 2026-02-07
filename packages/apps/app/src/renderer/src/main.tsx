import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@slayzone/settings'
import { PtyProvider } from '@slayzone/terminal'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <PtyProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </PtyProvider>
)
