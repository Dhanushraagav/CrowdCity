-- CrowdCity Database Indexes
-- Copy and run this script in your Supabase SQL Editor to optimize query performance in production.

-- 1. Profiles Indexing
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Issues Table Indexing
-- Optimizes filtering by reporter, inspector assignments, status categories, and sorting by created date
CREATE INDEX IF NOT EXISTS idx_issues_reporter_id ON public.issues(reporter_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_upvotes ON public.issues(upvotes_count DESC);

-- 3. Comments Table Indexing
-- Optimizes comment listings on specific issues
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON public.comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at ASC);

-- 4. Votes Table Indexing
-- Optimizes upvote existence checks and aggregation
CREATE INDEX IF NOT EXISTS idx_votes_issue_id ON public.votes(issue_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);

-- 5. Status History Indexing
-- Optimizes issue lifecycle audit trails
CREATE INDEX IF NOT EXISTS idx_status_history_issue_id ON public.status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.status_history(created_at DESC);

-- 6. Notifications Table Indexing
-- Optimizes unread notification counts and historical notifications listings per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 7. User Badges Indexing
-- Optimizes leaderboard loading and badge showcase listings
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_type ON public.user_badges(badge_type);
