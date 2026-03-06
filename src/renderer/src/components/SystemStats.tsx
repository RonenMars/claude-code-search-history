import { useState, useEffect, useCallback } from 'react'
import type { StatsGranularity, PeriodStat } from '../../../shared/types'

type Metric = 'conversations' | 'messages'

interface GranularityOption {
  value: StatsGranularity
  label: string
  limit: number
}

const GRANULARITY_OPTIONS: GranularityOption[] = [
  { value: 'day',   label: '30 Days',   limit: 30 },
  { value: 'week',  label: '12 Weeks',  limit: 12 },
  { value: 'month', label: '12 Months', limit: 12 },
]

function generateKeys(granularity: StatsGranularity, count: number): string[] {
  const keys: string[] = []
  const now = new Date()

  if (granularity === 'month') {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  } else if (granularity === 'week') {
    // Find Monday of this week
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
  } else {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
  }

  return keys
}

function formatLabel(dateKey: string, granularity: StatsGranularity): string {
  if (granularity === 'month') {
    const [year, month] = dateKey.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function labelEvery(count: number): number {
  if (count <= 12) return 2
  if (count <= 20) return 5
  return 7
}

export default function SystemStats(): JSX.Element {
  const [granularity, setGranularity] = useState<StatsGranularity>('day')
  const [metric, setMetric] = useState<Metric>('conversations')
  const [rawData, setRawData] = useState<PeriodStat[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const config = GRANULARITY_OPTIONS.find((o) => o.value === granularity)!

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getDailyStats(granularity, config.limit)
      setRawData(data)
    } catch {
      setRawData([])
    } finally {
      setLoading(false)
    }
  }, [granularity, config.limit])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Fill all expected keys with zeros for missing periods
  const keys = generateKeys(granularity, config.limit)
  const dataMap = new Map(rawData.map((d) => [d.date, d]))
  const filledData = keys.map((key) => dataMap.get(key) ?? { date: key, conversations: 0, messages: 0 })

  const values = filledData.map((d) => d[metric])
  const maxVal = Math.max(...values, 1)

  const totalConversations = rawData.reduce((sum, d) => sum + d.conversations, 0)
  const totalMessages = rawData.reduce((sum, d) => sum + d.messages, 0)

  const every = labelEvery(config.limit)

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGranularity(opt.value)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                granularity === opt.value
                  ? 'bg-claude-orange text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['conversations', 'messages'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                metric === m
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading ? (
          <div className="h-28 flex items-center justify-center">
            <span className="text-xs text-neutral-600 animate-pulse">Loading stats...</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-px h-28">
              {filledData.map((item, i) => {
                const val = item[metric]
                const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0
                const isHovered = hoveredIndex === i
                return (
                  <div
                    key={item.date}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-default"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <div className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 whitespace-nowrap shadow-lg">
                          <div className="font-medium">{formatLabel(item.date, granularity)}</div>
                          <div className="text-neutral-400">{item.conversations} conv · {item.messages} msg</div>
                        </div>
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-sm transition-colors ${
                        isHovered ? 'bg-claude-orange' : 'bg-claude-orange/50'
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: val > 0 ? '2px' : '0' }}
                    />
                  </div>
                )
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex gap-px mt-1">
              {filledData.map((item, i) => (
                <div key={item.date} className="flex-1 flex justify-center">
                  {i % every === 0 && (
                    <span className="text-[9px] text-neutral-600 whitespace-nowrap">
                      {formatLabel(item.date, granularity)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Totals */}
      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
        <span>
          <span className="text-neutral-300 font-medium">{totalConversations.toLocaleString()}</span> conversations
        </span>
        <span>
          <span className="text-neutral-300 font-medium">{totalMessages.toLocaleString()}</span> messages
        </span>
      </div>
    </div>
  )
}
