import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeGmailCode } from '@/lib/gmail/client'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('gmail-oauth')

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    logger.warn('Gmail OAuth error', { error })
    return NextResponse.redirect(`${origin}/email?error=gmail_oauth_failed`)
  }

  try {
    const tokens = await exchangeGmailCode(code)
    const supabase = await createClient()

    await supabase.auth.updateUser({
      data: { gmail_tokens: tokens, gmail_connected: true },
    })

    logger.info('Gmail connected successfully')
    return NextResponse.redirect(`${origin}/email?connected=1`)
  } catch (err) {
    logger.error('Gmail OAuth callback failed', { err: String(err) })
    return NextResponse.redirect(`${origin}/email?error=gmail_token_exchange_failed`)
  }
}
