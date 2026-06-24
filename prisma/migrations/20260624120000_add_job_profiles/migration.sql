-- Migration: add_job_profiles
-- Adds JobProfile model, extends Platform enum, wires jobProfileId FK to BaseResume and Job.

-- Step 1: Extend Platform enum with new job board values
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'REMOTIVE';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'WEWORKREMOTELY';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'HIMALAYAS';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'ARBEITNOW';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'JSEARCH';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'ADZUNA';

-- Step 2: Create job_profiles table
CREATE TABLE "job_profiles" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"             UUID         NOT NULL,
    "name"                TEXT         NOT NULL,
    "description"         TEXT,
    "target_roles"        TEXT[]       NOT NULL DEFAULT '{}',
    "target_locations"    TEXT[]       NOT NULL DEFAULT '{}',
    "salary_min"          INTEGER,
    "salary_max"          INTEGER,
    "currency"            TEXT         NOT NULL DEFAULT 'INR',
    "remote_preference"   "RemotePref" NOT NULL DEFAULT 'REMOTE_ONLY',
    "preferred_sources"   "Platform"[] NOT NULL DEFAULT '{}',
    "min_match_score"     INTEGER      NOT NULL DEFAULT 70,
    "auto_apply_enabled"  BOOLEAN      NOT NULL DEFAULT false,
    "auto_apply_platforms" "Platform"[] NOT NULL DEFAULT '{}',
    "daily_apply_limit"   INTEGER      NOT NULL DEFAULT 10,
    "is_active"           BOOLEAN      NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "job_profiles_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add foreign key from job_profiles to users
ALTER TABLE "job_profiles"
    ADD CONSTRAINT "job_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Index on (user_id, is_active) for efficient profile lookups
CREATE INDEX "job_profiles_user_id_is_active_idx" ON "job_profiles"("user_id", "is_active");

-- Step 5: Add job_profile_id FK to base_resumes (optional — null = general resume)
ALTER TABLE "base_resumes" ADD COLUMN IF NOT EXISTS "job_profile_id" UUID;

ALTER TABLE "base_resumes"
    ADD CONSTRAINT "base_resumes_job_profile_id_fkey"
    FOREIGN KEY ("job_profile_id") REFERENCES "job_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Add job_profile_id FK to jobs (optional — null = ungrouped)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "job_profile_id" UUID;

ALTER TABLE "jobs"
    ADD CONSTRAINT "jobs_job_profile_id_fkey"
    FOREIGN KEY ("job_profile_id") REFERENCES "job_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Composite index for per-profile job feed sorted by match score (REQ-003)
CREATE INDEX "jobs_job_profile_id_match_score_idx" ON "jobs"("job_profile_id", "match_score" DESC NULLS LAST);
