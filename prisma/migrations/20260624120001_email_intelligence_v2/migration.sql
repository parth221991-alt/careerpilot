-- Migration: email_intelligence_v2
-- Extends EmailClassType enum, adds ghosted_at to applications, follow_up_sent_at to email_threads.

-- Step 1: Extend EmailClassType enum with ghosted/follow-up-needed detection labels
ALTER TYPE "EmailClassType" ADD VALUE IF NOT EXISTS 'GHOSTED';
ALTER TYPE "EmailClassType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_NEEDED';

-- Step 2: Add ghosted_at to applications (set when no reply detected after 14 days)
ALTER TABLE "applications"
    ADD COLUMN IF NOT EXISTS "ghosted_at" TIMESTAMPTZ(6);

-- Step 3: Add follow_up_sent_at to email_threads (tracks when a follow-up was drafted/sent)
ALTER TABLE "email_threads"
    ADD COLUMN IF NOT EXISTS "follow_up_sent_at" TIMESTAMPTZ(6);
