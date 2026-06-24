-- CareerPilot Row-Level Security policies
-- Apply after running: npx prisma migrate dev
-- Run this in the Supabase SQL editor or via psql

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ── users ─────────────────────────────────────────────────────────────────────

CREATE POLICY "users: own row only"
  ON users FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── career_profiles ───────────────────────────────────────────────────────────

CREATE POLICY "career_profiles: own"
  ON career_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── experiences (via career_profile) ─────────────────────────────────────────

CREATE POLICY "experiences: own"
  ON experiences FOR ALL
  USING (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  );

-- ── projects ──────────────────────────────────────────────────────────────────

CREATE POLICY "projects: own"
  ON projects FOR ALL
  USING (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  );

-- ── skills ────────────────────────────────────────────────────────────────────

CREATE POLICY "skills: own"
  ON skills FOR ALL
  USING (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  );

-- ── certifications ────────────────────────────────────────────────────────────

CREATE POLICY "certifications: own"
  ON certifications FOR ALL
  USING (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  );

-- ── achievements ──────────────────────────────────────────────────────────────

CREATE POLICY "achievements: own"
  ON achievements FOR ALL
  USING (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    career_profile_id IN (
      SELECT id FROM career_profiles WHERE user_id = auth.uid()
    )
  );

-- ── career_goals ──────────────────────────────────────────────────────────────

CREATE POLICY "career_goals: own"
  ON career_goals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── base_resumes ──────────────────────────────────────────────────────────────

CREATE POLICY "base_resumes: own"
  ON base_resumes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── resume_variants ───────────────────────────────────────────────────────────

CREATE POLICY "resume_variants: own"
  ON resume_variants FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── jobs ──────────────────────────────────────────────────────────────────────

CREATE POLICY "jobs: own"
  ON jobs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── applications ──────────────────────────────────────────────────────────────

CREATE POLICY "applications: own"
  ON applications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── status_history ────────────────────────────────────────────────────────────

CREATE POLICY "status_history: own"
  ON status_history FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── approval_gates ────────────────────────────────────────────────────────────

CREATE POLICY "approval_gates: own"
  ON approval_gates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── email_threads ─────────────────────────────────────────────────────────────

CREATE POLICY "email_threads: own"
  ON email_threads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── recruiters ────────────────────────────────────────────────────────────────

CREATE POLICY "recruiters: own"
  ON recruiters FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── recruiter_interactions (via recruiter) ────────────────────────────────────

CREATE POLICY "recruiter_interactions: own"
  ON recruiter_interactions FOR ALL
  USING (
    recruiter_id IN (
      SELECT id FROM recruiters WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recruiter_id IN (
      SELECT id FROM recruiters WHERE user_id = auth.uid()
    )
  );

-- ── interview_preps ───────────────────────────────────────────────────────────

CREATE POLICY "interview_preps: own"
  ON interview_preps FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── offers (via application) ──────────────────────────────────────────────────

CREATE POLICY "offers: own"
  ON offers FOR ALL
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE POLICY "notifications: own"
  ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Service role bypass ───────────────────────────────────────────────────────
-- The service_role key used by Prisma (server-side) bypasses RLS automatically.
-- No need to create bypass policies — Supabase handles this.
