import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { PtyProvider } from './contexts/PtyContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <PtyProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </PtyProvider>
)
