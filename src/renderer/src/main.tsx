import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)
