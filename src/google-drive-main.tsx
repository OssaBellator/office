import React from 'react'
import ReactDOM from 'react-dom/client'
import GoogleDriveImportPage from './GoogleDriveImportPage'
import './styles.css'
import './workspace-tools.css'
import './governance-ui.css'
import './google-drive-page.css'

ReactDOM.createRoot(document.getElementById('google-drive-root')!).render(
  <React.StrictMode><GoogleDriveImportPage /></React.StrictMode>,
)
