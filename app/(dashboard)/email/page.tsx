'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { GmailConnectButton } from '@/components/email/GmailConnectButton'
import { Mail, RefreshCw, AlertCircle, Calendar, XCircle, HelpCircle, Send, Check, Link2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type ClassType = 'INTERVIEW_INVITE' | 'REJECTION' | 'ASSESSMENT' | 'OFFER' | 'FOLLOW_UP' | 'FOLLOW_UP_NEEDED' | 'GHOSTED' | 'GENERAL'

type Thread = {
  id: string
  subject: string
  fromEmail: string
  classification: ClassType | null
  urgency: string | null
  summary: string | null
  isRead: boolean
  lastEmailAt: string
  applicationId: string | null
  draftReply: string | null
  followUpSentAt: string | null
}

type ApplicationOption = {
  id: string
  job: { title: string; company: string }
}

const CLASS_COLORS: Partial<Record<ClassType, string>> = {
  INTERVIEW_INVITE: 'text-profit bg-profit/10',
  REJECTION: 'text-loss bg-loss/10',
  ASSESSMENT: 'text-yellow-400 bg-yellow-400/10',
  OFFER: 'text-profit bg-profit/10',
  FOLLOW_UP: 'text-blue-400 bg-blue-400/10',
  FOLLOW_UP_NEEDED: 'text-amber-400 bg-amber-400/10',
  GHOSTED: 'text-muted-foreground bg-muted',
  GENERAL: 'text-muted-foreground bg-muted',
}

type Tab = 'action' | 'interviews' | 'rejections' | 'unmatched'

const TABS: { id: Tab; label: string; icon: typeof Mail }[] = [
  { id: 'action', label: 'Action Required', icon: AlertCircle },
  { id: 'interviews', label: 'Interviews', icon: Calendar },
  { id: 'rejections', label: 'Rejections', icon: XCircle },
  { id: 'unmatched', label: 'Unmatched', icon: HelpCircle },
]

export default function EmailPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('action')
  const [sendingFollowUp, setSendingFollowUp] = useState<string | null>(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  // REQ-018: mark as read state
  const [markingRead, setMarkingRead] = useState<string | null>(null)
  // REQ-019: link-to-application state
  const [linkingThreadId, setLinkingThreadId] = useState<string | null>(null)
  const [applications, setApplications] = useState<ApplicationOption[]>([])
  const [appSearch, setAppSearch] = useState('')
  const [linking, setLinking] = useState(false)
  const linkDropdownRef = useRef<HTMLDivElement>(null)

  const loadThreads = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/email/threads')
    if (res.ok) {
      const data = await res.json() as { threads: Thread[]; gmailConnected?: boolean }
      setThreads(data.threads)
      setGmailConnected(data.gmailConnected ?? false)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadThreads() }, [loadThreads])

  // Close link dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(e.target as Node)) {
        setLinkingThreadId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSync() {
    setSyncing(true)
    await fetch('/api/email/sync', { method: 'POST' })
    await loadThreads()
    setSyncing(false)
  }

  async function handleFollowUp(thread: Thread) {
    if (!thread.applicationId) return
    setSendingFollowUp(thread.id)
    try {
      await fetch('/api/email/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: thread.applicationId }),
      })
      await loadThreads()
    } finally {
      setSendingFollowUp(null)
    }
  }

  // REQ-018: Mark thread as read
  async function handleMarkRead(thread: Thread) {
    if (thread.isRead) return
    setMarkingRead(thread.id)
    try {
      const res = await fetch(`/api/email/threads/${thread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      })
      if (res.ok) {
        setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, isRead: true } : t))
      }
    } finally {
      setMarkingRead(null)
    }
  }

  // REQ-019: Open link-to-application dropdown and fetch applications
  async function openLinkDropdown(threadId: string) {
    setLinkingThreadId(threadId)
    setAppSearch('')
    if (applications.length === 0) {
      const res = await fetch('/api/applications?status=APPLIED,SAVED,APPROVAL_PENDING&limit=100')
      if (res.ok) {
        const data = await res.json() as { applications?: ApplicationOption[] }
        setApplications(data.applications ?? [])
      }
    }
  }

  // REQ-019: Link thread to application
  async function handleLinkApplication(threadId: string, applicationId: string) {
    setLinking(true)
    try {
      const res = await fetch('/api/email/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, applicationId }),
      })
      if (res.ok) {
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, applicationId } : t))
        setLinkingThreadId(null)
      }
    } finally {
      setLinking(false)
    }
  }

  const filtered = threads.filter(t => {
    if (activeTab === 'action') return ['ASSESSMENT', 'FOLLOW_UP', 'FOLLOW_UP_NEEDED'].includes(t.classification ?? '')
    if (activeTab === 'interviews') return ['INTERVIEW_INVITE', 'OFFER'].includes(t.classification ?? '')
    if (activeTab === 'rejections') return ['REJECTION', 'GHOSTED'].includes(t.classification ?? '')
    if (activeTab === 'unmatched') return !t.applicationId
    return true
  })

  const tabCounts: Record<Tab, number> = {
    action: threads.filter(t => ['ASSESSMENT', 'FOLLOW_UP', 'FOLLOW_UP_NEEDED'].includes(t.classification ?? '')).length,
    interviews: threads.filter(t => ['INTERVIEW_INVITE', 'OFFER'].includes(t.classification ?? '')).length,
    rejections: threads.filter(t => ['REJECTION', 'GHOSTED'].includes(t.classification ?? '')).length,
    unmatched: threads.filter(t => !t.applicationId).length,
  }

  const filteredApps = applications.filter(a => {
    const q = appSearch.toLowerCase()
    return !q || a.job.company.toLowerCase().includes(q) || a.job.title.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Gmail Intelligence"
        subtitle={`${threads.filter(t => !t.isRead).length} unread · ${threads.length} threads`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || !gmailConnected}
              className="flex items-center gap-1.5 text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <GmailConnectButton connected={gmailConnected} />
          </div>
        }
      />

      {/* 4-tab layout */}
      <div className="border-b border-border">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const count = tabCounts[tab.id]
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Loading threads...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Mail className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {threads.length === 0
              ? gmailConnected
                ? 'Click "Sync Now" to import recent emails.'
                : 'Connect Gmail to automatically classify job emails.'
              : 'No threads in this category.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map(thread => (
            <div
              key={thread.id}
              className={`px-6 py-4 flex items-start gap-4 hover:bg-accent/30 transition-colors ${!thread.isRead ? 'bg-indigo-600/5' : ''}`}
            >
              <div className="shrink-0 mt-1">
                <div className={`w-2 h-2 rounded-full ${!thread.isRead ? 'bg-indigo-400' : 'bg-transparent'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-foreground text-sm font-medium">{thread.subject}</p>
                  {thread.classification && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CLASS_COLORS[thread.classification] ?? 'text-muted-foreground bg-muted'}`}>
                      {thread.classification.replace(/_/g, ' ')}
                    </span>
                  )}
                  {thread.urgency === 'high' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-yellow-400 bg-yellow-400/10">
                      URGENT
                    </span>
                  )}
                  {!thread.applicationId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-muted-foreground bg-muted border border-border">
                      UNMATCHED
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">{thread.fromEmail}</p>
                {thread.summary && (
                  <p className="text-muted-foreground text-xs mt-1.5 line-clamp-2">{thread.summary}</p>
                )}
                {thread.draftReply && (
                  <div className="mt-2 p-2.5 bg-indigo-600/5 border border-indigo-600/20 rounded text-xs text-foreground">
                    <p className="text-[10px] text-indigo-400 font-medium mb-1">Draft Follow-up</p>
                    <p className="line-clamp-3 whitespace-pre-wrap">{thread.draftReply}</p>
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right flex flex-col items-end gap-2">
                <p className="text-muted-foreground text-[10px]">
                  {formatDistanceToNow(new Date(thread.lastEmailAt), { addSuffix: true })}
                </p>

                {/* REQ-018: Mark as Read button */}
                {!thread.isRead && (
                  <button
                    onClick={() => handleMarkRead(thread)}
                    disabled={markingRead === thread.id}
                    className="flex items-center gap-1 text-[10px] border border-border text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="w-2.5 h-2.5" />
                    {markingRead === thread.id ? 'Marking...' : 'Mark as Read'}
                  </button>
                )}

                {/* Follow-up button */}
                {thread.applicationId &&
                  ['FOLLOW_UP_NEEDED', 'GHOSTED'].includes(thread.classification ?? '') &&
                  !thread.followUpSentAt && (
                    <button
                      onClick={() => handleFollowUp(thread)}
                      disabled={sendingFollowUp === thread.id}
                      className="flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                    >
                      <Send className="w-2.5 h-2.5" />
                      {sendingFollowUp === thread.id ? 'Drafting...' : 'Draft Follow-up'}
                    </button>
                  )}

                {/* REQ-019: Link to Application dropdown (Unmatched tab) */}
                {!thread.applicationId && (
                  <div className="relative" ref={linkingThreadId === thread.id ? linkDropdownRef : undefined}>
                    <button
                      onClick={() => openLinkDropdown(thread.id)}
                      className="flex items-center gap-1 text-[10px] border border-border text-muted-foreground hover:text-indigo-400 hover:border-indigo-600/30 px-2 py-1 rounded transition-colors"
                    >
                      <Link2 className="w-2.5 h-2.5" />
                      Link to Application
                    </button>
                    {linkingThreadId === thread.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            placeholder="Search company or role..."
                            value={appSearch}
                            onChange={e => setAppSearch(e.target.value)}
                            className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-600/50"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredApps.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No applications found</p>
                          ) : (
                            filteredApps.map(app => (
                              <button
                                key={app.id}
                                onClick={() => handleLinkApplication(thread.id, app.id)}
                                disabled={linking}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors disabled:opacity-50"
                              >
                                <p className="text-foreground font-medium">{app.job.company}</p>
                                <p className="text-muted-foreground text-[10px]">{app.job.title}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
