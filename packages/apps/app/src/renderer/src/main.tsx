import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@omgslayzone/settings'
import { PtyProvider } from '@omgslayzone/terminal'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <PtyProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </PtyProvider>
)
