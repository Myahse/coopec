import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { UserManagementSheets } from './components/UserManagementSheets'
import { UsersPagination } from './components/UsersPagination'
import { UsersTable } from './components/UsersTable'
import { UsersToolbar } from './components/UsersToolbar'
import { useUserManagement } from './use-user-management'

export function UserManagementPage() {
  const navigate = useNavigate()
  const vm = useUserManagement()

  return (
    <>
      <DashboardTablePageLayout
        section="Dashboard"
        title="Gestion des utilisateurs"
        headerActions={
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Retour
          </Button>
        }
        cardTitle="Utilisateurs"
        cardDescription="Liste des utilisateurs avec actions rapides."
        toolbar={
          <UsersToolbar
            queryDraft={vm.queryDraft}
            onQueryDraftChange={vm.setQueryDraft}
            onSearch={vm.applySearch}
            fileInputRef={vm.fileInputRef}
            onImportFile={(file) => void vm.importXls(file)}
            onExportXls={() => void vm.exportXls()}
            onExportPdf={() => void vm.exportPdf()}
            onOpenFilter={() => vm.setIsFilterOpen(true)}
            onOpenCreate={vm.openCreateUser}
            isExporting={vm.isExporting}
            isUsersLoading={vm.isUsersLoading}
          />
        }
        footer={
          <UsersPagination
            page={vm.page}
            pageSize={vm.pageSize}
            rowsCount={vm.rows.length}
            isLoading={vm.isUsersLoading}
            onPageChange={vm.setPage}
            onPageSizeChange={(size) => {
              vm.setPageSize(size)
              vm.setPage(0)
            }}
          />
        }
      >
        <UsersTable
          rows={vm.rows}
          isLoading={vm.isUsersLoading}
          loadError={vm.usersLoadError}
          onEdit={vm.openEditUser}
          onDelete={vm.openDeleteUser}
          onChangeAgence={vm.openChangeAgence}
          onWorkflow={vm.openWorkflow}
          onSendParams={vm.openSendParams}
        />
      </DashboardTablePageLayout>

      <UserManagementSheets vm={vm} />
    </>
  )
}
