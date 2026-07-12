import { useEffect, useRef, type ReactNode } from 'react'

interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  children: ReactNode
  height?: number
  alignRight?: boolean
}

export function Popover({ isOpen, onClose, anchorRef, children, height = 200, alignRight = false }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

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

  const anchorRect = anchorRef.current?.getBoundingClientRect()

  let left = 0
  let top = 0

  if (anchorRect) {
    const popoverWidth = alignRight ? anchorRect.width : 320
    if (alignRight) {
      left = anchorRect.right - popoverWidth
    } else {
      left = anchorRect.left
    }
    top = anchorRect.top - height
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
      style={{
        width: alignRight ? 'auto' : 320,
        left,
        top,
      }}
    >
      {children}
    </div>
  )
}
