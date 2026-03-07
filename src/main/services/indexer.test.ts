import { describe, it, expect, beforeEach } from 'vitest'
import { SearchIndexer } from './indexer'
import { buildConversationMeta, resetFactoryCounter } from '../../test/factories'

describe('SearchIndexer', () => {
  let indexer: SearchIndexer

  beforeEach(() => {
    resetFactoryCounter()
    indexer = new SearchIndexer()
  })

  // ─── buildIndex ──────────────────────────────────────────────────

  describe('buildIndex', () => {
    it('indexes all provided ConversationMeta documents', async () => {
      const metas = [
        buildConversationMeta(),
        buildConversationMeta(),
        buildConversationMeta(),
      ]

      await indexer.buildIndex(metas)

      expect(indexer.getDocumentCount()).toBe(3)
    })

    it('clears previous documents on rebuild', async () => {
      await indexer.buildIndex([buildConversationMeta(), buildConversationMeta()])
      expect(indexer.getDocumentCount()).toBe(2)

      resetFactoryCounter()
      await indexer.buildIndex([buildConversationMeta()])
      expect(indexer.getDocumentCount()).toBe(1)
    })

    it('handles empty array', async () => {
      await indexer.buildIndex([])
      expect(indexer.getDocumentCount()).toBe(0)
    })
  })

  // ─── search with query ──────────────────────────────────────────

  describe('search with query', () => {
    it('returns matching results for a term in contentSnippet', async () => {
      const metas = [
        buildConversationMeta({ contentSnippet: 'Implementing a binary search algorithm in TypeScript' }),
        buildConversationMeta({ contentSnippet: 'Setting up Docker containers for production' }),
        buildConversationMeta({ contentSnippet: 'Writing unit tests with Vitest framework' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('Docker')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe(metas[1].id)
      expect(results[0].projectName).toBe(metas[1].projectName)
      expect(results[0].projectPath).toBe(metas[1].projectPath)
      expect(results[0].sessionId).toBe(metas[1].sessionId)
      expect(results[0].timestamp).toBe(metas[1].timestamp)
      expect(results[0].messageCount).toBe(metas[1].messageCount)
      expect(results[0].lastMessageSender).toBe(metas[1].lastMessageSender)
      expect(results[0].account).toBe(metas[1].account)
    })

    it('returns preview with context around the match', async () => {
      const content = 'Setting up Docker containers for production deployment across multiple environments'
      const metas = [buildConversationMeta({ contentSnippet: content })]

      await indexer.buildIndex(metas)

      const results = indexer.search('Docker')

      expect(results.length).toBe(1)
      expect(results[0].preview).toContain('Docker')
    })

    it('matches on projectName field', async () => {
      const metas = [
        buildConversationMeta({ projectName: 'alpha-service' }),
        buildConversationMeta({ projectName: 'beta-service' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('alpha')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe(metas[0].id)
    })

    it('matches on sessionName field', async () => {
      const metas = [
        buildConversationMeta({ sessionName: 'refactor-auth-module' }),
        buildConversationMeta({ sessionName: 'fix-database-query' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('refactor')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe(metas[0].id)
    })
  })

  // ─── search with empty query ────────────────────────────────────

  describe('search with empty query', () => {
    it('returns most recent conversations sorted by timestamp descending', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-10T10:00:00Z' }),
        buildConversationMeta({ timestamp: '2025-01-15T10:00:00Z' }),
        buildConversationMeta({ timestamp: '2025-01-12T10:00:00Z' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      expect(results.length).toBe(3)
      expect(results[0].id).toBe(metas[1].id) // Jan 15
      expect(results[1].id).toBe(metas[2].id) // Jan 12
      expect(results[2].id).toBe(metas[0].id) // Jan 10
    })

    it('treats whitespace-only query as empty', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-10T10:00:00Z' }),
        buildConversationMeta({ timestamp: '2025-01-15T10:00:00Z' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('   ')

      expect(results.length).toBe(2)
      expect(results[0].id).toBe(metas[1].id) // most recent first
    })

    it('uses preview field when available, falls back to truncated content', async () => {
      const metas = [
        buildConversationMeta({ preview: 'Custom preview text', contentSnippet: 'Some content' }),
        buildConversationMeta({ preview: '', contentSnippet: 'Fallback content snippet' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      const withPreview = results.find((r) => r.id === metas[0].id)!
      const withoutPreview = results.find((r) => r.id === metas[1].id)!

      expect(withPreview.preview).toBe('Custom preview text')
      expect(withoutPreview.preview).toBe('Fallback content snippet')
    })
  })

  // ─── search with project filter ─────────────────────────────────

  describe('search with project filter', () => {
    it('only returns results matching projectPath', async () => {
      const metas = [
        buildConversationMeta({
          projectPath: '/home/user/dev/project-a',
          contentSnippet: 'Implementing feature for project',
        }),
        buildConversationMeta({
          projectPath: '/home/user/dev/project-b',
          contentSnippet: 'Implementing feature for project',
        }),
        buildConversationMeta({
          projectPath: '/home/user/dev/project-a',
          contentSnippet: 'Implementing feature for project',
        }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('feature', 50, '/home/user/dev/project-a')

      expect(results.length).toBe(2)
      expect(results.every((r) => r.projectPath === '/home/user/dev/project-a')).toBe(true)
    })

    it('applies project filter on empty query (getRecent)', async () => {
      const metas = [
        buildConversationMeta({ projectPath: '/path/a', timestamp: '2025-01-15T10:00:00Z' }),
        buildConversationMeta({ projectPath: '/path/b', timestamp: '2025-01-16T10:00:00Z' }),
        buildConversationMeta({ projectPath: '/path/a', timestamp: '2025-01-17T10:00:00Z' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('', 50, '/path/a')

      expect(results.length).toBe(2)
      expect(results[0].id).toBe(metas[2].id) // Jan 17
      expect(results[1].id).toBe(metas[0].id) // Jan 15
    })
  })

  // ─── search with limit ──────────────────────────────────────────

  describe('search with limit', () => {
    it('respects the limit parameter on query search', async () => {
      const metas = Array.from({ length: 10 }, (_, i) =>
        buildConversationMeta({ contentSnippet: `Implementing feature number ${i}` })
      )

      await indexer.buildIndex(metas)

      const results = indexer.search('feature', 3)

      expect(results.length).toBeLessThanOrEqual(3)
    })

    it('respects the limit parameter on empty query', async () => {
      const metas = Array.from({ length: 10 }, (_, i) =>
        buildConversationMeta({ timestamp: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
      )

      await indexer.buildIndex(metas)

      const results = indexer.search('', 3)

      expect(results.length).toBe(3)
      // Should be the 3 most recent
      expect(results[0].id).toBe(metas[9].id) // Jan 10
      expect(results[1].id).toBe(metas[8].id) // Jan 9
      expect(results[2].id).toBe(metas[7].id) // Jan 8
    })
  })

  // ─── generatePreview (tested via search) ────────────────────────

  describe('generatePreview', () => {
    it('returns context centered on the match with ellipsis when content is long', async () => {
      // Use real words so FlexSearch forward tokenizer can find them
      const prefix = Array.from({ length: 20 }, (_, i) => `prefix${i}`).join(' ') + ' '
      const suffix = ' ' + Array.from({ length: 40 }, (_, i) => `suffix${i}`).join(' ')
      const content = `${prefix}xylophoneword${suffix}`
      const metas = [buildConversationMeta({ contentSnippet: content })]

      await indexer.buildIndex(metas)

      const results = indexer.search('xylophoneword')

      expect(results.length).toBe(1)
      const preview = results[0].preview

      // Should contain the keyword
      expect(preview).toContain('xylophoneword')

      // Match is well past index 80, so start > 0 => leading ellipsis
      expect(preview.startsWith('...')).toBe(true)

      // Content extends well past the match window => trailing ellipsis
      expect(preview.endsWith('...')).toBe(true)
    })

    it('no leading ellipsis when match is near start of content', async () => {
      const content = 'KEYWORD' + 'X'.repeat(300)
      const metas = [buildConversationMeta({ contentSnippet: content })]

      await indexer.buildIndex(metas)

      const results = indexer.search('KEYWORD')

      expect(results.length).toBe(1)
      expect(results[0].preview.startsWith('...')).toBe(false)
      expect(results[0].preview.endsWith('...')).toBe(true)
    })

    it('no trailing ellipsis when match is near end of content', async () => {
      const content = 'some short intro text xylophoneword'
      const metas = [buildConversationMeta({ contentSnippet: content })]

      await indexer.buildIndex(metas)

      const results = indexer.search('xylophoneword')

      expect(results.length).toBe(1)
      expect(results[0].preview.endsWith('...')).toBe(false)
      expect(results[0].preview).toContain('xylophoneword')
    })

    it('returns truncated content when query is not found in content', async () => {
      // FlexSearch tokenize: "forward" can match partial tokens.
      // We search by projectName so the query won't appear in contentSnippet.
      const metas = [buildConversationMeta({
        projectName: 'xylophone-project',
        contentSnippet: 'This content does not contain the search term at all',
      })]

      await indexer.buildIndex(metas)

      const results = indexer.search('xylophone')

      expect(results.length).toBe(1)
      // generatePreview won't find "xylophone" in content, so it truncates
      expect(results[0].preview).toBe('This content does not contain the search term at all')
    })
  })

  // ─── truncateText (tested via getRecent preview fallback) ───────

  describe('truncateText', () => {
    it('returns short text as-is', async () => {
      const shortText = 'Short content'
      const metas = [buildConversationMeta({ preview: '', contentSnippet: shortText })]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      expect(results[0].preview).toBe(shortText)
    })

    it('truncates long text and appends ellipsis', async () => {
      const longText = 'W'.repeat(250)
      const metas = [buildConversationMeta({ preview: '', contentSnippet: longText })]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      expect(results[0].preview).toBe('W'.repeat(200) + '...')
      expect(results[0].preview.length).toBe(203)
    })

    it('text exactly at max length is returned as-is', async () => {
      const exactText = 'Z'.repeat(200)
      const metas = [buildConversationMeta({ preview: '', contentSnippet: exactText })]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      expect(results[0].preview).toBe(exactText)
    })
  })

  // ─── getRecent ──────────────────────────────────────────────────

  describe('getRecent (via empty search)', () => {
    it('returns conversations sorted by timestamp descending', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-03-01T10:00:00Z' }),
        buildConversationMeta({ timestamp: '2025-01-01T10:00:00Z' }),
        buildConversationMeta({ timestamp: '2025-02-01T10:00:00Z' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('')

      expect(results[0].timestamp).toBe('2025-03-01T10:00:00Z')
      expect(results[1].timestamp).toBe('2025-02-01T10:00:00Z')
      expect(results[2].timestamp).toBe('2025-01-01T10:00:00Z')
    })

    it('filters by project when projectFilter is provided', async () => {
      const metas = [
        buildConversationMeta({ projectPath: '/proj/x', timestamp: '2025-01-03T10:00:00Z' }),
        buildConversationMeta({ projectPath: '/proj/y', timestamp: '2025-01-02T10:00:00Z' }),
        buildConversationMeta({ projectPath: '/proj/x', timestamp: '2025-01-01T10:00:00Z' }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('', 50, '/proj/x')

      expect(results.length).toBe(2)
      expect(results[0].id).toBe(metas[0].id)
      expect(results[1].id).toBe(metas[2].id)
    })
  })

  // ─── getDailyStats ─────────────────────────────────────────────

  describe('getDailyStats', () => {
    it('aggregates by day granularity', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-15T10:00:00Z', messageCount: 5 }),
        buildConversationMeta({ timestamp: '2025-01-15T14:00:00Z', messageCount: 3 }),
        buildConversationMeta({ timestamp: '2025-01-16T10:00:00Z', messageCount: 7 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('day', 100)

      expect(stats).toEqual([
        { date: '2025-01-15', conversations: 2, messages: 8 },
        { date: '2025-01-16', conversations: 1, messages: 7 },
      ])
    })

    it('aggregates by week granularity (Monday-based)', async () => {
      // 2025-01-13 is a Monday, 2025-01-20 is next Monday
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-13T10:00:00Z', messageCount: 2 }), // Mon
        buildConversationMeta({ timestamp: '2025-01-15T10:00:00Z', messageCount: 3 }), // Wed (same week)
        buildConversationMeta({ timestamp: '2025-01-19T10:00:00Z', messageCount: 4 }), // Sun (same week)
        buildConversationMeta({ timestamp: '2025-01-20T10:00:00Z', messageCount: 5 }), // Mon (next week)
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('week', 100)

      expect(stats).toEqual([
        { date: '2025-01-13', conversations: 3, messages: 9 },
        { date: '2025-01-20', conversations: 1, messages: 5 },
      ])
    })

    it('aggregates by month granularity', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-05T10:00:00Z', messageCount: 2 }),
        buildConversationMeta({ timestamp: '2025-01-20T10:00:00Z', messageCount: 3 }),
        buildConversationMeta({ timestamp: '2025-02-10T10:00:00Z', messageCount: 4 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('month', 100)

      expect(stats).toEqual([
        { date: '2025-01', conversations: 2, messages: 5 },
        { date: '2025-02', conversations: 1, messages: 4 },
      ])
    })

    it('respects limit and returns most recent N buckets in chronological order', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-01T10:00:00Z', messageCount: 1 }),
        buildConversationMeta({ timestamp: '2025-02-01T10:00:00Z', messageCount: 2 }),
        buildConversationMeta({ timestamp: '2025-03-01T10:00:00Z', messageCount: 3 }),
        buildConversationMeta({ timestamp: '2025-04-01T10:00:00Z', messageCount: 4 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('month', 2)

      // Should return the 2 most recent buckets, reversed for chronological order
      expect(stats).toEqual([
        { date: '2025-03', conversations: 1, messages: 3 },
        { date: '2025-04', conversations: 1, messages: 4 },
      ])
    })

    it('correctly sums conversations and messages', async () => {
      const metas = [
        buildConversationMeta({ timestamp: '2025-06-10T10:00:00Z', messageCount: 10 }),
        buildConversationMeta({ timestamp: '2025-06-10T14:00:00Z', messageCount: 20 }),
        buildConversationMeta({ timestamp: '2025-06-10T18:00:00Z', messageCount: 30 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('day', 100)

      expect(stats).toEqual([
        { date: '2025-06-10', conversations: 3, messages: 60 },
      ])
    })

    it('handles Sunday correctly in week granularity (rolls back to Monday)', async () => {
      // 2025-01-19 is a Sunday. Its Monday should be 2025-01-13.
      const metas = [
        buildConversationMeta({ timestamp: '2025-01-19T10:00:00Z', messageCount: 5 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getDailyStats('week', 100)

      expect(stats).toEqual([
        { date: '2025-01-13', conversations: 1, messages: 5 },
      ])
    })
  })

  // ─── getStatsByAccount ──────────────────────────────────────────

  describe('getStatsByAccount', () => {
    it('groups by account, sums messages, counts unique projects', async () => {
      const metas = [
        buildConversationMeta({ account: 'work', projectPath: '/proj/a', messageCount: 10 }),
        buildConversationMeta({ account: 'work', projectPath: '/proj/b', messageCount: 5 }),
        buildConversationMeta({ account: 'work', projectPath: '/proj/a', messageCount: 3 }),
        buildConversationMeta({ account: 'personal', projectPath: '/proj/c', messageCount: 7 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getStatsByAccount()

      expect(stats).toEqual({
        work: { messages: 18, projects: 2 },
        personal: { messages: 7, projects: 1 },
      })
    })

    it('returns empty object when no documents', async () => {
      await indexer.buildIndex([])

      const stats = indexer.getStatsByAccount()

      expect(stats).toEqual({})
    })

    it('handles single account with single project', async () => {
      const metas = [
        buildConversationMeta({ account: 'default', projectPath: '/proj/x', messageCount: 12 }),
      ]

      await indexer.buildIndex(metas)

      const stats = indexer.getStatsByAccount()

      expect(stats).toEqual({
        default: { messages: 12, projects: 1 },
      })
    })
  })

  // ─── Deduplication ──────────────────────────────────────────────

  describe('deduplication in search results', () => {
    it('returns no duplicate IDs when a document matches multiple indexed fields', async () => {
      // This document has "deploy" in both contentSnippet and projectName,
      // so FlexSearch may return it from both the content and projectName field results.
      const metas = [
        buildConversationMeta({
          projectName: 'deploy-service',
          contentSnippet: 'deploy the application to production',
        }),
      ]

      await indexer.buildIndex(metas)

      const results = indexer.search('deploy')

      const ids = results.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
      expect(results.length).toBe(1)
    })
  })

  // ─── Score field ────────────────────────────────────────────────

  describe('score field', () => {
    it('all search results have score: 1', async () => {
      const metas = [
        buildConversationMeta({ contentSnippet: 'working on feature implementation' }),
        buildConversationMeta({ contentSnippet: 'feature testing and validation' }),
      ]

      await indexer.buildIndex(metas)

      const queryResults = indexer.search('feature')
      for (const r of queryResults) {
        expect(r.score).toBe(1)
      }

      const recentResults = indexer.search('')
      for (const r of recentResults) {
        expect(r.score).toBe(1)
      }
    })
  })
})
