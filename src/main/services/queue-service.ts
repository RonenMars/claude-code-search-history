// ─── Queue Service ────────────────────────────────────────────────────────────
// Persists prompt queues to ~/.threadbase/queues/<sessionId>.json
// Loaded on startup, saved on every mutation.

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { QueuedPrompt, SessionQueue } from '../../shared/types'

function queuesDir(): string {
  return join(homedir(), '.threadbase', 'queues')
}

function queuePath(sessionId: string): string {
  return join(queuesDir(), `${sessionId}.json`)
}

async function ensureDir(): Promise<void> {
  await mkdir(queuesDir(), { recursive: true })
}

export async function loadQueue(sessionId: string): Promise<SessionQueue> {
  try {
    const data = await readFile(queuePath(sessionId), 'utf-8')
    return JSON.parse(data) as SessionQueue
  } catch {
    return { sessionId, prompts: [], paused: false }
  }
}

export async function saveQueue(queue: SessionQueue): Promise<void> {
  await ensureDir()
  await writeFile(queuePath(queue.sessionId), JSON.stringify(queue, null, 2), 'utf-8')
}

export async function addToQueue(sessionId: string, text: string): Promise<SessionQueue> {
  const queue = await loadQueue(sessionId)
  const prompt: QueuedPrompt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    addedAt: new Date().toISOString(),
    status: 'pending',
  }
  queue.prompts.push(prompt)
  await saveQueue(queue)
  return queue
}

export async function removeFromQueue(sessionId: string, promptId: string): Promise<SessionQueue> {
  const queue = await loadQueue(sessionId)
  queue.prompts = queue.prompts.filter((p) => p.id !== promptId)
  await saveQueue(queue)
  return queue
}

export async function reorderQueue(sessionId: string, orderedIds: string[]): Promise<SessionQueue> {
  const queue = await loadQueue(sessionId)
  const map = new Map(queue.prompts.map((p) => [p.id, p]))
  queue.prompts = orderedIds.map((id) => map.get(id)).filter(Boolean) as QueuedPrompt[]
  await saveQueue(queue)
  return queue
}

export async function clearQueue(sessionId: string): Promise<SessionQueue> {
  const queue: SessionQueue = { sessionId, prompts: [], paused: false }
  await saveQueue(queue)
  return queue
}

export async function setPaused(sessionId: string, paused: boolean): Promise<SessionQueue> {
  const queue = await loadQueue(sessionId)
  queue.paused = paused
  await saveQueue(queue)
  return queue
}

export async function markPromptStatus(
  sessionId: string,
  promptId: string,
  status: QueuedPrompt['status'],
): Promise<SessionQueue> {
  const queue = await loadQueue(sessionId)
  const p = queue.prompts.find((x) => x.id === promptId)
  if (p) p.status = status
  await saveQueue(queue)
  return queue
}

export async function loadAllQueues(): Promise<SessionQueue[]> {
  await ensureDir()
  try {
    const files = await readdir(queuesDir())
    const queues = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map((f) => loadQueue(f.replace('.json', ''))),
    )
    return queues
  } catch {
    return []
  }
}

export async function deleteQueueFile(sessionId: string): Promise<void> {
  try {
    await unlink(queuePath(sessionId))
  } catch {
    // file may not exist
  }
}
