import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './domains/settings/context/ThemeContext'
import { PtyProvider } from './domains/terminal/context/PtyContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <PtyProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </PtyProvider>
)
