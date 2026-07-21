-- ====================================================================
-- CrowdCity AI v2.0 - Step 13: User Document Wallet Database Schema
-- Run in Supabase SQL Editor ("Run without RLS")
-- ====================================================================

-- 1. Create user_document_wallet Table
CREATE TABLE IF NOT EXISTS public.user_document_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type VARCHAR(100) NOT NULL,
  doc_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_size INT DEFAULT 0,
  file_format VARCHAR(50) DEFAULT 'pdf',
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_doc_type UNIQUE (user_id, doc_type)
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_doc_wallet_user_id ON public.user_document_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_user_doc_wallet_type ON public.user_document_wallet(doc_type);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_document_wallet ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view own documents" ON public.user_document_wallet;
CREATE POLICY "Users can view own documents"
  ON public.user_document_wallet
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_document_wallet;
CREATE POLICY "Users can insert own documents"
  ON public.user_document_wallet
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON public.user_document_wallet;
CREATE POLICY "Users can update own documents"
  ON public.user_document_wallet
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_document_wallet;
CREATE POLICY "Users can delete own documents"
  ON public.user_document_wallet
  FOR DELETE
  USING (auth.uid() = user_id);
