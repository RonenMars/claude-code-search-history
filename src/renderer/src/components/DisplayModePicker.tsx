import { useState, useRef, useEffect, useCallback, type JSX } from 'react'
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
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 640 640">
        <path d="M80 88C80 74.7 69.3 64 56 64C42.7 64 32 74.7 32 88L32 456C32 486.9 57.1 512 88 512L272 512L272 464L88 464C83.6 464 80 460.4 80 456L80 224L272 224L272 176L80 176L80 88zM368 288L560 288C586.5 288 608 266.5 608 240L608 144C608 117.5 586.5 96 560 96L477.3 96C468.8 96 460.7 92.6 454.7 86.6L446.1 78C437.1 69 424.9 63.9 412.2 63.9L368 64C341.5 64 320 85.5 320 112L320 240C320 266.5 341.5 288 368 288zM368 576L560 576C586.5 576 608 554.5 608 528L608 432C608 405.5 586.5 384 560 384L477.3 384C468.8 384 460.7 380.6 454.7 374.6L446.1 366C437.1 357 424.9 351.9 412.2 351.9L368 352C341.5 352 320 373.5 320 400L320 528C320 554.5 341.5 576 368 576z" />
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
