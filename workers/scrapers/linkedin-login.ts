/**
 * One-time interactive LinkedIn login to save session cookies.
 * Run: npx tsx workers/scrapers/linkedin-login.ts
 *
 * This opens a real browser window. Log in manually, then press Enter in the
 * terminal. The session cookies are saved to playwright-sessions/linkedin.json
 * and reused by the scraper worker.
 */

import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import * as readline from 'readline'

const SESSION_DIR = path.join(process.cwd(), 'playwright-sessions')
const SESSION_FILE = path.join(SESSION_DIR, 'linkedin.json')

async function main() {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 50 })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('https://www.linkedin.com/login')
  console.log('\n[CareerPilot] Browser opened. Log into LinkedIn manually.')
  console.log('[CareerPilot] When the home page loads, press Enter here...\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>(resolve => rl.question('', () => { rl.close(); resolve() }))

  const cookies = await context.cookies()
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2))
  console.log(`[CareerPilot] Session saved to ${SESSION_FILE}`)

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
