import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  children: ReactNode
  height?: number
  alignRight?: boolean
}

const POPOVER_WIDTH = 320
const GAP = 4

export function Popover({ isOpen, onClose, anchorRef, children, alignRight = false }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null)
      return
    }
    const compute = () => {
      const anchor = anchorRef.current
      const pop = popoverRef.current
      if (!anchor || !pop) return
      const a = anchor.getBoundingClientRect()
      let left: number
      if (alignRight) {
        left = a.right - POPOVER_WIDTH
      } else {
        left = a.left
      }
      if (left < 8) left = 8
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - 8 - POPOVER_WIDTH
      }
      const availAbove = a.top - GAP - 8
      const availBelow = window.innerHeight - a.bottom - GAP - 8
      const wantAbove = availAbove >= availBelow
      const maxH = wantAbove ? availAbove : availBelow
      pop.style.maxHeight = `${maxH}px`
      const h = Math.min(pop.offsetHeight, maxH)
      let top: number
      if (wantAbove) {
        top = a.top - h - GAP
      } else {
        top = a.bottom + GAP
      }
      setPos({ left, top })
    }
    compute()
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', compute)
    }
  }, [isOpen, alignRight, anchorRef])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        onClose()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  const left = pos?.left ?? -9999
  const top = pos?.top ?? -9999

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
      style={{
        width: POPOVER_WIDTH,
        left,
        top,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  )
}
