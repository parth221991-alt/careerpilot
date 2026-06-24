import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  // Ensure user record exists in our DB (created on first login via webhook or here)
  let dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name ?? user.email!.split('@')[0],
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      },
    })
  }

  return dbUser
}

export async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
