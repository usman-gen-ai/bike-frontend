import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CubeTransparentIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline'
import {
  adminApi,
  bikesApi,
  getErrorMessage,
  type AssetTarget,
  type GenerationAssetState,
  type GenerationItem,
  type MainModel,
  type ProductionModel,
} from '@lib/api'
import { cn } from '@lib/utils'
import { StatusBadge } from '@components/StatusBadges'
import { GenerationCard } from '@components/GenerationCard'
import { GalleryModal } from '@components/GalleryModal'
import { ToastHost, useToasts } from '@components/Toast'
import { AppHeader } from '@components/AppHeader'

const StatCard = ({ icon: Icon, label, value }: { icon: typeof Squares2X2Icon; label: string; value: number }) => (
  <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/10 px-4 py-3 backdrop-blur">
    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"><Icon className="w-5 h-5 text-white" /></div>
    <div>
      <p className="text-xl font-bold text-white leading-none">{value.toLocaleString()}</p>
      <p className="text-[11px] text-blue-100/80 mt-1">{label}</p>
    </div>
  </div>
)

export const BikesPage = () => {
  const { toasts, notify, dismiss } = useToasts()

  const [mainModels, setMainModels] = useState<MainModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [openMain, setOpenMain] = useState<string | null>(null)
  const [openProd, setOpenProd] = useState<string | null>(null)
  const [prodMap, setProdMap] = useState<Record<string, ProductionModel[]>>({})
  const [genMap, setGenMap] = useState<Record<string, GenerationItem[]>>({})
  const [loadingProd, setLoadingProd] = useState<string | null>(null)
  const [loadingGen, setLoadingGen] = useState<string | null>(null)

  const [galleryGenId, setGalleryGenId] = useState<number | null>(null)
  const [busy, setBusy] = useState<{ id: number; target: AssetTarget } | null>(null)

  // ── data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    bikesApi
      .getMainModels()
      .then(setMainModels)
      .catch((e) => notify('error', getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [notify])

  const toggleMain = useCallback(async (slug: string) => {
    if (openMain === slug) { setOpenMain(null); setOpenProd(null); return }
    setOpenMain(slug)
    setOpenProd(null)
    if (!prodMap[slug]) {
      setLoadingProd(slug)
      try {
        const res = await bikesApi.getProductionModels(slug)
        setProdMap((p) => ({ ...p, [slug]: res.production_models }))
      } catch (e) {
        notify('error', getErrorMessage(e))
      } finally {
        setLoadingProd(null)
      }
    }
  }, [openMain, prodMap, notify])

  const toggleProd = useCallback(async (slug: string) => {
    if (openProd === slug) { setOpenProd(null); return }
    setOpenProd(slug)
    if (!genMap[slug]) {
      setLoadingGen(slug)
      try {
        const res = await bikesApi.getGenerations(slug)
        setGenMap((p) => ({ ...p, [slug]: res.generations }))
      } catch (e) {
        notify('error', getErrorMessage(e))
      } finally {
        setLoadingGen(null)
      }
    }
  }, [openProd, genMap, notify])

  // merge new workflow state into whichever list holds that generation
  const patchGeneration = useCallback((id: number, patch: Partial<GenerationAssetState>) => {
    setGenMap((prev) => {
      const next: typeof prev = {}
      for (const [slug, list] of Object.entries(prev)) {
        next[slug] = list.map((g) => (g.id === id ? { ...g, ...patch } : g))
      }
      return next
    })
  }, [])

  const markReady = async (id: number, target: AssetTarget) => {
    setBusy({ id, target })
    try {
      const state = await adminApi.markReady(id, target)
      patchGeneration(id, state)
      notify('success', `Marked ready for ${target}.`)
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // ── derived ─────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = mainModels.filter((m) => m.name.toLowerCase().includes(q))
    return filtered.reduce<Record<string, MainModel[]>>((acc, m) => {
      const letter = /[a-z]/i.test(m.name[0]) ? m.name[0].toUpperCase() : '#'
      ;(acc[letter] ||= []).push(m)
      return acc
    }, {})
  }, [mainModels, search])

  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b))
  const totalProd = mainModels.reduce((a, m) => a + m.productionModelsCount, 0)
  const totalGen = mainModels.reduce((a, m) => a + m.generationsCount, 0)

  const galleryGen = useMemo(
    () => (galleryGenId ? Object.values(genMap).flat().find((g) => g.id === galleryGenId) ?? null : null),
    [galleryGenId, genMap]
  )

  return (
    <div className="min-h-screen bg-slate-50 pt-14">
      <AppHeader />
      {/* Hero header */}
      <header className="bg-gradient-to-br from-slate-900 via-blue-950 to-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-2xl">🏍️</div>
              <div>
                <h1 className="text-xl font-bold text-white leading-none">Bike Admin</h1>
                <p className="text-xs text-blue-100/70 mt-1">Models · Generations · Media</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text" placeholder="Search main models…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <StatCard icon={Squares2X2Icon} label="Main Models" value={mainModels.length} />
            <StatCard icon={CubeTransparentIcon} label="Production Models" value={totalProd} />
            <StatCard icon={RectangleStackIcon} label="Generations" value={totalGen} />
          </div>
        </div>
      </header>

      {/* A–Z rail */}
      {letters.length > 0 && (
        <nav className="sticky top-14 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex gap-1 overflow-x-auto scrollbar-hide">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-primary hover:text-white transition-colors">
                {l}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-24"><ArrowPathIcon className="w-6 h-6 animate-spin text-primary" /></div>
        ) : letters.length === 0 ? (
          <p className="text-center text-gray-400 py-24 text-sm">No main models found.</p>
        ) : (
          <div className="space-y-8">
            {letters.map((letter) => (
              <section key={letter} id={`letter-${letter}`} className="scroll-mt-28">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm">{letter}</div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{grouped[letter].length} main model{grouped[letter].length === 1 ? '' : 's'}</span>
                </div>

                <div className="space-y-2.5">
                  {grouped[letter].map((main) => {
                    const isOpen = openMain === main.slug
                    return (
                      <div key={main.id} className={cn('rounded-2xl bg-white border overflow-hidden transition-shadow', isOpen ? 'border-primary/30 shadow-md' : 'border-gray-200 shadow-sm')}>
                        {/* Main model menu button */}
                        <button onClick={() => toggleMain(main.slug)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <ChevronDownIcon className={cn('w-4 h-4 transition-transform flex-shrink-0', isOpen ? 'rotate-180 text-primary' : '-rotate-90 text-gray-400')} />
                            <span className="font-semibold text-gray-900 truncate">{main.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">{main.productionModelsCount} {main.productionModelsCount === 1 ? 'model' : 'models'}</span>
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">{main.generationsCount} {main.generationsCount === 1 ? 'generation' : 'generations'}</span>
                          </div>
                        </button>

                        {/* Production models */}
                        {isOpen && (
                          <div className="border-t border-gray-100 bg-slate-50/60">
                            {loadingProd === main.slug ? (
                              <div className="flex items-center gap-2 px-8 py-4 text-sm text-gray-400"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Loading models…</div>
                            ) : (prodMap[main.slug] ?? []).length === 0 ? (
                              <p className="px-8 py-4 text-sm text-gray-400">No production models.</p>
                            ) : (
                              <div className="p-3 space-y-2">
                                {(prodMap[main.slug] ?? []).map((pm) => {
                                  const pmOpen = openProd === pm.slug
                                  return (
                                    <div key={pm.id} className={cn('rounded-xl bg-white border overflow-hidden', pmOpen ? 'border-primary/30' : 'border-gray-200')}>
                                      <button onClick={() => toggleProd(pm.slug)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <ChevronDownIcon className={cn('w-4 h-4 transition-transform flex-shrink-0', pmOpen ? 'rotate-180 text-primary' : '-rotate-90 text-gray-400')} />
                                          <span className="text-sm font-semibold text-gray-800 truncate">{pm.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 flex-shrink-0">
                                          <StatusBadge status={pm.status} />
                                          <span className="text-xs text-gray-400">{pm.generationsCount} gen</span>
                                        </div>
                                      </button>

                                      {/* Generations of this production model */}
                                      {pmOpen && (
                                        <div className="border-t border-gray-100 bg-slate-50/70 p-3 space-y-2.5">
                                          {loadingGen === pm.slug ? (
                                            <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-400"><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Loading generations…</div>
                                          ) : (genMap[pm.slug] ?? []).length === 0 ? (
                                            <p className="px-2 py-3 text-xs text-gray-400">No generations.</p>
                                          ) : (
                                            (genMap[pm.slug] ?? []).map((g) => (
                                              <GenerationCard
                                                key={g.id}
                                                generation={g}
                                                busyTarget={busy?.id === g.id ? busy.target : null}
                                                onOpenGallery={() => setGalleryGenId(g.id)}
                                                onMarkReady={(t) => markReady(g.id, t)}
                                              />
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {galleryGen && (
        <GalleryModal
          key={galleryGen.id}
          generation={galleryGen}
          onClose={() => setGalleryGenId(null)}
          onStateChange={patchGeneration}
          notify={notify}
        />
      )}

      <ToastHost toasts={toasts} dismiss={dismiss} />
    </div>
  )
}

export default BikesPage
