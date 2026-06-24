'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Briefcase, Zap, Globe } from 'lucide-react'
import { ProfileDrawer } from '@/components/profiles/ProfileDrawer'

type JobProfile = {
  id: string
  name: string
  description: string | null
  targetRoles: string[]
  targetLocations: string[]
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  remotePreference: string
  minMatchScore: number
  autoApplyEnabled: boolean
  autoApplyPlatforms: string[]
  preferredSources: string[]
  dailyApplyLimit: number
  isActive: boolean
  _count: { jobs: number; baseResumes: number }
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<JobProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<JobProfile | null>(null)

  async function loadProfiles() {
    setLoading(true)
    const res = await fetch('/api/profiles')
    if (res.ok) {
      const data = await res.json()
      setProfiles(data.profiles)
    }
    setLoading(false)
  }

  useEffect(() => { void loadProfiles() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this profile? Your jobs and applications will be preserved.')) return
    await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
    void loadProfiles()
  }

  async function handleDiscover(profileId: string) {
    const res = await fetch('/api/jobs/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    })
    if (res.ok) {
      alert('Discovery run queued! Jobs will appear in the Jobs page within a few minutes.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Job Profiles"
        subtitle={`${profiles.length} active profile${profiles.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => { setEditingProfile(null); setDrawerOpen(true) }}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Loading profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-chivo font-bold text-foreground text-base">No profiles yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Create a profile for each role you&apos;re targeting (e.g., &quot;Data Analyst — Remote&quot;, &quot;ML Engineer — Startup&quot;).
            Each profile gets its own curated job feed.
          </p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="mt-4 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md"
          >
            Create First Profile
          </button>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map(profile => (
            <div key={profile.id} className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-chivo font-bold text-foreground text-sm truncate">{profile.name}</h3>
                  {profile.description && (
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{profile.description}</p>
                  )}
                </div>
                {profile.autoApplyEnabled && (
                  <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium bg-profit/10 text-profit">
                    AUTO
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {profile.targetRoles.slice(0, 3).map(role => (
                  <span key={role} className="text-[10px] px-2 py-0.5 rounded bg-indigo-600/10 text-indigo-400 font-medium">
                    {role}
                  </span>
                ))}
                {profile.targetRoles.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    +{profile.targetRoles.length - 3}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {profile._count.jobs} jobs
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {profile.remotePreference.replace('_', ' ')}
                </span>
                <span>Min {profile.minMatchScore}% match</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {profile.preferredSources.slice(0, 4).map(src => (
                  <span key={src} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                    {src}
                  </span>
                ))}
              </div>

              <div className="flex gap-2 pt-1 border-t border-border">
                <button
                  onClick={() => handleDiscover(profile.id)}
                  className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Discover
                </button>
                <button
                  onClick={() => { setEditingProfile(profile); setDrawerOpen(true) }}
                  className="text-xs border border-border text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="text-xs text-loss/70 hover:text-loss px-2.5 py-1.5 rounded transition-colors ml-auto"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={editingProfile}
        onSaved={() => { setDrawerOpen(false); void loadProfiles() }}
      />
    </div>
  )
}
