-- CrowdCity Database Schema Setup
-- Run this in the Supabase SQL Editor

-- 1. Create Profiles Table (Linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  role text default 'citizen' check (role in ('citizen', 'authority', 'admin')),
  welcome_email_sent boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Authenticated user may update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Authenticated user may insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Trigger to automatically create a profile after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Citizen'),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'citizen'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Create Issues Table
create table public.issues (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  category text not null check (category in ('roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other')),
  status text default 'pending' check (status in ('pending', 'assigned', 'in_progress', 'resolved', 'rejected')),
  latitude double precision not null,
  longitude double precision not null,
  address text,
  image_url text,
  upvotes_count integer default 0,
  assigned_to uuid references public.profiles(id) on delete set null,
  completion_proof_url text,
  completion_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Issues
alter table public.issues enable row level security;

-- Issues Policies
create policy "Issues are viewable by everyone" on public.issues
  for select using (true);

create policy "Authenticated users can report issues" on public.issues
  for insert with check (auth.role() = 'authenticated');

create policy "Reporter, Authority, or Admins can update their issues" on public.issues
  for update using (
    auth.uid() = reporter_id or 
    auth.uid() = assigned_to or
    (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() 
          and profiles.role = 'authority' 
          and profiles.is_verified_authority = true
      )
      and (
        assigned_to is null or
        assigned_to = auth.uid()
      )
    ) or
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    auth.uid() = reporter_id or 
    auth.uid() = assigned_to or
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );


-- 3. Create Votes Table (To track upvotes and prevent double voting)
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  issue_id uuid references public.issues(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, issue_id)
);

-- Enable RLS on Votes
alter table public.votes enable row level security;

-- Votes Policies
create policy "Votes are viewable by everyone" on public.votes
  for select using (true);

create policy "Authenticated users can vote" on public.votes
  for insert with check (auth.uid() = user_id);

create policy "Users can retract their vote" on public.votes
  for delete using (auth.uid() = user_id);

-- Functions to increment/decrement upvotes_count on Issues automatically
create or replace function public.handle_vote_insert()
returns trigger as $$
begin
  update public.issues
  set upvotes_count = upvotes_count + 1
  where id = new.issue_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_vote_inserted
  after insert on public.votes
  for each row execute procedure public.handle_vote_insert();

create or replace function public.handle_vote_delete()
returns trigger as $$
begin
  update public.issues
  set upvotes_count = greatest(0, upvotes_count - 1)
  where id = old.issue_id;
  return old;
end;
$$ language plpgsql security definer;

create or replace trigger on_vote_deleted
  after delete on public.votes
  for each row execute procedure public.handle_vote_delete();


-- 4. Create Comments Table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references public.issues(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Comments
alter table public.comments enable row level security;

-- Comments Policies
create policy "Comments are viewable by everyone" on public.comments
  for select using (true);

create policy "Authenticated users can add comments" on public.comments
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments" on public.comments
  for delete using (auth.uid() = user_id);

create policy "Users can update their own comments" on public.comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 5. Storage Bucket for Issue Images
-- Note: Storage buckets are configured inside Supabase Storage, but we can document the policies here.
-- To create the bucket 'issue-images' and enable public access:
-- insert into storage.buckets (id, name, public) values ('issue-images', 'issue-images', true);
--
-- Policy for upload:
-- create policy "Allow authenticated uploads to issue-images"
--   on storage.objects for insert with check (
--     bucket_id = 'issue-images' and auth.role() = 'authenticated'
--   );
--
-- Policy for view:
-- create policy "Allow public access to issue-images"
--   on storage.objects for select using (bucket_id = 'issue-images');


-- 6. Create Status History Table (Complaint Tracking)
create table public.status_history (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references public.issues(id) on delete cascade not null,
  status text not null check (status in ('pending', 'assigned', 'in_progress', 'resolved', 'rejected')),
  updated_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Status History
alter table public.status_history enable row level security;

-- Policies for Status History
create policy "Status history logs are viewable by everyone" on public.status_history
  for select using (true);

create policy "Only Authority or Admin can insert status logs" on public.status_history
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('authority', 'admin')
    )
  );

-- 7. Add AI Analysis columns to Issues Table
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS ai_category text,
ADD COLUMN IF NOT EXISTS ai_department text,
ADD COLUMN IF NOT EXISTS ai_priority text CHECK (ai_priority IN ('low', 'medium', 'high', 'critical'));

-- 8. Create Notifications Table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text check (type in ('status_change', 'assignment', 'other')),
  issue_id uuid references public.issues(id) on delete cascade,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Notifications
alter table public.notifications enable row level security;

-- Policies for Notifications
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);


-- ==========================================
-- 9. Gamification System
-- ==========================================

-- Add points to profiles
alter table public.profiles add column if not exists points integer default 0;

-- Create User Badges Table
create table public.user_badges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_type text not null,
  badge_name text not null,
  badge_description text not null,
  badge_icon text not null,
  awarded_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, badge_type)
);

-- Enable RLS on User Badges
alter table public.user_badges enable row level security;

-- User Badges Policies
create policy "User badges are viewable by everyone" on public.user_badges
  for select using (true);

create policy "Authenticated users can earn badges" on public.user_badges
  for insert with check (auth.uid() = user_id);

-- Points increment stored procedure (helps increment points server-side safely)
create or replace function public.increment_profile_points(user_id uuid, amount integer)
returns void as $$
begin
  update public.profiles
  set points = coalesce(points, 0) + amount
  where id = user_id;
end;
$$ language plpgsql security definer;

