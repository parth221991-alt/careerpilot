'use client'

import { useState, useEffect } from 'react'
import { Bot, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react'
import { format } from 'date-fns'

type StatusData = {
  status: string
  gateStatus: string | null
  workerStatus: string | null
  screenshotUrl: string | null
  dailyCount: number
  dailyLimit: number
  appliedAt: string | null
  isAutoApplied: boolean
}

type Props = {
  applicationId: string
  initialStatus: string
  supabaseUrl: string
}

const POLL_INTERVAL_MS = 5000

export function ApplyProgressPanel({ applicationId, initialStatus, supabaseUrl }: Props) {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)

  const isPending = (d: StatusData | null) =>
    d && (d.status === 'APPROVAL_PENDING' || d.gateStatus === 'PENDING')

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/apply/status/${applicationId}`)
      if (res.ok) {
        const json = await res.json() as StatusData
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  // REQ-020: Poll every 5s while pending (gate or worker in-progress)
  useEffect(() => {
    if (initialStatus !== 'APPROVAL_PENDING' && initialStatus !== 'APPLIED') return

    const id = setInterval(() => {
      if (!isPending(data) && data?.status === 'APPLIED') {
        clearInterval(id)
        return
      }
      void fetchStatus()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, initialStatus])

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading apply status...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-chivo font-bold text-sm text-foreground flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5 text-indigo-400" />
        Apply Progress
      </h3>

      {/* Gate status */}
      {data.gateStatus && (
        <div className="flex items-center gap-2">
          {data.gateStatus === 'PENDING' && <Clock className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
          {data.gateStatus === 'APPROVED' && <CheckCircle className="w-3.5 h-3.5 text-profit" />}
          {data.gateStatus === 'REJECTED' && <XCircle className="w-3.5 h-3.5 text-loss" />}
          {data.gateStatus === 'EXPIRED' && <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
          <p className="text-xs text-foreground">
            Gate: <span className="font-mono">{data.gateStatus}</span>
          </p>
        </div>
      )}

      {/* Application status */}
      <div className="flex items-center gap-2">
        {data.status === 'APPLIED' && data.isAutoApplied
          ? <CheckCircle className="w-3.5 h-3.5 text-profit" />
          : data.status === 'APPROVAL_PENDING'
          ? <Clock className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
          : <div className="w-3.5 h-3.5 rounded-full border border-border" />}
        <p className="text-xs text-foreground">
          Status: <span className="font-mono">{data.status.replace(/_/g, ' ')}</span>
        </p>
        {isPending(data) && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* Applied at */}
      {data.appliedAt && (
        <p className="text-muted-foreground text-[10px]">
          Applied {format(new Date(data.appliedAt), 'MMM d, yyyy HH:mm')}
        </p>
      )}

      {/* Screenshot proof */}
      {data.screenshotUrl && (
        <a
          href={`${supabaseUrl}/storage/v1/object/public/screenshots/${data.screenshotUrl}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-400 hover:underline block"
        >
          View screenshot proof
        </a>
      )}

      {/* REQ-020: Daily quota indicator */}
      {data.dailyLimit > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground">Daily applies</p>
            <p className="text-[10px] font-mono text-foreground">
              {data.dailyCount} / {data.dailyLimit}
            </p>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-1 rounded-full ${data.dailyCount >= data.dailyLimit ? 'bg-loss' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(100, (data.dailyCount / data.dailyLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
