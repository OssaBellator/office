import React from 'react'
import ReactDOM from 'react-dom/client'
import OfficeImportPage from './OfficeImportPage'
import './styles.css'
import './workspace-tools.css'
import './governance-ui.css'
import './office-import-page.css'

ReactDOM.createRoot(document.getElementById('office-import-root')!).render(
  <React.StrictMode><OfficeImportPage /></React.StrictMode>,
)
