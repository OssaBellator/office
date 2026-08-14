import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WorkspaceApp from './WorkspaceApp'
import './styles.css'
import './history.css'
import './present.css'
import './presentation-player.css'
import './plan-presentation.css'
import './command-intent.css'
import './local-tools.css'
import './plan-model.css'
import './semantic-document.css'
import './relationship-chart.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceApp />
  </StrictMode>,
)
