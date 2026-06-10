import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type UsersToolbarProps = {
  queryDraft: string
  onQueryDraftChange: (value: string) => void
  onSearch: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onImportFile: (file: File) => void
  onExportXls: () => void
  onExportPdf: () => void
  onOpenFilter: () => void
  onOpenCreate: () => void
  isExporting: boolean
  isUsersLoading: boolean
}

export function UsersToolbar({
  queryDraft,
  onQueryDraftChange,
  onSearch,
  fileInputRef,
  onImportFile,
  onExportXls,
  onExportPdf,
  onOpenFilter,
  onOpenCreate,
  isExporting,
  isUsersLoading,
}: UsersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full sm:max-w-sm">
        <div className="flex items-center gap-2">
          <Input
            value={queryDraft}
            onChange={(e) => onQueryDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch()
            }}
            placeholder="Rechercher (matricule, nom, email, agence...)"
          />
          <Button type="button" variant="secondary" onClick={onSearch}>
            Rechercher
          </Button>
        </div>
       
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportFile(f)
            e.currentTarget.value = ''
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          Import XLS
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onExportXls}
          disabled={isExporting || isUsersLoading}
        >
          {isExporting ? 'Export…' : 'Export XLS'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onExportPdf}
          disabled={isExporting || isUsersLoading}
        >
          Export PDF
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpenFilter}>
          Filtre
        </Button>
        <Button type="button" size="sm" onClick={onOpenCreate}>
          Nouveau
        </Button>
      </div>
    </div>
  )
}
