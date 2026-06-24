'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [magicSent, setMagicSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      setMagicSent(true)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setMagicSent(true)
    setLoading(false)
  }

  if (magicSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-chivo font-bold text-foreground">Check your email</h2>
          <p className="text-muted-foreground text-sm">We sent a link to <strong>{email}</strong></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-chivo font-bold text-foreground">CareerPilot</h1>
            <p className="text-muted-foreground text-sm mt-1">Your AI Career Operating System</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full border border-border hover:border-indigo-600/50 text-foreground font-medium py-2 px-4 rounded-md text-sm transition-colors"
        >
          Continue with magic link
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-indigo-400 hover:text-indigo-300 underline">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
