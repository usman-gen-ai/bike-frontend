import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export interface CanvasImageCompositorHandle {
  downloadComposited: (filename?: string) => Promise<void>
  getBlob: () => Promise<Blob | null>
}

interface Props {
  src: string
  alt?: string
  bgColor: string // Hex color string, or 'checker' for transparent checkerboard
  className?: string
  onLoaded?: (info: { width: number; height: number }) => void
}

export const CanvasImageCompositor = forwardRef<CanvasImageCompositorHandle, Props>(
  ({ src, alt, bgColor, className, onLoaded }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const imageCache = useRef<HTMLImageElement | null>(null)

    // Expose downloadComposited and getBlob to parent
    useImperativeHandle(ref, () => ({
      downloadComposited: async (filename = 'composited-bike.png') => {
        const canvas = canvasRef.current
        if (!canvas) return
        return new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) return resolve()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            resolve()
          }, 'image/png')
        })
      },
      getBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current
          if (!canvas) return resolve(null)
          canvas.toBlob(resolve, 'image/png')
        }),
    }))

    // Draw background and image onto canvas
    const renderCanvas = (img: HTMLImageElement) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = img.naturalWidth || img.width || 1200
      const h = img.naturalHeight || img.height || 800

      canvas.width = w
      canvas.height = h

      // Clear previous frame
      ctx.clearRect(0, 0, w, h)

      // 1. Draw user-chosen background DIRECTLY on the canvas pixels
      if (bgColor === 'checker') {
        // High-contrast transparent checkerboard pattern
        const size = Math.max(16, Math.round(w / 48))
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#e2e8f0'
        for (let y = 0; y < h; y += size) {
          for (let x = 0; x < w; x += size) {
            if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 1) {
              ctx.fillRect(x, y, size, size)
            }
          }
        }
      } else {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, w, h)
      }

      // 2. Draw cutout bike directly over the chosen background
      ctx.drawImage(img, 0, 0, w, h)

      onLoaded?.({ width: w, height: h })
    }

    // Load image whenever src changes
    useEffect(() => {
      let isMounted = true
      setLoading(true)
      setError(null)

      const load = async () => {
        try {
          // Attempt to fetch as blob to avoid CORS taint on canvas
          const res = await fetch(src)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          if (!isMounted) return

          const objectUrl = URL.createObjectURL(blob)
          const img = new Image()
          img.onload = () => {
            if (!isMounted) {
              URL.revokeObjectURL(objectUrl)
              return
            }
            imageCache.current = img
            renderCanvas(img)
            URL.revokeObjectURL(objectUrl)
            setLoading(false)
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            fallbackLoad()
          }
          img.src = objectUrl
        } catch {
          fallbackLoad()
        }
      }

      const fallbackLoad = () => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (!isMounted) return
          imageCache.current = img
          renderCanvas(img)
          setLoading(false)
        }
        img.onerror = () => {
          if (!isMounted) return
          setLoading(false)
          setError('Failed to load image for canvas compositing')
        }
        img.src = src
      }

      load()

      return () => {
        isMounted = false
      }
    }, [src])

    // Redraw canvas whenever bgColor changes without re-fetching
    useEffect(() => {
      if (imageCache.current && !loading) {
        renderCanvas(imageCache.current)
      }
    }, [bgColor, loading])

    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 text-white gap-2">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">Rendering on canvas...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-6 text-amber-400 gap-2">
            <ExclamationTriangleIcon className="w-8 h-8" />
            <p className="text-xs font-medium text-center">{error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          aria-label={alt || 'Composited Image'}
          className={className || 'max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-200'}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            display: error ? 'none' : 'block',
          }}
        />
      </div>
    )
  }
)

CanvasImageCompositor.displayName = 'CanvasImageCompositor'
