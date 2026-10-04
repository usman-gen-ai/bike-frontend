import type { ReactNode } from 'react'
import { cn } from '@lib/utils'

type Variant = 'video' | 'filter' | 'bike' | 'error'

interface Props {
  title: string
  message: string
  variant?: Variant
  action?: ReactNode
  compact?: boolean
  className?: string
}

const GLYPH: Record<Variant, ReactNode> = {
  video: (
    <svg viewBox="0 0 24 24" className="w-9 h-9 text-white drop-shadow" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" className="w-9 h-9 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
  ),
  bike: <span className="text-3xl leading-none drop-shadow">🏍️</span>,
  error: (
    <svg viewBox="0 0 24 24" className="w-9 h-9 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
  ),
}

const TOP: Record<Variant, string> = {
  video: 'from-[#ff7a59] to-[#ff5a36]',
  filter: 'from-[#3b6cf0] to-[#1e40af]',
  bike: 'from-[#3b6cf0] to-[#1e40af]',
  error: 'from-[#f87171] to-[#b91c1c]',
}

/** Layered CSS-3D scene (no image assets): a stack of "video cards", a spinning cube and a shadow. */
export const EmptyState3D = ({ title, message, variant = 'video', action, compact, className }: Props) => (
  <div className={cn('flex flex-col items-center text-center px-6', compact ? 'py-6' : 'py-12', className)}>
    <div className={cn('scene3d relative anim-float', compact ? 'h-36 w-52' : 'h-48 w-64')} aria-hidden>
      {/* ground shadow */}
      <div className="absolute left-1/2 bottom-2 -translate-x-1/2 h-4 w-40 rounded-[50%] bg-slate-900/15 blur-md" />

      <div className="stage absolute left-1/2 top-1/2 -ml-[72px] -mt-[48px] w-[144px] h-[96px]" style={{ transformStyle: 'preserve-3d' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'absolute inset-0 rounded-xl border border-white/40',
              i === 2 ? `bg-gradient-to-br ${TOP[variant]}` : i === 1 ? 'bg-slate-200' : 'bg-slate-300'
            )}
            style={{ transform: `translateZ(${i * 18}px)`, boxShadow: '0 10px 22px rgba(15,23,42,.18)' }}
          >
            {i === 2 && (
              <div className="absolute inset-0 grid place-items-center" style={{ transform: 'rotateZ(38deg) rotateX(-58deg) translateZ(6px)' }}>
                {GLYPH[variant]}
              </div>
            )}
            {i === 2 && (
              <>
                <span className="absolute left-2 top-1.5 h-1.5 w-1.5 rounded-full bg-white/70" />
                <span className="absolute left-5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/40" />
              </>
            )}
          </div>
        ))}
      </div>

      {/* orbiting cube */}
      <div className="absolute right-3 top-2" style={{ perspective: 400 }}>
        <div className="cube scale-[.45] origin-center">
          <i /><i /><i /><i /><i /><i />
        </div>
      </div>
      {/* film strip */}
      <div className="film-strip absolute left-2 bottom-4 w-3.5 h-14 rounded-sm opacity-90 hidden sm:block" />
    </div>

    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{title}</h3>
    <p className="mt-1 text-sm text-slate-500 max-w-xs leading-relaxed">{message}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
)
