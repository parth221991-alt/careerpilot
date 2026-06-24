import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { getGmailAuthUrl } from '@/lib/gmail/client'
import { randomBytes } from 'crypto'

export async function GET(_req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = randomBytes(16).toString('hex')
  const url = getGmailAuthUrl(state)

  return NextResponse.redirect(url)
}
