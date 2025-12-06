import FlexSearch from 'flexsearch'
import type { Conversation } from './scanner'

export interface SearchResult {
  id: string
  projectName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

interface IndexedDocument {
  id: string
  projectName: string
  content: string
  timestamp: string
  messageCount: number
}

export class SearchIndexer {
  private index: FlexSearch.Document<IndexedDocument>
  private documents: Map<string, IndexedDocument> = new Map()

  constructor() {
    this.index = new FlexSearch.Document<IndexedDocument>({
      document: {
        id: 'id',
        index: ['content', 'projectName'],
        store: ['id', 'projectName', 'timestamp', 'messageCount']
      },
      tokenize: 'forward',
      resolution: 9,
      cache: 100
    })
  }

  async buildIndex(conversations: Conversation[]): Promise<void> {
    this.documents.clear()

    for (const conv of conversations) {
      const doc: IndexedDocument = {
        id: conv.id,
        projectName: conv.projectName,
        content: conv.fullText,
        timestamp: conv.timestamp,
        messageCount: conv.messageCount
      }

      this.documents.set(conv.id, doc)
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

        // Apply project filter
        if (projectFilter && !doc.projectName.includes(projectFilter)) {
          continue
        }

        const preview = this.generatePreview(doc.content, query)

        searchResults.push({
          id: doc.id,
          projectName: doc.projectName,
          preview,
          timestamp: doc.timestamp,
          messageCount: doc.messageCount,
          score: 1
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
      docs = docs.filter((d) => d.projectName.includes(projectFilter))
    }

    // Sort by timestamp descending
    docs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      projectName: doc.projectName,
      preview: this.truncateText(doc.content, 200),
      timestamp: doc.timestamp,
      messageCount: doc.messageCount,
      score: 1
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
}
