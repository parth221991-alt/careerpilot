'use client'

import type { Application, Job, ApprovalGate } from '@prisma/client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'

type AppWithRelations = Application & {
  job: Job
  approvalGates: ApprovalGate[]
}

type Props = { applications: AppWithRelations[] }

export function ApprovalQueue({ applications }: Props) {
  const [loading, setLoading] = useState<Record<string, 'approve' | 'reject' | null>>({})
  const [done, setDone] = useState<Set<string>>(new Set())

  async function handleApprove(appId: string) {
    setLoading(prev => ({ ...prev, [appId]: 'approve' }))
    await fetch(`/api/applications/${appId}/approve`, { method: 'POST' })
    setDone(prev => new Set([...prev, appId]))
    setLoading(prev => ({ ...prev, [appId]: null }))
  }

  async function handleReject(appId: string) {
    setLoading(prev => ({ ...prev, [appId]: 'reject' }))
    await fetch(`/api/applications/${appId}/approve`, { method: 'DELETE' })
    setDone(prev => new Set([...prev, appId]))
    setLoading(prev => ({ ...prev, [appId]: null }))
  }

  const pending = applications.filter(a => !done.has(a.id))

  if (pending.length === 0) return null

  return (
    <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-yellow-400" />
        <h3 className="font-chivo font-bold text-yellow-400 text-sm">
          {pending.length} application{pending.length > 1 ? 's' : ''} awaiting approval
        </h3>
      </div>
      <div className="space-y-3">
        {pending.map(app => {
          const gate = app.approvalGates[0]
          const isLoading = loading[app.id]
          return (
            <div key={app.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm">{app.job.title}</p>
                <p className="text-muted-foreground text-xs">{app.job.company} · {app.job.platform}</p>
                {gate && (
                  <p className="text-muted-foreground text-xs mt-1">
                    Action: <span className="text-foreground">{gate.actionType.replace(/_/g, ' ')}</span>
                    {gate.expiresAt && (
                      <span> · Expires {new Date(gate.expiresAt).toLocaleDateString()}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex gap-2">
                <button
                  onClick={() => handleReject(app.id)}
                  disabled={!!isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-loss/30 text-loss hover:bg-loss/10 rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoading === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Decline
                </button>
                <button
                  onClick={() => handleApprove(app.id)}
                  disabled={!!isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-profit/10 border border-profit/30 text-profit hover:bg-profit/20 rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoading === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
