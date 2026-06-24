/**
 * Gmail OAuth2 client.
 *
 * Setup:
 * 1. Create a Google Cloud project and enable Gmail API
 * 2. Create OAuth2 credentials (Web application) in Google Cloud Console
 * 3. Add redirect URI: http://localhost:3003/api/email/oauth/callback
 * 4. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env.local
 *
 * Flow:
 * - User clicks "Connect Gmail" → /api/email/oauth/start
 * - Google redirects back → /api/email/oauth/callback
 * - Tokens stored in Supabase user metadata (encrypted at rest)
 * - /api/email/sync polls Gmail every 15 min via BullMQ emailQueue
 */

import { createClient } from '@/lib/supabase/server'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

export function getGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/callback`,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGmailCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshGmailToken(refreshToken: string): Promise<{
  access_token: string
  expiry_date: number
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  }
}

type GmailTokens = {
  access_token: string
  refresh_token: string
  expiry_date: number
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const tokens = user.user_metadata?.gmail_tokens as GmailTokens | undefined
  if (!tokens?.access_token) throw new Error('Gmail not connected')

  if (Date.now() < tokens.expiry_date - 60_000) {
    return tokens.access_token
  }

  const refreshed = await refreshGmailToken(tokens.refresh_token)
  await supabase.auth.updateUser({
    data: {
      gmail_tokens: { ...tokens, ...refreshed },
    },
  })
  void userId // used for logging context
  return refreshed.access_token
}

export async function fetchGmailThreads(
  accessToken: string,
  query = 'category:primary newer_than:7d',
  maxResults = 50,
): Promise<string[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`)
  const data = await res.json()
  return (data.threads ?? []).map((t: { id: string }) => t.id)
}

export async function fetchGmailThread(
  accessToken: string,
  threadId: string,
): Promise<{
  id: string
  subject: string
  snippet: string
  from: string
  date: Date
  body: string
}> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(`Gmail thread fetch failed: ${res.status}`)
  const data = await res.json()

  const firstMsg = data.messages?.[0]
  const headers = (firstMsg?.payload?.headers ?? []) as { name: string; value: string }[]
  const subject = headers.find(h => h.name === 'Subject')?.value ?? ''
  const from = headers.find(h => h.name === 'From')?.value ?? ''
  const dateStr = headers.find(h => h.name === 'Date')?.value ?? ''

  const bodyPart = firstMsg?.payload?.body?.data
    ?? firstMsg?.payload?.parts?.find((p: { mimeType: string }) => p.mimeType === 'text/plain')?.body?.data
    ?? ''

  const body = bodyPart ? Buffer.from(bodyPart, 'base64').toString('utf-8') : data.snippet ?? ''

  return {
    id: threadId,
    subject,
    snippet: data.snippet ?? '',
    from,
    date: dateStr ? new Date(dateStr) : new Date(),
    body: body.slice(0, 4000),
  }
}
