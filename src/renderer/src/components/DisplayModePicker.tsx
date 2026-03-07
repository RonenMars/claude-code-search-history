import { useState, useRef, useEffect, useCallback } from 'react'
import type { DisplayMode } from '../../../shared/types'

const MODES: { value: DisplayMode; label: string; icon: JSX.Element }[] = [
  {
    value: 'list',
    label: 'List',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    value: 'grouped',
    label: 'Grouped',
    icon: (
      // Indented lines under a header — accordion/collapsible groups
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M8 10h12M8 15h12M4 20h16" />
      </svg>
    ),
  },
  {
    value: 'tree',
    label: 'Tree',
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 36 36">
        <path d="M15,32H11a1,1,0,0,1-1-1V27a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v4A1,1,0,0,1,15,32Zm-3-2h2V28H12Z" />
        <path d="M15,16H11a1,1,0,0,0-1,1v1.2H5.8V12H7a1,1,0,0,0,1-1V7A1,1,0,0,0,7,6H3A1,1,0,0,0,2,7v4a1,1,0,0,0,1,1H4.2V29.8h6.36a.8.8,0,0,0,0-1.6H5.8V19.8H10V21a1,1,0,0,0,1,1h4a1,1,0,0,0,1-1V17A1,1,0,0,0,15,16ZM4,8H6v2H4ZM14,20H12V18h2Z" />
        <path d="M34,9a1,1,0,0,0-1-1H10v2H33A1,1,0,0,0,34,9Z" />
        <path d="M33,18H18v2H33a1,1,0,0,0,0-2Z" />
        <path d="M33,28H18v2H33a1,1,0,0,0,0-2Z" />
      </svg>
    ),
  },
]

interface DisplayModePickerProps {
  value: DisplayMode
  onChange: (mode: DisplayMode) => void
  disabled?: boolean
}

export default function DisplayModePicker({ value, onChange, disabled }: DisplayModePickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = MODES.find((m) => m.value === value) ?? MODES[0]

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback((mode: DisplayMode) => {
    onChange(mode)
    setOpen(false)
  }, [onChange])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        title={`Display: ${current.label}`}
      >
        {current.icon}
        <svg className={`w-2.5 h-2.5 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleSelect(mode.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                mode.value === value
                  ? 'text-claude-orange bg-claude-orange/10'
                  : 'text-neutral-300 hover:bg-neutral-700/50'
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
              {mode.value === value && (
                <svg className="w-3 h-3 ml-auto text-claude-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
