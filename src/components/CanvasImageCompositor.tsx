import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useMemo } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

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
    const [useImgFallback, setUseImgFallback] = useState(false)
    const imageCache = useRef<HTMLImageElement | null>(null)

    // Direct download helper when canvas export is restricted
    const fallbackDirectDownload = (filename: string) => {
      const a = document.createElement('a')
      a.href = src
      a.download = filename
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }

    // Expose downloadComposited and getBlob to parent
    useImperativeHandle(ref, () => ({
      downloadComposited: async (filename = 'composited-bike.png') => {
        const canvas = canvasRef.current
        if (!canvas || useImgFallback) {
          fallbackDirectDownload(filename)
          return
        }

        try {
          return new Promise<void>((resolve) => {
            try {
              canvas.toBlob((blob) => {
                if (!blob) {
                  fallbackDirectDownload(filename)
                  return resolve()
                }
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
            } catch {
              // Tainted canvas fallback
              fallbackDirectDownload(filename)
              resolve()
            }
          })
        } catch {
          fallbackDirectDownload(filename)
        }
      },
      getBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current
          if (!canvas || useImgFallback) return resolve(null)
          try {
            canvas.toBlob(resolve, 'image/png')
          } catch {
            resolve(null)
          }
        }),
    }))

    // Draw background and image onto canvas
    const renderCanvas = (img: HTMLImageElement) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      try {
        const w = img.naturalWidth || img.width || 1200
        const h = img.naturalHeight || img.height || 800

        canvas.width = w
        canvas.height = h

        // Clear previous frame
        ctx.clearRect(0, 0, w, h)

        // 1. Draw user-chosen background DIRECTLY on the canvas pixels
        if (bgColor === 'checker') {
          // Transparent checkerboard pattern
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
      } catch (err) {
        console.warn('Canvas drawImage error, switching to fallback <img>:', err)
        setUseImgFallback(true)
      }
    }

    // Load image whenever src changes - CORS-SAFE approach
    useEffect(() => {
      let isMounted = true
      setLoading(true)
      setUseImgFallback(false)

      const img = new Image()
      // Do NOT set crossOrigin here by default to prevent S3 bucket CORS rejection
      img.onload = () => {
        if (!isMounted) return
        imageCache.current = img
        renderCanvas(img)
        setLoading(false)
      }
      img.onerror = (e) => {
        console.warn('Image failed to load via new Image(), using direct <img> tag fallback:', e)
        if (!isMounted) return
        setLoading(false)
        setUseImgFallback(true)
      }
      img.src = src

      return () => {
        isMounted = false
      }
    }, [src])

    // Redraw canvas whenever bgColor changes without re-fetching
    useEffect(() => {
      if (imageCache.current && !loading && !useImgFallback) {
        renderCanvas(imageCache.current)
      }
    }, [bgColor, loading, useImgFallback])

    // CSS background style for fallback <img> element
    const fallbackBgStyle = useMemo(() => {
      if (bgColor === 'checker') {
        return {
          backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          backgroundColor: '#ffffff',
        }
      }
      return { backgroundColor: bgColor }
    }, [bgColor])

    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 text-white gap-2">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">Loading image...</span>
          </div>
        )}

        {useImgFallback ? (
          <img
            src={src}
            alt={alt || 'Replaced / Enhanced Image'}
            style={fallbackBgStyle}
            className={className || 'max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-200'}
            onLoad={() => setLoading(false)}
          />
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={alt || 'Composited Image'}
            className={className || 'max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-200'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: loading ? 'none' : 'block',
            }}
          />
        )}
      </div>
    )
  }
)

CanvasImageCompositor.displayName = 'CanvasImageCompositor'
