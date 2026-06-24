'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Linkedin, X, Copy, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import type { ApplyAnswers } from '@/types/agents'

type Props = {
  jobId: string
  applicationId: string
  profileId?: string
  platform: string
}

export function LinkedInApplyPanel({ jobId, applicationId, profileId, platform }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<ApplyAnswers | null>(null)
  const [atsScore, setAtsScore] = useState<number | null>(null)
  const [atsWarning, setAtsWarning] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  // REQ-006: submission confirmation state
  const [submitted, setSubmitted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmDone, setConfirmDone] = useState(false)

  const isLinkedIn = platform === 'LINKEDIN'

  async function handleOpen() {
    setOpen(true)
    if (answers) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apply/linkedin/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, profileId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to generate answers'); return }
      setAnswers(data.answers)
      setAtsScore(data.atsScore)
      setAtsWarning(data.atsWarning)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyField(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // REQ-006: User confirmed they submitted on LinkedIn — update application status to APPLIED
  async function handleConfirmSubmit() {
    if (!submitted) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPLIED', isAutoApplied: false }),
      })
      if (res.ok) {
        setConfirmDone(true)
        setTimeout(() => setOpen(false), 1500)
      }
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs bg-[#0077b5] hover:bg-[#006097] text-white px-3 py-1.5 rounded-md transition-colors"
      >
        <Linkedin className="w-3.5 h-3.5" />
        {isLinkedIn ? 'Prepare Apply' : 'Generate Answers'}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Dialog.Content className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <Dialog.Title className="font-chivo font-bold text-foreground text-base">
                  LinkedIn Apply Assistant
                </Dialog.Title>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Copy each field and paste into LinkedIn. CareerPilot never submits for you on LinkedIn.
                </p>
              </div>
              <Dialog.Close asChild>
                <button className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <p className="text-muted-foreground text-sm">Generating tailored answers...</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-loss/10 border border-loss/30 rounded text-loss text-xs">{error}</div>
              )}

              {atsWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-400 text-xs">{atsWarning}</p>
                </div>
              )}

              {atsScore !== null && !atsWarning && (
                <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/30 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-profit shrink-0" />
                  <p className="text-profit text-xs">ATS match score: {Math.round(atsScore)}%</p>
                </div>
              )}

              {answers && (
                <div className="space-y-4">
                  <AnswerField
                    label="Cover Letter"
                    value={answers.coverLetter}
                    fieldKey="coverLetter"
                    copied={copied}
                    onCopy={copyField}
                    multiline
                  />
                  <AnswerField
                    label="Why Interested"
                    value={answers.whyInterested}
                    fieldKey="whyInterested"
                    copied={copied}
                    onCopy={copyField}
                    multiline
                  />
                  <AnswerField
                    label="Expected Salary"
                    value={String(answers.expectedSalary ?? '')}
                    fieldKey="expectedSalary"
                    copied={copied}
                    onCopy={copyField}
                  />
                  <AnswerField
                    label="Notice Period"
                    value={String(answers.noticePeriod ?? '')}
                    fieldKey="noticePeriod"
                    copied={copied}
                    onCopy={copyField}
                  />
                  <AnswerField
                    label="Years of Experience"
                    value={String(answers.yearsExperience ?? '')}
                    fieldKey="yearsExperience"
                    copied={copied}
                    onCopy={copyField}
                  />
                  <AnswerField
                    label="Work Authorization"
                    value={String(answers.workAuthorization ?? '')}
                    fieldKey="workAuthorization"
                    copied={copied}
                    onCopy={copyField}
                  />
                  {answers.screeningAnswers && Object.keys(answers.screeningAnswers).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Screening Questions</p>
                      {Object.entries(answers.screeningAnswers as Record<string, string>).map(([q, a]) => (
                        <AnswerField
                          key={q}
                          label={q}
                          value={a}
                          fieldKey={`screening-${q}`}
                          copied={copied}
                          onCopy={copyField}
                          multiline
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* REQ-006: Submission confirmation section */}
            <div className="px-6 py-4 border-t border-border space-y-3">
              {confirmDone ? (
                <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/30 rounded">
                  <CheckCircle className="w-4 h-4 text-profit" />
                  <p className="text-profit text-sm font-medium">Application marked as APPLIED!</p>
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={submitted}
                      onChange={e => setSubmitted(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border text-indigo-600 bg-muted focus:ring-indigo-600"
                    />
                    <span className="text-xs text-foreground group-hover:text-indigo-400 transition-colors">
                      I submitted the application on LinkedIn
                    </span>
                  </label>
                  {submitted && (
                    <button
                      onClick={handleConfirmSubmit}
                      disabled={confirming}
                      className="w-full flex items-center justify-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-md transition-colors disabled:opacity-60"
                    >
                      {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Confirm Submission
                    </button>
                  )}
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

type AnswerFieldProps = {
  label: string
  value: string
  fieldKey: string
  copied: string | null
  onCopy: (text: string, key: string) => Promise<void>
  multiline?: boolean
}

function AnswerField({ label, value, fieldKey, copied, onCopy, multiline }: AnswerFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <button
          onClick={() => onCopy(value, fieldKey)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied === fieldKey ? (
            <><CheckCircle className="w-3 h-3 text-profit" /> Copied!</>
          ) : (
            <><Copy className="w-3 h-3" /> Copy</>
          )}
        </button>
      </div>
      {multiline ? (
        <div className="bg-muted border border-border rounded-md p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
          {value}
        </div>
      ) : (
        <div className="bg-muted border border-border rounded-md px-3 py-2 text-xs text-foreground font-mono">
          {value}
        </div>
      )}
    </div>
  )
}
