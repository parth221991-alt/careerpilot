/**
 * One-time interactive Naukri login — saves session cookies to Supabase Storage.
 * Run: npx tsx workers/scrapers/naukri-login.ts
 *
 * This opens a real browser window. Log in manually, then press Enter in the
 * terminal. Cookies are stored in Supabase Storage private bucket "sessions"
 * at path naukri/{userId}/session.json (REQ-017).
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (admin access for storage)
 *   NAUKRI_USER_ID — your CareerPilot user UUID
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.NAUKRI_USER_ID

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[CareerPilot] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
  process.exit(1)
}

if (!userId) {
  console.error('[CareerPilot] NAUKRI_USER_ID must be set in .env.local (your CareerPilot user UUID)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function saveSessionToSupabase(cookies: object[], loginUrl: string): Promise<void> {
  const sessionData = { cookies, savedAt: new Date().toISOString(), url: loginUrl }
  const json = JSON.stringify(sessionData)
  const storagePath = `naukri/${userId}/session.json`

  // Remove old session if it exists
  await supabase.storage.from('sessions').remove([storagePath]).catch(() => null)

  const { error } = await supabase.storage
    .from('sessions')
    .upload(storagePath, Buffer.from(json), {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`)
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 50 })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('https://www.naukri.com/nlogin/login')
  console.log('\n[CareerPilot] Browser opened. Log into Naukri manually.')
  console.log('[CareerPilot] Complete any OTP/CAPTCHA verification if prompted.')
  console.log('[CareerPilot] When you reach the Naukri home/dashboard page, press Enter here...\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>(resolve => rl.question('', () => { rl.close(); resolve() }))

  const currentUrl = page.url()
  if (currentUrl.includes('/nlogin') || currentUrl.includes('/login')) {
    console.error('[CareerPilot] ERROR: Still on login page. Please log in before pressing Enter.')
    await browser.close()
    process.exit(1)
  }

  const cookies = await context.cookies()
  console.log(`[CareerPilot] Captured ${cookies.length} cookies. Uploading to Supabase Storage...`)

  try {
    await saveSessionToSupabase(cookies, currentUrl)
    console.log(`[CareerPilot] Session saved to Supabase Storage: naukri/${userId}/session.json`)
    console.log('[CareerPilot] The apply worker will fetch this session for automated Naukri applications.')
  } catch (err) {
    console.error('[CareerPilot] ERROR saving session:', err)
    await browser.close()
    process.exit(1)
  }

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
