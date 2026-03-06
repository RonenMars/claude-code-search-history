import FlexSearch from 'flexsearch'
import type { Account, ConversationMeta, SearchResult } from '../../shared/types'

interface IndexedDocument {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  content: string
  timestamp: string
  messageCount: number
  preview: string
  lastMessageSender: 'user' | 'assistant'
  account: Account
}

export class SearchIndexer {
  private index: FlexSearch.Document<IndexedDocument>
  private documents: Map<string, IndexedDocument> = new Map()

  constructor() {
    this.index = new FlexSearch.Document<IndexedDocument>({
      document: {
        id: 'id',
        index: ['content', 'projectName', 'sessionId', 'sessionName'],
        store: ['id', 'projectName', 'projectPath', 'sessionId', 'sessionName', 'timestamp', 'messageCount', 'lastMessageSender', 'account']
      },
      tokenize: 'forward',
      resolution: 9,
      cache: 100
    })
  }

  async buildIndex(metas: ConversationMeta[]): Promise<void> {
    this.documents.clear()

    for (const meta of metas) {
      const doc: IndexedDocument = {
        id: meta.id,
        projectName: meta.projectName,
        projectPath: meta.projectPath,
        sessionId: meta.sessionId,
        sessionName: meta.sessionName,
        content: meta.contentSnippet,
        timestamp: meta.timestamp,
        messageCount: meta.messageCount,
        preview: meta.preview,
        lastMessageSender: meta.lastMessageSender,
        account: meta.account,
      }

      this.documents.set(meta.id, doc)
      this.index.add(doc)
    }
  }

  search(query: string, limit: number = 50, projectFilter?: string): SearchResult[] {
    if (!query.trim()) {
      // Return most recent conversations if no query
      return this.getRecent(limit, projectFilter)
    }

    const results = this.index.search(query, {
      limit: limit * 2, // Get extra to account for filtering
      enrich: true
    })

    const seen = new Set<string>()
    const searchResults: SearchResult[] = []

    // FlexSearch returns results grouped by field
    for (const fieldResult of results) {
      if (!fieldResult.result) continue

      for (const item of fieldResult.result) {
        const id = typeof item === 'object' ? item.id : item
        if (seen.has(String(id))) continue
        seen.add(String(id))

        const doc = this.documents.get(String(id))
        if (!doc) continue

        // Apply project filter on the full path
        if (projectFilter && doc.projectPath !== projectFilter) {
          continue
        }

        const preview = this.generatePreview(doc.content, query)

        searchResults.push({
          id: doc.id,
          projectName: doc.projectName,
          projectPath: doc.projectPath,
          sessionId: doc.sessionId,
          sessionName: doc.sessionName,
          preview,
          timestamp: doc.timestamp,
          messageCount: doc.messageCount,
          score: 1,
          lastMessageSender: doc.lastMessageSender,
          account: doc.account,
        })

        if (searchResults.length >= limit) break
      }

      if (searchResults.length >= limit) break
    }

    return searchResults
  }

  private getRecent(limit: number, projectFilter?: string): SearchResult[] {
    let docs = Array.from(this.documents.values())

    if (projectFilter) {
      docs = docs.filter((d) => d.projectPath === projectFilter)
    }

    // Sort by timestamp descending
    docs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      projectName: doc.projectName,
      projectPath: doc.projectPath,
      sessionId: doc.sessionId,
      sessionName: doc.sessionName,
      preview: doc.preview || this.truncateText(doc.content, 200),
      timestamp: doc.timestamp,
      messageCount: doc.messageCount,
      score: 1,
      lastMessageSender: doc.lastMessageSender,
      account: doc.account,
    }))
  }

  private generatePreview(content: string, query: string): string {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerContent.indexOf(lowerQuery)

    if (index === -1) {
      return this.truncateText(content, 200)
    }

    // Get context around the match
    const start = Math.max(0, index - 80)
    const end = Math.min(content.length, index + query.length + 120)

    let preview = content.slice(start, end)
    if (start > 0) preview = '...' + preview
    if (end < content.length) preview = preview + '...'

    return preview
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  getDocumentCount(): number {
    return this.documents.size
  }

  getDailyStats(granularity: 'day' | 'week' | 'month', limit: number): Array<{ date: string; conversations: number; messages: number }> {
    const buckets = new Map<string, { conversations: number; messages: number }>()

    for (const doc of this.documents.values()) {
      const d = new Date(doc.timestamp)
      let key: string

      if (granularity === 'day') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } else if (granularity === 'week') {
        const dayOfWeek = d.getDay()
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
        key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }

      const existing = buckets.get(key) ?? { conversations: 0, messages: 0 }
      buckets.set(key, {
        conversations: existing.conversations + 1,
        messages: existing.messages + doc.messageCount
      })
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, limit)
      .reverse()
      .map(([date, stats]) => ({ date, ...stats }))
  }

  getStatsByAccount(): Record<string, { messages: number; projects: number }> {
    const acc: Record<string, { messages: number; projects: Set<string> }> = {}
    for (const doc of this.documents.values()) {
      if (!acc[doc.account]) acc[doc.account] = { messages: 0, projects: new Set() }
      acc[doc.account].messages += doc.messageCount
      acc[doc.account].projects.add(doc.projectPath)
    }
    return Object.fromEntries(
      Object.entries(acc).map(([id, v]) => [id, { messages: v.messages, projects: v.projects.size }])
    )
  }
}
