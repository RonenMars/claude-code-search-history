import { useRef, useState } from 'react'

interface MessageNavigationProps {
    currentIndex: number
    totalMessages: number
    onNavigate: (index: number) => void
    onJumpToFirst: () => void
    onJumpToLast: () => void
}

export default function MessageNavigation({
    currentIndex,
    totalMessages,
    onNavigate,
    onJumpToFirst,
    onJumpToLast
}: MessageNavigationProps): JSX.Element {
    const hasPrevious = currentIndex > 0
    const hasNext = currentIndex < totalMessages - 1
    const [isEditing, setIsEditing] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handlePrevious = (): void => {
        if (hasPrevious) {
            onNavigate(currentIndex - 1)
        }
    }

    const handleNext = (): void => {
        if (hasNext) {
            onNavigate(currentIndex + 1)
        }
    }

    const handleCounterClick = (): void => {
        setInputValue(String(currentIndex + 1))
        setIsEditing(true)
        setTimeout(() => {
            inputRef.current?.select()
        }, 0)
    }

    const commitEdit = (): void => {
        const parsed = parseInt(inputValue, 10)
        if (!Number.isNaN(parsed)) {
            const clamped = Math.max(1, Math.min(parsed, totalMessages))
            onNavigate(clamped - 1)
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Enter') {
            commitEdit()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
        }
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg">
            {/* Jump to First */}
            <button
                onClick={onJumpToFirst}
                disabled={!hasPrevious}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Jump to first message"
                aria-label="Jump to first message"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                </svg>
            </button>

            {/* Previous Message */}
            <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous message"
                aria-label="Previous message"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
            </button>

            {/* Message Counter */}
            <div className="flex-1 text-center">
                <span className="text-xs text-neutral-400">
                    Message{' '}
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            type="number"
                            min={1}
                            max={totalMessages}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={commitEdit}
                            className="w-12 text-center font-medium text-neutral-300 bg-neutral-800 border border-neutral-600 rounded px-1 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    ) : (
                        <span
                            className="font-medium text-neutral-300 cursor-pointer hover:text-white hover:underline"
                            onClick={handleCounterClick}
                            title="Click to jump to message"
                        >
                            {currentIndex + 1}
                        </span>
                    )}{' '}
                    of{' '}
                    <span className="font-medium text-neutral-300">
                        {totalMessages}
                    </span>
                </span>
            </div>

            {/* Next Message */}
            <button
                onClick={handleNext}
                disabled={!hasNext}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next message"
                aria-label="Next message"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>

            {/* Jump to Last */}
            <button
                onClick={onJumpToLast}
                disabled={!hasNext}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Jump to last message"
                aria-label="Jump to last message"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                </svg>
            </button>
        </div>
    )
}
