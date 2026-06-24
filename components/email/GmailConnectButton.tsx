'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, CheckCircle } from 'lucide-react'
import Link from 'next/link'

type Props = {
  connected: boolean
}

export function GmailConnectButton({ connected }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ newCount: number; updatedCount: number } | null>(null)

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/email/sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setSyncResult(data)
    }
    setSyncing(false)
  }

  if (!connected) {
    return (
      <Link href="/api/email/oauth/start"
            className="flex items-center gap-2 text-xs bg-card border border-border px-3 py-1.5 rounded-md text-foreground hover:bg-accent transition-colors">
        Connect Gmail
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {syncResult && (
        <span className="text-profit text-xs flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {syncResult.newCount} new
        </span>
      )}
      <button
        onClick={syncNow}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs bg-card border border-border px-3 py-1.5 rounded-md text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {syncing
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <RefreshCw className="w-3 h-3" />
        }
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  )
}
