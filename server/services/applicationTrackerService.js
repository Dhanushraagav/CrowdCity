import { supabaseAdmin, supabase } from '../config/supabase.js';

// Valid application statuses supported by CrowdCity App Tracker
export const VALID_APPLICATION_STATUSES = [
  'Submitted',
  'Under Verification',
  'Additional Documents Requested',
  'Approved',
  'Rejected',
  'Completed',
  'Draft'
];

// Curated official government portal mappings for popular welfare schemes
const KNOWN_SCHEME_PORTALS = {
  'kalaignar magalir urimai': 'https://kmut.tn.gov.in/',
  'kmut': 'https://kmut.tn.gov.in/',
  'pudhumai penn': 'https://penkalvi.tn.gov.in/',
  'pen kalvi': 'https://penkalvi.tn.gov.in/',
  'naan mudhalvan': 'https://www.naanmudhalvan.tn.gov.in/',
  'cmchis': 'https://cmchistn.com/',
  'chief minister comprehensive health insurance': 'https://cmchistn.com/',
  'pm kisan': 'https://pmkisan.gov.in/',
  'pm-kisan': 'https://pmkisan.gov.in/',
  'ayushman bharat': 'https://pmjay.gov.in/',
  'pm-jay': 'https://pmjay.gov.in/',
  'pmjay': 'https://pmjay.gov.in/',
  'mudra': 'https://www.mudra.org.in/',
  'pmmy': 'https://www.mudra.org.in/',
  'sukanya samriddhi': 'https://www.indiapost.gov.in/',
  'pmay': 'https://pmaymis.gov.in/',
  'pradhan mantri awas': 'https://pmaymis.gov.in/',
  'vidyalakshmi': 'https://www.vidyalakshmi.co.in/',
  'kalaignar kanavu illam': 'https://tnrd.tn.gov.in/',
  'uzhavar pathukappu': 'https://agritech.tnau.ac.in/'
};

/**
 * Resolves an authoritative portal URL given a scheme name or user-entered portal.
 */
export const resolveOfficialPortalUrl = (schemeName, userUrl) => {
  if (userUrl && typeof userUrl === 'string' && userUrl.trim().startsWith('http')) {
    return userUrl.trim();
  }

  if (schemeName && typeof schemeName === 'string') {
    const lower = schemeName.toLowerCase();
    for (const [key, portal] of Object.entries(KNOWN_SCHEME_PORTALS)) {
      if (lower.includes(key)) {
        return portal;
      }
    }
  }

  return 'https://tn.gov.in/';
};

/**
 * Validates user-submitted application payload for addition or update.
 * Prevents whitespace-only entries, verifies statuses, and sanitizes input.
 */
export const validateApplicationInput = (payload, isPartial = false) => {
  if (!payload || typeof payload !== 'object') {
    const err = new Error('Invalid application data payload.');
    err.statusCode = 400;
    throw err;
  }

  const result = {};

  // Scheme Name validation
  if (!isPartial || payload.scheme_name !== undefined) {
    const rawName = String(payload.scheme_name || '').trim();
    if (!rawName) {
      const err = new Error('Scheme Name is required and cannot be empty or whitespace.');
      err.statusCode = 400;
      throw err;
    }
    if (rawName.length > 255) {
      const err = new Error('Scheme Name cannot exceed 255 characters.');
      err.statusCode = 400;
      throw err;
    }
    result.scheme_name = rawName;
  }

  // Application Reference Number validation
  if (!isPartial || payload.application_ref_no !== undefined) {
    const rawRef = String(payload.application_ref_no || '').trim();
    if (!rawRef) {
      const err = new Error('Application Reference Number is required and cannot be empty or whitespace.');
      err.statusCode = 400;
      throw err;
    }
    if (rawRef.length > 100) {
      const err = new Error('Application Reference Number cannot exceed 100 characters.');
      err.statusCode = 400;
      throw err;
    }
    result.application_ref_no = rawRef;
  }

  // Department Name (Optional)
  if (payload.department_name !== undefined) {
    const rawDept = String(payload.department_name || '').trim();
    result.department_name = rawDept.slice(0, 255) || 'Government Department';
  } else if (!isPartial) {
    result.department_name = 'Government Department';
  }

  // Submission Date validation (Optional, defaults to current date)
  if (payload.submission_date !== undefined && payload.submission_date !== null && String(payload.submission_date).trim() !== '') {
    const dateStr = String(payload.submission_date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const err = new Error('Submission date must be in YYYY-MM-DD format.');
      err.statusCode = 400;
      throw err;
    }
    result.submission_date = dateStr;
  } else if (!isPartial) {
    result.submission_date = new Date().toISOString().split('T')[0];
  }

  // Status validation
  if (payload.status !== undefined) {
    const rawStatus = String(payload.status || '').trim();
    if (!VALID_APPLICATION_STATUSES.includes(rawStatus)) {
      const err = new Error(`Invalid status '${rawStatus}'. Allowed statuses: ${VALID_APPLICATION_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    result.status = rawStatus;
  } else if (!isPartial) {
    result.status = 'Submitted';
  }

  // Official Portal URL
  if (payload.official_portal_url !== undefined) {
    result.official_portal_url = resolveOfficialPortalUrl(result.scheme_name || payload.scheme_name, payload.official_portal_url);
  } else if (!isPartial) {
    result.official_portal_url = resolveOfficialPortalUrl(result.scheme_name, null);
  }

  // Notes (Optional)
  if (payload.notes !== undefined) {
    const rawNotes = payload.notes ? String(payload.notes).trim() : '';
    result.notes = rawNotes.slice(0, 2000) || null;
  } else if (!isPartial) {
    result.notes = null;
  }

  return result;
};

/**
 * Lists all application records strictly owned by `userId`.
 * Optionally filters by status and search keyword.
 */
export const listUserApplications = async (userId, { status = 'all', search = '' } = {}) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const client = supabaseAdmin || supabase;
  let query = client
    .from('user_scheme_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status.trim());
  }

  const { data, error } = await query;

  if (error) {
    const err = new Error(`Failed to fetch applications: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }

  let list = data || [];

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(item => 
      (item.scheme_name && item.scheme_name.toLowerCase().includes(q)) ||
      (item.application_ref_no && item.application_ref_no.toLowerCase().includes(q)) ||
      (item.department_name && item.department_name.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  }

  return list;
};

/**
 * Creates a new application record in `public.user_scheme_applications`
 * strictly bound to `userId`.
 */
export const createUserApplication = async (userId, payload) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const validated = validateApplicationInput(payload, false);

  const insertPayload = {
    user_id: userId,
    scheme_name: validated.scheme_name,
    department_name: validated.department_name,
    application_ref_no: validated.application_ref_no,
    submission_date: validated.submission_date,
    status: validated.status,
    official_portal_url: validated.official_portal_url,
    notes: validated.notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const client = supabaseAdmin || supabase;
  const { data, error } = await client
    .from('user_scheme_applications')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    const err = new Error(`Failed to save application: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }

  return data;
};

/**
 * Updates an application record ONLY if it is owned by `userId`.
 * Implements strict IDOR protection.
 */
export const updateUserApplication = async (userId, applicationId, updates) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  if (!applicationId) {
    const err = new Error('Application ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const client = supabaseAdmin || supabase;

  // 1. Verify existence and ownership strictly
  const { data: existing, error: fetchError } = await client
    .from('user_scheme_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    const err = new Error(`Database error: ${fetchError.message}`);
    err.statusCode = 500;
    throw err;
  }
  if (!existing) {
    const err = new Error('Application record not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Validate partial updates
  const validated = validateApplicationInput(updates, true);
  validated.updated_at = new Date().toISOString();

  // 3. Apply update restricted to this user
  const { data: updated, error: updateError } = await client
    .from('user_scheme_applications')
    .update(validated)
    .eq('id', applicationId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateError) {
    const err = new Error(`Failed to update application: ${updateError.message}`);
    err.statusCode = 500;
    throw err;
  }

  return updated;
};

/**
 * Deletes an application record ONLY if it is owned by `userId`.
 * Implements strict IDOR protection.
 */
export const deleteUserApplication = async (userId, applicationId) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  if (!applicationId) {
    const err = new Error('Application ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const client = supabaseAdmin || supabase;

  // 1. Verify existence and ownership strictly
  const { data: existing, error: fetchError } = await client
    .from('user_scheme_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    const err = new Error(`Database error: ${fetchError.message}`);
    err.statusCode = 500;
    throw err;
  }
  if (!existing) {
    const err = new Error('Application record not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Delete row restricted to this user
  const { error: deleteError } = await client
    .from('user_scheme_applications')
    .delete()
    .eq('id', applicationId)
    .eq('user_id', userId);

  if (deleteError) {
    const err = new Error(`Failed to delete application: ${deleteError.message}`);
    err.statusCode = 500;
    throw err;
  }

  return { success: true, deletedId: applicationId };
};
