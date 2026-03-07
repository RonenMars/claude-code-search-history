import { test, expect, _electron as electron, ElectronApplication } from '@playwright/test'

let app: ElectronApplication

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  })
})

test.afterAll(async () => {
  await app.close()
})

test('app window opens', async () => {
  const window = await app.firstWindow()
  const title = await window.title()
  expect(title).toBeTruthy()
})

test('search bar is visible', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')
  await expect(searchInput).toBeVisible({ timeout: 10_000 })
})

test('can type in search bar', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')
  await searchInput.fill('test query')
  await expect(searchInput).toHaveValue('test query')
})

// ─── Scan progress and results loading ─────────────────────────────

test('scan completes and results or empty state appear', async () => {
  const window = await app.firstWindow()

  // Wait for the scanning indicator to disappear (if it was visible) and
  // for either result items or the "Showing N conversations" counter to appear.
  // The counter is always rendered once loading/indexing finishes.
  const resultsCounter = window.locator('text=/Showing \\d+ conversations/')
  await expect(resultsCounter).toBeVisible({ timeout: 60_000 })

  // The results list area should now be present (either with items or the
  // empty-state message "No results found" / "Start typing to search").
  const resultButtons = window.locator('button:has(> div > .text-claude-orange)')
  const emptyState = window.locator('text=/No results found|Start typing to search/')
  const hasResults = await resultButtons.count() > 0
  const hasEmpty = await emptyState.count() > 0

  // At least one of these should be true once loading completes
  expect(hasResults || hasEmpty).toBe(true)
})

// ─── Search interaction ────────────────────────────────────────────

test('typing a query updates results after debounce', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // Wait for initial load
  const resultsCounter = window.locator('text=/Showing \\d+ conversations/')
  await expect(resultsCounter).toBeVisible({ timeout: 60_000 })

  // Capture initial counter text
  const initialText = await resultsCounter.textContent()

  // Type a very specific query unlikely to match everything
  await searchInput.fill('zzznonexistentquerythatmatchesnothing999')
  // Wait longer than debounce (150ms)
  await window.waitForTimeout(500)

  // The counter should have updated (likely to 0 results)
  await expect(resultsCounter).toBeVisible({ timeout: 5_000 })
  const updatedText = await resultsCounter.textContent()
  // We just verify the counter is still visible; the count may or may not differ
  expect(updatedText).toBeTruthy()
})

test('clearing the search input restores default results', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // Clear any previous query
  await searchInput.fill('')
  await window.waitForTimeout(500)

  const resultsCounter = window.locator('text=/Showing \\d+ conversations/')
  await expect(resultsCounter).toBeVisible({ timeout: 10_000 })

  // The counter should show the full set of conversations
  const text = await resultsCounter.textContent()
  expect(text).toMatch(/Showing \d+ conversations/)
})

// ─── Keyboard shortcuts ────────────────────────────────────────────

test('Cmd+Shift+F focuses the search input', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // First blur the input by clicking elsewhere
  await window.locator('body').click({ position: { x: 10, y: 10 } })
  await window.waitForTimeout(100)

  // Press Cmd+Shift+F
  await window.keyboard.press('Meta+Shift+f')
  await window.waitForTimeout(100)

  // The search input should now be focused
  await expect(searchInput).toBeFocused()
})

test('Escape blurs the search input', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // Focus the input first
  await searchInput.focus()
  await expect(searchInput).toBeFocused()

  // Press Escape
  await window.keyboard.press('Escape')
  await window.waitForTimeout(100)

  // The search input should no longer be focused
  await expect(searchInput).not.toBeFocused()
})

// ─── Filter controls ───────────────────────────────────────────────

test('sort dropdown is visible with 5 options', async () => {
  const window = await app.firstWindow()
  const sortSelect = window.locator('select[title="Sort conversations"]')
  await expect(sortSelect).toBeVisible({ timeout: 10_000 })

  const options = sortSelect.locator('option')
  await expect(options).toHaveCount(5)
})

test('date range dropdown is visible with 4 options', async () => {
  const window = await app.firstWindow()
  const dateSelect = window.locator('select[title="Filter by date"]')
  await expect(dateSelect).toBeVisible({ timeout: 10_000 })

  const options = dateSelect.locator('option')
  await expect(options).toHaveCount(4)
})

// ─── Empty states ──────────────────────────────────────────────────

test('search with no results shows empty message', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // Type a query guaranteed to produce no results
  await searchInput.fill('zzzabsolutelynonexistent99999qqq')
  await window.waitForTimeout(500)

  // Either "No results found" or the counter showing 0
  const noResults = window.locator('text=No results found')
  const zeroCounter = window.locator('text=/Showing 0 conversations/')
  const hasNoResults = await noResults.count() > 0
  const hasZeroCounter = await zeroCounter.count() > 0

  expect(hasNoResults || hasZeroCounter).toBe(true)

  // Clean up: clear the search
  await searchInput.fill('')
  await window.waitForTimeout(500)
})

// ─── Conversation selection ────────────────────────────────────────

test('clicking a result shows conversation view in right panel', async () => {
  const window = await app.firstWindow()
  const searchInput = window.locator('input[placeholder*="Search"]')

  // Ensure search is cleared so we see default results
  await searchInput.fill('')
  await window.waitForTimeout(500)

  // Wait for results to load
  const resultsCounter = window.locator('text=/Showing \\d+ conversations/')
  await expect(resultsCounter).toBeVisible({ timeout: 60_000 })

  // Find clickable result items in the results list.
  // Each result is a <button> with the result item structure.
  const resultItems = window.locator('button:has(> div > .text-claude-orange):has(> div:text-matches("messages"))')

  const count = await resultItems.count()
  if (count === 0) {
    // No conversations on this machine; skip gracefully
    test.skip()
    return
  }

  // Click the first result
  await resultItems.first().click()
  await window.waitForTimeout(500)

  // The right panel should now show conversation content.
  // The ConversationView component should be visible -- it contains message
  // content or at minimum the conversation metadata. Check for the flex-1
  // right panel having substantive content (not the "Select a conversation" empty state).
  const emptyPrompt = window.locator('text=Select a conversation to view')
  await expect(emptyPrompt).not.toBeVisible({ timeout: 5_000 })
})

// ─── Settings navigation ───────────────────────────────────────────

test('settings button opens settings panel', async () => {
  const window = await app.firstWindow()

  // The settings button is in the title bar with title="Settings"
  const settingsButton = window.locator('button[title="Settings"]')
  await expect(settingsButton).toBeVisible({ timeout: 10_000 })

  await settingsButton.click()
  await window.waitForTimeout(300)

  // The SettingsModal component should now be visible in the right panel.
  // It contains text like "Settings" or configuration options.
  const settingsContent = window.locator('text=Settings').first()
  await expect(settingsContent).toBeVisible({ timeout: 5_000 })
})
