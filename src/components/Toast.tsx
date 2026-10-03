import { useCallback, useState } from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@lib/utils'

export type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; message: string }

export const useToasts = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const notify = useCallback((kind: ToastKind, message: string, ms = 4500) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms)
  }, [])

  return { toasts, notify, dismiss }
}

export const ToastHost = ({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) => (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(28rem,calc(100vw-2rem))]">
    {toasts.map((t) => {
      const Icon = t.kind === 'success' ? CheckCircleIcon : t.kind === 'error' ? ExclamationTriangleIcon : InformationCircleIcon
      return (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg bg-white',
            t.kind === 'success' && 'border-green-200',
            t.kind === 'error' && 'border-red-200',
            t.kind === 'info' && 'border-blue-200'
          )}
        >
          <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', t.kind === 'success' && 'text-green-600', t.kind === 'error' && 'text-red-600', t.kind === 'info' && 'text-blue-600')} />
          <p className="text-sm text-gray-700 flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )
    })}
  </div>
)
