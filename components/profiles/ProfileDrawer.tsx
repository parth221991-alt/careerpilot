'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

const ALL_SOURCES = [
  'REMOTEOK', 'REMOTIVE', 'ARBEITNOW', 'WEWORKREMOTELY',
  'ADZUNA', 'JSEARCH', 'NAUKRI',
]

type Profile = {
  id: string
  name: string
  description: string | null
  targetRoles: string[]
  targetLocations: string[]
  salaryMin?: number | null
  salaryMax?: number | null
  currency: string
  remotePreference: string
  preferredSources: string[]
  minMatchScore: number
  autoApplyEnabled: boolean
  autoApplyPlatforms: string[]
  dailyApplyLimit: number
}

type Props = {
  open: boolean
  onClose: () => void
  profile: Profile | null
  onSaved: () => void
}

export function ProfileDrawer({ open, onClose, profile, onSaved }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rolesInput, setRolesInput] = useState('')
  const [locationsInput, setLocationsInput] = useState('')
  const [remotePreference, setRemotePreference] = useState('REMOTE_ONLY')
  const [minMatchScore, setMinMatchScore] = useState(70)
  const [preferredSources, setPreferredSources] = useState<string[]>(['REMOTEOK', 'REMOTIVE', 'ARBEITNOW', 'NAUKRI'])
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false)
  const [dailyApplyLimit, setDailyApplyLimit] = useState(10)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setDescription(profile.description ?? '')
      setRolesInput(profile.targetRoles.join(', '))
      setLocationsInput(profile.targetLocations.join(', '))
      setRemotePreference(profile.remotePreference)
      setMinMatchScore(profile.minMatchScore)
      setPreferredSources(profile.preferredSources)
      setAutoApplyEnabled(profile.autoApplyEnabled)
      setDailyApplyLimit(profile.dailyApplyLimit)
    } else {
      setName(''); setDescription(''); setRolesInput(''); setLocationsInput('')
      setRemotePreference('REMOTE_ONLY'); setMinMatchScore(70)
      setPreferredSources(['REMOTEOK', 'REMOTIVE', 'ARBEITNOW', 'NAUKRI'])
      setAutoApplyEnabled(false); setDailyApplyLimit(10)
    }
    setError('')
  }, [profile, open])

  function toggleSource(src: string) {
    setPreferredSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    )
  }

  async function handleSave() {
    setError('')
    const targetRoles = rolesInput.split(',').map(r => r.trim()).filter(Boolean)
    const targetLocations = locationsInput.split(',').map(l => l.trim()).filter(Boolean)

    if (!name.trim()) { setError('Name is required'); return }
    if (targetRoles.length === 0) { setError('At least one target role is required'); return }

    setSaving(true)
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      targetRoles,
      targetLocations,
      remotePreference,
      preferredSources,
      minMatchScore,
      autoApplyEnabled,
      dailyApplyLimit,
    }

    const url = profile ? `/api/profiles/${profile.id}` : '/api/profiles'
    const method = profile ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <Dialog.Title className="font-chivo font-bold text-foreground text-base">
              {profile ? 'Edit Profile' : 'New Job Profile'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 p-6 space-y-5">
            {error && (
              <div className="p-3 bg-loss/10 border border-loss/30 rounded text-loss text-xs">{error}</div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Profile Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Senior Data Analyst — Remote"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Target Roles * (comma-separated)</label>
              <input
                value={rolesInput}
                onChange={e => setRolesInput(e.target.value)}
                placeholder="Data Analyst, BI Analyst, Analytics Engineer"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Target Locations (comma-separated, optional)</label>
              <input
                value={locationsInput}
                onChange={e => setLocationsInput(e.target.value)}
                placeholder="India, Remote"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Remote Preference</label>
              <select
                value={remotePreference}
                onChange={e => setRemotePreference(e.target.value)}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
              >
                <option value="REMOTE_ONLY">Remote Only</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">On-site</option>
                <option value="ANY">Any</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Minimum Match Score: {minMatchScore}%
              </label>
              <input
                type="range" min={50} max={95} step={5}
                value={minMatchScore}
                onChange={e => setMinMatchScore(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>50% (broad)</span><span>95% (strict)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Job Sources</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SOURCES.map(src => (
                  <label key={src} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferredSources.includes(src)}
                      onChange={() => toggleSource(src)}
                      className="accent-indigo-500"
                    />
                    <span className="text-xs text-foreground">{src}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-border">
              <div>
                <p className="text-xs font-medium text-foreground">Naukri Auto-Apply</p>
                <p className="text-[11px] text-muted-foreground">Automatically apply on Naukri within daily limit</p>
              </div>
              <button
                onClick={() => setAutoApplyEnabled(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${autoApplyEnabled ? 'bg-profit' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoApplyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {autoApplyEnabled && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Daily Apply Limit: {dailyApplyLimit}
                </label>
                <input
                  type="range" min={1} max={25} step={1}
                  value={dailyApplyLimit}
                  onChange={e => setDailyApplyLimit(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>1/day</span><span>25/day</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-md font-medium transition-colors"
            >
              {saving ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
