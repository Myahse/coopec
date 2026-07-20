import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '@heroui/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/animate-ui/components/radix/accordion'
import { Button } from '@/components/ui/button'
import { DrawerListPicker } from '@/components/DrawerListPicker'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DRAWER_SECTION_IDS } from '@/constants/dashboard-sections'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  DashboardSectionNavContext,
  type DashboardSectionLink,
} from '@/contexts/DashboardSectionNavContext'

type DrawerItem = {
  title: string
  content: ReactNode
  showArrow?: boolean
  actionLabel?: string
  onAction?: () => void

  hideAction?: boolean
}

type Props = { children: ReactNode }

export function DashboardSectionsShell({ children }: Props) {
  const navigate = useNavigate()
  const f = useDashboardFilters()

  const [isSectionDrawerOpen, setIsSectionDrawerOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<DashboardSectionLink | null>(null)

  const drawerItems = useMemo<DrawerItem[]>(() => {
    const sectionId = activeSection?.to

    if (sectionId === '/dashboard') {
      return [
        {
          title: 'Institution',
          content: (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {f.selectedInstitutionLabel || f.institution}
              </p>
              <p className="text-sm text-muted-foreground">
                Paramètres généraux, messagerie, FTP et état de l’institution connectée.
              </p>
            </div>
          ),
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/institution')
          },
        },
        {
          title: 'Coopec',
          content: (
            <p className="text-sm text-muted-foreground">
              Référentiel Coopec : code, nom, modification et suppression.
            </p>
          ),
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/coopec')
          },
        },
        {
          title: 'Agence',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/agences')
          },
        },
        {
          title: 'Extraction du fichier TXT superviseur',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/extraction-txt-superviseur')
          },
        },
        {
          title: 'Gestion des cartes clientèles',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/cartes-clientele')
          },
        },
        {
          title: 'Saisie des Objectifs',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/objectifs')
          },
        },
        {
          title: 'Configuration Type Prêt',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/configuration-type-pret')
          },
        },
      ]
    }

    if (sectionId === '/dashboard/operations') {
      return [
        {
          title: 'Arrêté / annulations',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/operations/arretes-annulations')
          },
        },
        {
          title: 'Validations des arrêtés',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/operations/validations-arretes')
          },
        },
        {
          title: 'Reversements des cartes',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/operations/reversements-cartes')
          },
        },
        {
          title: 'États des cartes reversées',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/operations/etats-cartes-reversees')
          },
        },
      ]
    }

    if (sectionId === '/dashboard/etats') {
      return [
        {
          title: 'Etats des annulations',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/annulations')
          },
        },
        {
          title: 'Etats des montants collectés',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/montants-collectes')
          },
        },
        {
          title: 'Etats des collectes non comptabilisées',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/collectes-non-comptabilisees')
          },
        },
        {
          title: 'Journal des répartitions des collectes',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/journal-repartitions-collectes')
          },
        },
        {
          title: "Charge d'épargne",
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/charge-epargne')
          },
        },
        {
          title: 'Validation mensuelle des données de collecte',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/validation-mensuelle-collecte')
          },
        },
        {
          title: 'Comparatif collecte',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/comparatif-collecte')
          },
        },
        {
          title: 'Etat Consolidé',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/etat-consolide')
          },
        },
        {
          title: 'Etats collecte des Prêts',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/collecte-prets')
          },
        },
        {
          title: 'État Paiement en Ligne',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/etats/paiement-en-ligne')
          },
        },
      ]
    }

    if (sectionId === '/dashboard/prets') {
      return [
        {
          title: 'État détaillé',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/etat-detaille')
          },
        },
        {
          title: 'Etat de suivi clientèle',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/suivi-clientele')
          },
        },
        {
          title: 'Etat de compensation',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/compensation')
          },
        },
        {
          title: 'WorkFlow Prêt',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/workflow')
          },
        },
        {
          title: 'Envoi demande Client',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/envoi-demande-client')
          },
        },
        {
          title: 'Déblocage des Prêts',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/deblocage')
          },
        },
        {
          title: 'États Prêts',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/etats-prets')
          },
        },
        {
          title: 'Impayé collecte',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/impaye-collecte')
          },
        },
        {
          title: 'Impayé Prêt',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/prets/impaye-pret')
          },
        },
      ]
    }

    if (sectionId === '/dashboard/aide') {
      return [
        {
          title: 'Arrêté de la collectrice',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/aide/arrete-collectrice')
          },
        },
        {
          title: 'Attribution de compte LES et LCE',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/aide/attribution-compte-les-lce')
          },
        },
        {
          title: 'Consultation des opérations',
          content: null,
          actionLabel: 'Ouvrir',
          onAction: () => {
            setIsSectionDrawerOpen(false)
            navigate('/dashboard/aide/consultation-operations')
          },
        },
      ]
    }

    return [
      {
        title: activeSection?.label ?? 'Section',
        content: null,
        actionLabel: 'Ouvrir',
        onAction: () => {
          if (activeSection?.to) navigate(activeSection.to)
        },
      },
    ]
  }, [
    activeSection?.label,
    activeSection?.to,
    f.institution,
    f.institutionLocked,
    f.institutionOptionsAll,
    f.isAgencesByDirectionLoading,
    f.selectedInstitutionLabel,
    navigate,
  ])

  const openSectionDrawer = useCallback(
    (section: DashboardSectionLink) => {
      if (DRAWER_SECTION_IDS.has(section.to)) {
        setActiveSection(section)
        setIsSectionDrawerOpen(true)
        return
      }
      navigate(section.to)
    },
    [navigate],
  )

  const sectionNavValue = useMemo(() => ({ openSection: openSectionDrawer }), [openSectionDrawer])

  return (
    <DashboardSectionNavContext.Provider value={sectionNavValue}>
      {children}

      <Sheet open={isSectionDrawerOpen} onOpenChange={setIsSectionDrawerOpen}>
        <SheetContent side="right" className="w-[92vw] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>{activeSection?.label ?? 'Section'}</SheetTitle>
            <SheetDescription>
              Choisissez une rubrique puis ouvrez la page correspondante.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-6">
            <Accordion type="single" collapsible className="max-w-[400px] w-full">
              {drawerItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index + 1}`}>
                  <AccordionTrigger showArrow={item.showArrow ?? true}>{item.title}</AccordionTrigger>
                  <AccordionContent keepRendered={false}>
                    <div className="space-y-4">
                      {item.content ? <div>{item.content}</div> : null}
                      {item.hideAction ? null : (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="w-auto"
                            onClick={() => (item.onAction ? item.onAction() : undefined)}
                          >
                            {item.actionLabel ?? 'Ouvrir'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </SheetContent>
      </Sheet>

      <Drawer isOpen={f.isFiltersDrawerOpen} onOpenChange={f.setIsFiltersDrawerOpen}>
        <Drawer.Backdrop
          variant="blur"
          className="fixed inset-0 z-[100] bg-foreground/10 supports-backdrop-filter:backdrop-blur-xs"
        >
          <Drawer.Content placement="bottom" className="fixed inset-x-0 bottom-0 z-[101]">
            <Drawer.Dialog className="flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none">
              <Drawer.Handle />
              <Drawer.Header className="relative flex items-center px-4 pb-3 pr-12 pt-2">
                <Drawer.Heading className="min-w-0 flex-1 truncate">
                  {f.filtersTarget === 'direction'
                    ? 'Direction'
                    : f.filtersTarget === 'agency'
                      ? 'Agence'
                      : f.filtersTarget === 'institution'
                        ? 'Institution'
                        : 'Filtres'}
                </Drawer.Heading>
                <Drawer.CloseTrigger className="absolute right-3 top-1/2 -translate-y-1/2" />
              </Drawer.Header>

              <Drawer.Body className="min-h-0 overflow-auto px-4 pb-6">
                {f.filtersTarget === 'direction' ? (
                  <div ref={f.filterDirectionRef}>
                    <div id="drawer-filter-direction" className="mt-2">
                      <DrawerListPicker
                        items={f.directionOptions}
                        selectedValue={f.direction}
                        onSelect={(v) => {
                          f.setDirectionSafe(v)
                          f.setIsFiltersDrawerOpen(false)
                          f.setFiltersTarget(null)
                        }}
                        emptyLabel={
                          f.institution !== 'Toutes'
                            ? 'Aucune direction pour cette institution.'
                            : 'Aucune direction chargée.'
                        }
                      />
                    </div>
                    {f.directionLoadError ? (
                      <div className="mt-2 text-xs text-destructive">{f.directionLoadError}</div>
                    ) : null}
                  </div>
                ) : null}

                {f.filtersTarget === 'agency' ? (
                  <div ref={f.filterAgencyRef}>
                    <div id="drawer-filter-agency" className="mt-2">
                      <DrawerListPicker
                        items={[{ value: 'Toutes', label: 'Toutes' }, ...f.agences]}
                        selectedValue={f.agency}
                        onSelect={(v) => {
                          f.setAgencySafe(v)
                          f.setIsFiltersDrawerOpen(false)
                          f.setFiltersTarget(null)
                        }}
                        emptyLabel={
                          f.direction !== 'Toutes' && f.isAgencesByDirectionLoading
                            ? 'Chargement des agences…'
                            : 'Aucune agence pour les filtres choisis.'
                        }
                      />
                    </div>
                    {f.agencesByDirectionError ? (
                      <div className="mt-2 text-xs text-destructive">{f.agencesByDirectionError}</div>
                    ) : null}
                  </div>
                ) : null}

                {f.filtersTarget === 'institution' ? (
                  <div ref={f.filterInstitutionRef}>
                    <div id="drawer-filter-institution" className="mt-2">
                      {f.institutionLocked ? (
                        <p className="text-sm text-muted-foreground">
                          Institution fixée par votre session :{' '}
                          <span className="font-medium text-foreground">{f.selectedInstitutionLabel}</span>
                        </p>
                      ) : (
                        <DrawerListPicker
                          items={[{ value: 'Toutes', label: 'Toutes' }, ...f.institutionOptionsAll]}
                          selectedValue={f.institution}
                          onSelect={(v) => {
                            f.setInstitutionSafe(v)
                            f.setIsFiltersDrawerOpen(false)
                            f.setFiltersTarget(null)
                          }}
                          emptyLabel={
                            f.isInstitutionsLoading ? 'Chargement des institutions…' : 'Aucune institution chargée.'
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </DashboardSectionNavContext.Provider>
  )
}
