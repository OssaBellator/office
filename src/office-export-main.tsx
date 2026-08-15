import React from 'react'
import ReactDOM from 'react-dom/client'
import OfficeExportPage from './OfficeExportPage'
import './styles.css'
import './workspace-tools.css'
import './office-export-page.css'

ReactDOM.createRoot(document.getElementById('office-export-root')!).render(
  <React.StrictMode><OfficeExportPage /></React.StrictMode>,
)
