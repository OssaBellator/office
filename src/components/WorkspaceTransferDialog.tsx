import { Database, Download, FileText, Presentation, Table2, Upload, X } from 'lucide-react'

export type WorkspaceTransferMode = 'export' | 'import'

export function WorkspaceTransferDialog({
  mode, onClose, onExportBackup, onExportStrategy, onExportBoard, onExportRegions, onExportPlan, onExportAll, onExportOffice,
  onImportBackup, onImportRegions, onImportPlan, onImportOffice,
}: {
  mode: WorkspaceTransferMode
  onClose: () => void
  onExportBackup: () => void
  onExportStrategy: () => void
  onExportBoard: () => void
  onExportRegions: () => void
  onExportPlan: () => void
  onExportAll: () => void
  onExportOffice: () => void
  onImportBackup: () => void
  onImportRegions: () => void
  onImportPlan: () => void
  onImportOffice: () => void
}) {
  const exportMode = mode === 'export'
  return <div className="transfer-backdrop" onMouseDown={onClose}>
    <section className="transfer-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label={`${exportMode ? 'Export' : 'Import'} workspace`}>
      <header className="transfer-heading">
        <div><span>{exportMode ? 'EXPORT' : 'IMPORT'}</span><h2>{exportMode ? 'Take Frame work anywhere' : 'Bring structured work into Frame'}</h2><p>{exportMode ? 'Frame stays semantic internally; compatibility projections produce portable Markdown/CSV or native Office OOXML when other tools need files.' : 'Imports validate structure first. Office, Google-export and CSV changes are previewed as semantic transactions before Apply.'}</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close transfer dialog"><X size={16} /></button>
      </header>
      {exportMode ? <>
        <div className="transfer-grid">
          <TransferAction icon={FileText} title="Office compatibility set" detail="Generate a DOCX strategy document, PPTX board narrative and XLSX workbook from the current semantic workspace." onClick={onExportOffice} action="Export Office" />
          <TransferAction icon={FileText} title="Strategy Markdown" detail="Blocks, claims, citations, reviews, metrics and decision context." onClick={onExportStrategy} />
          <TransferAction icon={Presentation} title="Board narrative Markdown" detail="Visible authored scene order plus speaker notes and live narrative." onClick={onExportBoard} />
          <TransferAction icon={Table2} title="Actuals CSV" detail="Typed Regions table in a portable spreadsheet format." onClick={onExportRegions} />
          <TransferAction icon={Table2} title="Plan CSV" detail="Typed Plan table in a portable spreadsheet format." onClick={onExportPlan} />
          <TransferAction icon={Database} title="Workspace backup" detail="Full semantic session, history, branches and local state as JSON." onClick={onExportBackup} />
        </div>
        <footer className="transfer-footer"><span>Frame JSON is the lossless backup. Office, Markdown and CSV are compatibility projections.</span><button className="primary-button" onClick={onExportAll}><Download size={14} /> Export portable set</button></footer>
      </> : <>
        <div className="transfer-grid import-grid">
          <TransferAction icon={FileText} title="Word / PowerPoint / Excel" detail="Import DOCX, PPTX or XLSX. Google Docs, Slides and Sheets work through their DOCX, PPTX and XLSX downloads. Fidelity warnings appear before Apply." onClick={onImportOffice} action="Choose Office file" />
          <TransferAction icon={Database} title="Workspace backup" detail="Restore a full Frame JSON backup including semantic history." onClick={onImportBackup} action="Choose JSON" />
          <TransferAction icon={Table2} title="Actuals CSV" detail="Validate Region, Revenue, Growth and Margin; preview changed cells before Apply." onClick={onImportRegions} action="Choose CSV" />
          <TransferAction icon={Table2} title="Plan CSV" detail="Validate Region and Revenue; preview changed plan values before Apply." onClick={onImportPlan} action="Choose CSV" />
        </div>
        <footer className="transfer-footer"><span><Upload size={13} /> Imports become Frame objects and versioned changes; source files are never silently overwritten.</span></footer>
      </>}
    </section>
  </div>
}

function TransferAction({ icon: Icon, title, detail, onClick, action = 'Download' }: { icon: typeof FileText; title: string; detail: string; onClick: () => void; action?: string }) {
  return <button className="transfer-action" onClick={onClick}>
    <span className="transfer-action-icon"><Icon size={17} /></span>
    <span className="transfer-action-copy"><strong>{title}</strong><small>{detail}</small></span>
    <span className="transfer-action-verb">{action}</span>
  </button>
}
