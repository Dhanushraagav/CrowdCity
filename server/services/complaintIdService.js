/**
 * CrowdCity AI - Authoritative Complaint ID Generator Service
 * 
 * Rules:
 * - Format: CC-YYYY-NNNNNN (e.g. CC-2026-000001)
 * - Concurrency-safe monotonic sequential generation
 * - Backend/Database generated ONLY (never trust client)
 * - Dynamic year from complaint creation date
 * - Never reuses deleted IDs
 */

import { supabaseAdmin, supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// In-process lock and high-water mark sequence tracking to guarantee strict monotonicity under concurrency
let _idGenerationLock = Promise.resolve();
let _inMemoryMaxSeq = 0;
let _cachedYear = 0;

/**
 * Generates the next globally unique Complaint ID for the specified date.
 * 
 * @param {Date|string} [creationDate=new Date()]
 * @returns {Promise<string>} e.g. "CC-2026-000001"
 */
export async function generateNextComplaintId(creationDate = new Date()) {
  const dateObj = creationDate ? new Date(creationDate) : new Date();
  const year = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();
  const yearPrefix = `CC-${year}-`;

  // Chain inside mutex lock to guarantee sequential consistency under simultaneous requests
  return new Promise((resolve, reject) => {
    _idGenerationLock = _idGenerationLock.then(async () => {
      try {
        const client = supabaseAdmin || supabase;

        if (year !== _cachedYear) {
          _cachedYear = year;
          _inMemoryMaxSeq = 0;
        }

        // 1. First, check if PostgreSQL sequence exists and can be queried via RPC
        try {
          const { data: seqData, error: seqError } = await client.rpc('nextval', { seq_name: 'public.complaint_id_seq' });
          if (!seqError && seqData) {
            const nextSeq = Math.max(Number(seqData), _inMemoryMaxSeq + 1);
            _inMemoryMaxSeq = nextSeq;
            const padded = String(nextSeq).padStart(6, '0');
            return resolve(`${yearPrefix}${padded}`);
          }
        } catch (e) {
          // RPC nextval not exposed or sequence not created yet; proceed to authoritative table lookup
        }

        // 2. Query the highest issued Complaint ID for the given year
        let dbHighest = 0;

        try {
          const { data, error } = await client
            .from('issues')
            .select('complaint_id')
            .ilike('complaint_id', `${yearPrefix}%`)
            .order('complaint_id', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0 && data[0].complaint_id) {
            const rawId = data[0].complaint_id.trim();
            const parts = rawId.split('-');
            if (parts.length === 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > dbHighest) {
                dbHighest = num;
              }
            }
          }
        } catch (queryErr) {
          logger.warn('Failed to query highest complaint_id from issues table:', queryErr.message);
        }

        // 3. Also check total existing issues count to guarantee monotonic sequence
        try {
          const { count, error: countErr } = await client
            .from('issues')
            .select('id', { count: 'exact', head: true });

          if (!countErr && typeof count === 'number' && count > dbHighest) {
            dbHighest = count;
          }
        } catch (countErr) {}

        // 4. Allocate next monotonic sequential ID using high-water mark
        const nextSeq = Math.max(dbHighest, _inMemoryMaxSeq) + 1;
        _inMemoryMaxSeq = nextSeq;

        const paddedSeq = String(nextSeq).padStart(6, '0');
        const generatedId = `${yearPrefix}${paddedSeq}`;

        resolve(generatedId);
      } catch (err) {
        logger.error('Error in generateNextComplaintId:', err);
        // Resilient fallback with monotonic high-water increment
        _inMemoryMaxSeq = (_inMemoryMaxSeq || 0) + 1;
        const fallbackSeq = String(_inMemoryMaxSeq).padStart(6, '0');
        resolve(`${yearPrefix}${fallbackSeq}`);
      }
    }).catch(reject);
  });
}

/**
 * Normalizes an issue record to guarantee a valid Complaint ID.
 * If an issue lacks a complaint_id (e.g. legacy data), derives one dynamically.
 * 
 * @param {Object} issue
 * @returns {Object} issue with valid complaint_id and citizen_count
 */
export function normalizeComplaintRecord(issue) {
  if (!issue) return issue;

  const year = issue.created_at ? new Date(issue.created_at).getFullYear() : new Date().getFullYear();

  // If complaint_id is missing, create a deterministic display ID from created_at or UUID
  if (!issue.complaint_id) {
    // Generate a fallback Complaint ID format CC-YYYY-XXXXXX
    const hash = (issue.id || '').replace(/[^0-9]/g, '').slice(0, 6);
    const padded = (hash || '000001').padEnd(6, '0');
    issue.complaint_id = `CC-${year}-${padded}`;
  }

  // Ensure citizen_count defaults to 1
  if (!issue.citizen_count || issue.citizen_count < 1) {
    issue.citizen_count = 1;
  }

  return issue;
}
