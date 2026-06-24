import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { detectGhostedApplications } from '@/lib/automation/ghosted-detector'

export async function POST() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ghostedCount = await detectGhostedApplications(userId)
  return NextResponse.json({ ghostedCount })
}
