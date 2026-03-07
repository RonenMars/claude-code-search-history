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
