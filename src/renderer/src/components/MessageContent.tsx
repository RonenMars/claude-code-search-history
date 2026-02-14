import { useMemo, useState } from 'react'

interface MessageContentProps {
    content: string
    query?: string
}

interface CodeBlock {
    language: string
    code: string
    startIndex: number
    endIndex: number
}

export default function MessageContent({ content, query }: MessageContentProps): JSX.Element {
    const processedContent = useMemo(() => {
        return parseContent(content, query)
    }, [content, query])

    return <div className="message-content">{processedContent}</div>
}

function parseContent(content: string, query?: string): JSX.Element {
    // Try to detect if the entire content is JSON
    const trimmed = content.trim()
    if (isJSON(trimmed)) {
        return <JSONBlock content={trimmed} />
    }

    // Check for markdown code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const blocks: CodeBlock[] = []
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(content)) !== null) {
        blocks.push({
            language: match[1] || 'text',
            code: match[2],
            startIndex: match.index,
            endIndex: match.index + match[0].length
        })
    }

    // If we have code blocks, split content and render appropriately
    if (blocks.length > 0) {
        return <MarkdownContent content={content} blocks={blocks} query={query} />
    }

    // Check if content looks like code (has indentation patterns, braces, etc.)
    if (looksLikeCode(content)) {
        const detectedLang = detectLanguage(content)
        return <CodeBlock language={detectedLang} code={content} />
    }

    // Default: render as formatted text with query highlighting
    return <FormattedText content={content} query={query} />
}

function MarkdownContent({
    content,
    blocks,
    query
}: {
    content: string
    blocks: CodeBlock[]
    query?: string
}): JSX.Element {
    const elements: JSX.Element[] = []
    let lastIndex = 0

    blocks.forEach((block, idx) => {
        // Add text before this code block
        if (block.startIndex > lastIndex) {
            const textBefore = content.substring(lastIndex, block.startIndex)
            elements.push(
                <FormattedText key={`text-${idx}`} content={textBefore} query={query} />
            )
        }

        // Add the code block
        elements.push(
            <CodeBlock key={`code-${idx}`} language={block.language} code={block.code} />
        )

        lastIndex = block.endIndex
    })

    // Add remaining text
    if (lastIndex < content.length) {
        const textAfter = content.substring(lastIndex)
        elements.push(
            <FormattedText key={`text-final`} content={textAfter} query={query} />
        )
    }

    return <div className="space-y-3">{elements}</div>
}

function CodeBlock({ language, code }: { language: string; code: string }): JSX.Element {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Ignore copy errors
        }
    }

    const highlighted = useMemo(() => highlightCode(code, language), [code, language])

    return (
        <div className="code-block-wrapper group relative my-3">
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-t border-x border-neutral-700 rounded-t-lg">
                <span className="text-xs font-mono text-neutral-500">{language}</span>
                <button
                    onClick={handleCopy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-600"
                >
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            <pre className="bg-neutral-950 border border-neutral-700 rounded-b-lg p-4 overflow-x-auto">
                <code
                    className={`language-${language} text-sm`}
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            </pre>
        </div>
    )
}

function JSONBlock({ content }: { content: string }): JSX.Element {
    const [copied, setCopied] = useState(false)
    const [collapsed, setCollapsed] = useState(false)

    const formatted = useMemo(() => {
        try {
            const parsed = JSON.parse(content)
            return JSON.stringify(parsed, null, 2)
        } catch {
            return content
        }
    }, [content])

    const highlighted = useMemo(() => highlightJSON(formatted), [formatted])

    const handleCopy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(formatted)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Ignore
        }
    }

    return (
        <div className="json-block-wrapper group relative my-3">
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-t border-x border-purple-700/50 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-400">JSON</span>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="text-xs text-neutral-500 hover:text-neutral-300"
                    >
                        {collapsed ? '▶ Expand' : '▼ Collapse'}
                    </button>
                </div>
                <button
                    onClick={handleCopy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-purple-900/30 hover:bg-purple-800/40 text-purple-300 hover:text-purple-200 border border-purple-700/50"
                >
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            {!collapsed && (
                <pre className="bg-neutral-950 border border-purple-700/50 rounded-b-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                    <code
                        className="language-json text-sm"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                </pre>
            )}
        </div>
    )
}

function FormattedText({ content, query }: { content: string; query?: string }): JSX.Element {
    const formatted = useMemo(() => {
        let html = escapeHtml(content)

        // Apply query highlighting if present
        if (query) {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`(${escapedQuery})`, 'gi')
            html = html.replace(
                regex,
                (match) => `<span class="highlight">${match}</span>`
            )
        }

        // Convert URLs to links
        html = html.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>'
        )

        // Convert markdown-style bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-neutral-100">$1</strong>')

        // Convert markdown-style italic
        html = html.replace(/\*(.*?)\*/g, '<em class="italic text-neutral-200">$1</em>')

        // Convert markdown-style inline code
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

        return html
    }, [content, query])

    return (
        <div
            className="formatted-text whitespace-pre-wrap break-words leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatted }}
        />
    )
}

// Helper functions
function isJSON(str: string): boolean {
    if (!str.startsWith('{') && !str.startsWith('[')) return false
    try {
        JSON.parse(str)
        return true
    } catch {
        return false
    }
}

function looksLikeCode(content: string): boolean {
    const codeIndicators = [
        /^(function|const|let|var|class|import|export|interface|type)\s/m,
        /[{}\[\]();]/,
        /^\s{2,}/m, // Indentation
        /=>/,
        /:.*[{;]$/m
    ]

    let matches = 0
    for (const pattern of codeIndicators) {
        if (pattern.test(content)) matches++
    }

    return matches >= 2
}

function detectLanguage(content: string): string {
    if (/^(import|export|const|let|var|function|class)/.test(content)) {
        if (content.includes('interface') || content.includes(': ')) return 'typescript'
        return 'javascript'
    }
    if (/^(def|class|import|from)/.test(content)) return 'python'
    if (/^(package|func|type|var)/.test(content)) return 'go'
    return 'text'
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function highlightJSON(json: string): string {
    return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
        .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
}

function highlightCode(code: string, language: string): string {
    const escaped = escapeHtml(code)

    // Basic syntax highlighting for common languages
    if (language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx') {
        return escaped
            .replace(/\b(const|let|var|function|class|if|else|return|import|export|from|default|async|await|interface|type|extends|implements)\b/g, '<span class="syntax-keyword">$1</span>')
            .replace(/\b(true|false|null|undefined)\b/g, '<span class="syntax-boolean">$1</span>')
            .replace(/'([^']*)'/g, '<span class="syntax-string">\'$1\'</span>')
            .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
            .replace(/`([^`]*)`/g, '<span class="syntax-string">`$1`</span>')
            .replace(/\/\/(.*?)$/gm, '<span class="syntax-comment">//$1</span>')
    }

    if (language === 'json') {
        return highlightJSON(escaped)
    }

    return escaped
}
