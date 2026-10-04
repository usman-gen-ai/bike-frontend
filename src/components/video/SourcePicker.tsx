import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowPathIcon, CheckIcon, ChevronRightIcon, MagnifyingGlassIcon, MinusIcon } from '@heroicons/react/24/outline'
import { bikesApi, getErrorMessage, type GenerationItem, type MainModel, type ProductionModel } from '@lib/api'
import { cn } from '@lib/utils'
import { AssetBadge } from '@components/StatusBadges'
import { EmptyState3D } from '@components/EmptyState3D'
import { isEligible, type PickedGen, type PickedMap } from './types'

type Tri = 'none' | 'some' | 'all'

const Box = ({ state, disabled, onClick, label }: { state: Tri; disabled?: boolean; onClick: () => void; label: string }) => (
  <button
    type="button" role="checkbox" aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
    aria-label={label} disabled={disabled} onClick={onClick}
    className={cn(
      'w-[18px] h-[18px] rounded-[5px] border-2 grid place-items-center shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
      state === 'none' ? 'border-slate-300 bg-white hover:border-slate-400' : 'bg-[#ff5a36] border-[#ff5a36]'
    )}
  >
    {state === 'all' && <CheckIcon className="w-3 h-3 text-white" strokeWidth={4} />}
    {state === 'some' && <MinusIcon className="w-3 h-3 text-white" strokeWidth={4} />}
  </button>
)

const tri = (picked: number, total: number): Tri => (picked === 0 ? 'none' : total > 0 && picked >= total ? 'all' : 'some')

const Loading = ({ label }: { label: string }) => (
  <div className="ml-8 flex items-center gap-2 py-2 text-xs text-slate-400">
    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> {label}
  </div>
)

interface Props {
  picked: PickedMap
  onPickedChange: (updater: (prev: PickedMap) => PickedMap) => void
  onError: (msg: string) => void
}

export const SourcePicker = ({ picked, onPickedChange, onError }: Props) => {
  const [mains, setMains] = useState<MainModel[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')

  const [openMain, setOpenMain] = useState<string | null>(null)
  const [openProd, setOpenProd] = useState<Set<string>>(new Set())
  const [prodMap, setProdMap] = useState<Record<string, ProductionModel[]>>({})
  const [genMap, setGenMap] = useState<Record<string, GenerationItem[]>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const inflight = useRef<Record<string, Promise<unknown>>>({})

  const setBusyKey = (k: string, on: boolean) =>
    setBusy((prev) => { const n = new Set(prev); on ? n.add(k) : n.delete(k); return n })

  const loadMains = useCallback(() => {
    setLoading(true); setFailed(false)
    bikesApi.getMainModels().then(setMains).catch((e) => { setFailed(true); onError(getErrorMessage(e)) }).finally(() => setLoading(false))
  }, [onError])
  useEffect(loadMains, [loadMains])

  // cached + de-duplicated loaders
  const ensureProd = useCallback(async (slug: string): Promise<ProductionModel[]> => {
    if (prodMap[slug]) return prodMap[slug]
    const key = `m:${slug}`
    inflight.current[key] ??= (async () => {
      setBusyKey(key, true)
      try {
        const res = await bikesApi.getProductionModels(slug)
        setProdMap((p) => ({ ...p, [slug]: res.production_models }))
        return res.production_models
      } finally { setBusyKey(key, false); delete inflight.current[key] }
    })()
    try { return (await inflight.current[key]) as ProductionModel[] } catch (e) { onError(getErrorMessage(e)); return [] }
  }, [prodMap, onError])

  const ensureGens = useCallback(async (slug: string): Promise<GenerationItem[]> => {
    if (genMap[slug]) return genMap[slug]
    const key = `p:${slug}`
    inflight.current[key] ??= (async () => {
      setBusyKey(key, true)
      try {
        const res = await bikesApi.getGenerations(slug)
        setGenMap((p) => ({ ...p, [slug]: res.generations }))
        return res.generations
      } finally { setBusyKey(key, false); delete inflight.current[key] }
    })()
    try { return (await inflight.current[key]) as GenerationItem[] } catch (e) { onError(getErrorMessage(e)); return [] }
  }, [genMap, onError])

  const toPicked = (m: MainModel, pm: ProductionModel, g: GenerationItem): PickedGen => ({
    id: g.id, title: g.title, mainId: m.id, mainName: m.name, pmId: pm.id, pmName: pm.name, images: g.video_selected_count,
  })

  const applyGroup = (items: PickedGen[], on: boolean) =>
    onPickedChange((prev) => {
      const next = { ...prev }
      for (const it of items) on ? (next[it.id] = it) : delete next[it.id]
      return next
    })

  // ── counts straight from `picked` (works even before a branch is loaded) ──
  const pickedByMain = useMemo(() => {
    const r: Record<number, number> = {}
    Object.values(picked).forEach((p) => { r[p.mainId] = (r[p.mainId] ?? 0) + 1 })
    return r
  }, [picked])
  const pickedByPm = useMemo(() => {
    const r: Record<number, number> = {}
    Object.values(picked).forEach((p) => { r[p.pmId] = (r[p.pmId] ?? 0) + 1 })
    return r
  }, [picked])

  // ── actions ──────────────────────────────────────────────────────────────
  const togglePm = async (m: MainModel, pm: ProductionModel) => {
    const gens = await ensureGens(pm.slug)
    const ok = gens.filter(isEligible).map((g) => toPicked(m, pm, g))
    const allOn = ok.length > 0 && ok.every((x) => picked[x.id])
    applyGroup(ok, !allOn)
    setOpenMain(m.slug)
    setOpenProd((s) => new Set(s).add(pm.slug))
  }

  const toggleMain = async (m: MainModel) => {
    setBusyKey(`mm:${m.slug}`, true)
    try {
      const prods = await ensureProd(m.slug)
      const lists = await Promise.all(prods.map(async (pm) => ({ pm, gens: await ensureGens(pm.slug) })))
      const ok = lists.flatMap(({ pm, gens }) => gens.filter(isEligible).map((g) => toPicked(m, pm, g)))
      const allOn = ok.length > 0 && ok.every((x) => picked[x.id])
      applyGroup(ok, !allOn)
    } finally { setBusyKey(`mm:${m.slug}`, false) }
  }

  const toggleGen = (m: MainModel, pm: ProductionModel, g: GenerationItem) => {
    if (!isEligible(g)) return
    applyGroup([toPicked(m, pm, g)], !picked[g.id])
  }

  const expandMain = async (m: MainModel) => {
    if (openMain === m.slug) { setOpenMain(null); return }
    setOpenMain(m.slug)
    await ensureProd(m.slug)
  }

  const expandProd = async (pm: ProductionModel) => {
    setOpenProd((prev) => { const n = new Set(prev); n.has(pm.slug) ? n.delete(pm.slug) : n.add(pm.slug); return n })
    await ensureGens(pm.slug)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return mains.filter((m) => m.name.toLowerCase().includes(q))
  }, [mains, search])

  return (
    <div className="flex flex-col min-h-0">
      <div className="relative mb-3">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search main models…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5a36]/40 focus:bg-white"
        />
      </div>

      <div className="space-y-1.5 overflow-y-auto pr-1 max-h-[36rem] min-h-[12rem]">
        {loading ? (
          <div className="flex items-center justify-center py-16"><ArrowPathIcon className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : failed ? (
          <EmptyState3D compact variant="error" title="Couldn't load models" message="Unable to connect to the server. Please try again."
            action={<button onClick={loadMains} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Retry</button>} />
        ) : filtered.length === 0 ? (
          <EmptyState3D compact variant={search ? 'filter' : 'bike'} title={search ? 'No models found' : 'No models yet'}
            message={search ? `No main model matches "${search}".` : 'Models will appear here once the scraper adds them.'} />
        ) : (
          filtered.map((m) => {
            const mOpen = openMain === m.slug
            const prods = prodMap[m.slug]
            const pickedCount = pickedByMain[m.id] ?? 0
            const mState: Tri = pickedCount === 0 ? 'none' : (() => {
              // "all" only when the whole brand is loaded and fully ticked
              if (!prods || prods.some((pm) => !genMap[pm.slug])) return 'some'
              const eligible = prods.reduce((n, pm) => n + genMap[pm.slug].filter(isEligible).length, 0)
              return tri(pickedCount, eligible)
            })()
            return (
              <div key={m.id} className="space-y-1.5">
                <div className={cn('flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 transition-colors', pickedCount ? 'border-[#ff5a36]/50 bg-[#fff8f5]' : 'border-slate-200')}>
                  {busy.has(`mm:${m.slug}`) ? <ArrowPathIcon className="w-[18px] h-[18px] animate-spin text-slate-400" /> : <Box state={mState} label={`Select all of ${m.name}`} onClick={() => toggleMain(m)} />}
                  <button type="button" onClick={() => expandMain(m)} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left">
                    <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {pickedCount > 0 && <span className="px-1.5 py-0.5 rounded-md bg-[#ff5a36] text-white text-[11px] font-bold tabular-nums">{pickedCount}</span>}
                      <span className="text-[11px] text-slate-400">{m.productionModelsCount} models · {m.generationsCount} gen</span>
                      <ChevronRightIcon className={cn('w-4 h-4 text-slate-400 transition-transform', mOpen && 'rotate-90')} />
                    </span>
                  </button>
                </div>

                {mOpen && (
                  <div className="space-y-1.5 anim-pop">
                    {busy.has(`m:${m.slug}`) && <Loading label="Loading production models…" />}
                    {prods && prods.length === 0 && <p className="ml-6 py-2 text-xs text-slate-400">This main model has no production models.</p>}
                    {prods?.map((pm) => {
                      const pOpen = openProd.has(pm.slug)
                      const gens = genMap[pm.slug]
                      const eligibleN = gens?.filter(isEligible).length
                      const n = pickedByPm[pm.id] ?? 0
                      const pState: Tri = n === 0 ? 'none' : eligibleN == null ? 'some' : tri(n, eligibleN)
                      const none = eligibleN === 0
                      return (
                        <div key={pm.id} className="space-y-1.5">
                          <div className={cn('ml-5 flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 transition-colors', n ? 'border-[#ff5a36]/40 bg-[#fff8f5]' : 'border-slate-200')}>
                            {busy.has(`p:${pm.slug}`) && !gens ? <ArrowPathIcon className="w-[18px] h-[18px] animate-spin text-slate-400" /> : (
                              <Box state={pState} disabled={none} label={`Select all generations of ${pm.name}`} onClick={() => togglePm(m, pm)} />
                            )}
                            <button type="button" onClick={() => expandProd(pm)} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left">
                              <span className="text-[13px] font-semibold text-slate-800 truncate">{pm.name}</span>
                              <span className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 tabular-nums">
                                {n > 0 && <span className="px-1.5 py-0.5 rounded-md bg-[#ff5a36]/15 text-[#c2310f] font-bold">{n}</span>}
                                {eligibleN != null ? `${eligibleN}/${pm.generationsCount} ready` : `${pm.generationsCount} gen`}
                                <ChevronRightIcon className={cn('w-4 h-4 transition-transform', pOpen && 'rotate-90')} />
                              </span>
                            </button>
                          </div>

                          {pOpen && (
                            <div className="space-y-1.5 anim-pop">
                              {busy.has(`p:${pm.slug}`) && !gens && <Loading label="Loading generations…" />}
                              {gens && gens.length === 0 && <p className="ml-12 py-2 text-xs text-slate-400">No generations.</p>}
                              {gens?.map((g) => {
                                const ok = isEligible(g)
                                const on = !!picked[g.id]
                                return (
                                  <button
                                    key={g.id} type="button" disabled={!ok} onClick={() => toggleGen(m, pm, g)}
                                    title={ok ? undefined : 'First select images on the Models page and mark it "Ready for Video"'}
                                    className={cn(
                                      'ml-10 w-[calc(100%-2.5rem)] flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed',
                                      on ? 'border-[#ff5a36]/50 bg-[#fff1ec]' : 'border-slate-200 bg-white hover:border-slate-300',
                                      !ok && 'opacity-55'
                                    )}
                                  >
                                    <span className={cn('w-[18px] h-[18px] rounded-[5px] border-2 grid place-items-center shrink-0', on ? 'bg-[#ff5a36] border-[#ff5a36]' : 'border-slate-300 bg-white')}>
                                      {on && <CheckIcon className="w-3 h-3 text-white" strokeWidth={4} />}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-slate-800">{g.title}</span>
                                    <span className="shrink-0"><AssetBadge target="video" status={g.video_status} /></span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
