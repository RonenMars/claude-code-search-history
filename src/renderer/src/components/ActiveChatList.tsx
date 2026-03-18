import type { JSX } from 'react'
import type { ChatInstance, ClaudeProfile } from '../../../shared/types'

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
}

interface ActiveChatListProps {
  instances: ChatInstance[]
  activeChatInstanceId: string | null
  onFocus: (instanceId: string) => void
  onClose: (instanceId: string) => void
}

function profileEmoji(profile: ClaudeProfile | null): string {
  if (profile === 'work') return '💼'
  if (profile === 'personal') return '🏠'
  return ''
}

export default function ActiveChatList({
  instances,
  activeChatInstanceId,
  onFocus,
  onClose,
}: ActiveChatListProps): JSX.Element | null {
  if (instances.length === 0) return null

  return (
    <div className="border-b border-neutral-800">
      {instances.map((instance) => {
        const isActive = instance.status === 'active'
        const isFocused = instance.instanceId === activeChatInstanceId
        const emoji = profileEmoji(instance.profile)

        return (
          <div
            key={instance.instanceId}
            className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
              isFocused ? 'bg-neutral-800' : 'hover:bg-neutral-900'
            }`}
          >
            {/* Status dot */}
            <div
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                isActive
                  ? instance.isClaudeTyping
                    ? 'bg-claude-orange animate-pulse'
                    : 'animate-pulse bg-green-500'
                  : 'bg-neutral-600'
              }`}
            />

            {/* Project name + profile */}
            <span
              className="flex-1 truncate font-mono text-neutral-300"
              title={instance.cwd}
            >
              {basename(instance.cwd)}
              {emoji ? ` ${emoji}` : ''}
            </span>

            {/* Exited badge */}
            {!isActive && (
              <span className="shrink-0 text-neutral-600">
                Exited{instance.exitCode !== null ? ` (${instance.exitCode})` : ''}
              </span>
            )}

            {/* Focus button */}
            <button
              onClick={() => onFocus(instance.instanceId)}
              className="shrink-0 px-1 text-neutral-500 transition-colors hover:text-neutral-300"
              title="Focus this chat"
            >
              →
            </button>

            {/* Close button */}
            <button
              onClick={() => onClose(instance.instanceId)}
              className="shrink-0 px-1 text-neutral-600 transition-colors hover:text-red-400"
              title={isActive ? 'Stop and remove' : 'Remove'}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
