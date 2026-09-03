import { supabase, supabaseAdmin } from '../config/supabase.js';
import { TN_DISTRICTS, resolveDistrict, getDistrictById } from '../config/districtsConfig.js';
import { normalizeComplaintRecord } from './complaintIdService.js';
import { computeSlaState } from './slaService.js';
import logger from '../config/logger.js';

// Common synonyms and keyword mappings for intuitive searching
const CATEGORY_ALIASES = {
  'pothole': 'roads',
  'potholes': 'roads',
  'road': 'roads',
  'roads': 'roads',
  'pavement': 'roads',
  'streetlight': 'streetlights',
  'streetlights': 'streetlights',
  'light': 'streetlights',
  'lights': 'streetlights',
  'lamp': 'streetlights',
  'electrical': 'streetlights',
  'garbage': 'garbage',
  'waste': 'garbage',
  'trash': 'garbage',
  'dump': 'garbage',
  'rubbish': 'garbage',
  'drain': 'drainage',
  'drainage': 'drainage',
  'sewer': 'drainage',
  'sewerage': 'drainage',
  'water': 'water_supply',
  'water supply': 'water_supply',
  'drinking water': 'water_supply',
  'pipeline': 'water_supply',
  'leak': 'water_supply',
  'traffic': 'traffic',
  'signal': 'traffic',
  'signals': 'traffic',
  'sanitation': 'sanitation',
  'toilet': 'sanitation',
  'toilets': 'sanitation',
  'park': 'parks',
  'parks': 'parks',
  'playground': 'parks',
  'hazard': 'safety_hazard',
  'safety': 'safety_hazard',
  'danger': 'safety_hazard',
  'pollution': 'environment',
  'environment': 'environment'
};

const STATUS_ALIASES = {
  'overdue': 'overdue',
  'breached': 'overdue',
  'sla breached': 'overdue',
  'sla overdue': 'overdue',
  'escalated': 'escalated',
  'level 1': 'escalated',
  'level 2': 'escalated',
  'resolved': 'resolved',
  'verified': 'resolved',
  'completed': 'resolved',
  'fixed': 'resolved',
  'closed': 'resolved',
  'pending': 'pending',
  'open': 'open',
  'in progress': 'in_progress',
  'inprogress': 'in_progress',
  'working': 'in_progress',
  'assigned': 'assigned'
};

/**
 * Intelligent Global Civic Search
 * Searches complaints across Complaint ID, District, Location, Category, Status, Priority, and Department.
 * 
 * @param {Object} params Search query parameters (q, district, category, status, priority, department, limit, page, etc.)
 * @param {Object} [user] Authenticated user context (if provided)
 * @returns {Promise<{ success: boolean, total: number, page: number, limit: number, query: string, data: Array }>}
 */
export async function searchCivicIssues(params = {}, user = null) {
  const q = (params.q || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || 15, 10)));
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const offset = (page - 1) * limit;

  const filterDistrict = (params.district && params.district !== 'all') ? params.district.toLowerCase().trim() : null;
  const filterCategory = (params.category && params.category !== 'all') ? params.category.toLowerCase().trim() : null;
  const filterStatus = (params.status && params.status !== 'all') ? params.status.toLowerCase().trim() : null;
  const filterPriority = (params.priority && params.priority !== 'all') ? params.priority.toLowerCase().trim() : null;
  const filterDepartment = (params.department && params.department !== 'all') ? params.department.toLowerCase().trim() : null;
  const filterStartDate = params.start_date ? new Date(params.start_date) : null;
  const filterEndDate = params.end_date ? new Date(params.end_date) : null;

  logger.info(`[Global Search] Query: "${q}" | District: "${filterDistrict}" | Category: "${filterCategory}" | Status: "${filterStatus}" | Priority: "${filterPriority}" | Dept: "${filterDepartment}"`);

  // If query is completely empty and no filters are set, return clean empty result
  if (!q && !filterDistrict && !filterCategory && !filterStatus && !filterPriority && !filterDepartment && !filterStartDate && !filterEndDate) {
    return {
      success: true,
      total: 0,
      page,
      limit,
      query: '',
      data: []
    };
  }

  const activeClient = supabaseAdmin || supabase;

  // Enforce strict projection: only public/operational complaint fields, NEVER citizen personal data
  let query = activeClient
    .from('issues')
    .select(`
      id,
      complaint_id,
      title,
      description,
      category,
      status,
      priority,
      department,
      ai_category,
      ai_priority,
      ai_department,
      address,
      district,
      latitude,
      longitude,
      image_url,
      completion_proof_url,
      created_at,
      updated_at,
      is_emergency,
      sla_deadline,
      sla_status,
      responded_at,
      escalated_at,
      escalation_level,
      upvotes_count
    `);

  // 1. Direct field filtering at SQL level when explicit filter params are supplied
  if (filterCategory) {
    if (filterCategory === 'roads') {
      query = query.in('category', ['roads', 'pothole']);
    } else if (filterCategory === 'streetlights') {
      query = query.in('category', ['streetlights', 'streetlight']);
    } else {
      query = query.eq('category', filterCategory);
    }
  }

  if (filterStatus) {
    if (filterStatus === 'resolved') {
      query = query.in('status', ['resolved', 'verified']);
    } else if (filterStatus === 'overdue') {
      query = query.or('sla_status.eq.overdue,sla_status.eq.breached');
    } else if (filterStatus === 'escalated') {
      query = query.or('escalation_level.gt.0,sla_status.eq.escalated');
    } else if (filterStatus === 'open') {
      query = query.in('status', ['pending', 'assigned', 'in_progress']);
    } else {
      query = query.eq('status', filterStatus);
    }
  }

  if (filterPriority) {
    query = query.or(`priority.eq.${filterPriority},ai_priority.eq.${filterPriority}`);
  }

  if (filterDepartment) {
    query = query.or(`department.ilike.%${filterDepartment}%,ai_department.ilike.%${filterDepartment}%`);
  }

  if (filterStartDate && !isNaN(filterStartDate.getTime())) {
    query = query.gte('created_at', filterStartDate.toISOString());
  }
  if (filterEndDate && !isNaN(filterEndDate.getTime())) {
    query = query.lte('created_at', filterEndDate.toISOString());
  }

  // 2. Query search condition parsing
  const qLower = q.toLowerCase();
  const isExactComplaintIdFormat = /^CC(-\d{4})?(-\d+)?$/i.test(q) || q.toUpperCase().startsWith('CC-');

  // If search query is provided, apply multi-field matching
  if (q) {
    // If it clearly looks like a Complaint ID, search complaint_id directly
    if (isExactComplaintIdFormat) {
      query = query.ilike('complaint_id', `%${q}%`);
    } else {
      // General search across complaint_id, title, address, description, category, status, and department
      const escapedQ = q.replace(/[%_,]/g, ' ').trim();
      const orConditions = [
        `complaint_id.ilike.%${escapedQ}%`,
        `title.ilike.%${escapedQ}%`,
        `address.ilike.%${escapedQ}%`,
        `description.ilike.%${escapedQ}%`,
        `category.ilike.%${escapedQ}%`,
        `status.ilike.%${escapedQ}%`,
        `department.ilike.%${escapedQ}%`,
        `ai_department.ilike.%${escapedQ}%`
      ];

      // Expand category aliases (e.g. "pothole" -> roads)
      const mappedCategory = CATEGORY_ALIASES[qLower];
      if (mappedCategory) {
        orConditions.push(`category.eq.${mappedCategory}`);
      }

      // Expand status aliases (e.g. "verified", "resolved", "overdue", "escalated")
      const mappedStatus = STATUS_ALIASES[qLower];
      if (mappedStatus === 'resolved') {
        orConditions.push('status.eq.resolved');
        orConditions.push('status.eq.verified');
      } else if (mappedStatus === 'overdue') {
        orConditions.push('sla_status.eq.overdue');
        orConditions.push('sla_status.eq.breached');
      } else if (mappedStatus === 'escalated') {
        orConditions.push('sla_status.eq.escalated');
        orConditions.push('escalation_level.gt.0');
      } else if (mappedStatus) {
        orConditions.push(`status.eq.${mappedStatus}`);
      }

      // If query matches a known district name or code, expand with district keywords
      const matchedDist = TN_DISTRICTS.find(d => 
        d.id === qLower || 
        d.name.toLowerCase() === qLower || 
        d.nameTa === q ||
        d.code === qLower ||
        d.keywords.some(k => k === qLower)
      );
      if (matchedDist) {
        orConditions.push(`address.ilike.%${matchedDist.name}%`);
        orConditions.push(`district.ilike.%${matchedDist.id}%`);
        for (const kw of matchedDist.keywords.slice(0, 10)) {
          orConditions.push(`address.ilike.%${kw}%`);
        }
      }

      query = query.or(orConditions.join(','));
    }
  }

  // Fetch results sorted by created_at
  const { data: rawIssues, error } = await query
    .order('created_at', { ascending: false })
    .limit(Math.min(100, limit * 3)); // Fetch enough to rank and score accurately

  if (error) {
    logger.error('Error in searchCivicIssues query: %O', error);
    throw new Error(`Search database query failed: ${error.message}`);
  }

  if (!rawIssues || rawIssues.length === 0) {
    return {
      success: true,
      total: 0,
      page,
      limit,
      query: q,
      data: []
    };
  }

  // 3. Process, Resolve Districts, Compute SLA, and Score Relevance
  const scoredIssues = [];

  for (const issue of rawIssues) {
    normalizeComplaintRecord(issue);
    computeSlaState(issue);

    const resolvedDistrict = resolveDistrict(issue);
    issue.resolved_district = resolvedDistrict;

    // Apply district filter if requested
    if (filterDistrict && resolvedDistrict && resolvedDistrict.id !== filterDistrict) {
      continue;
    }

    // Compute Relevance Score
    let score = 0;
    const compId = (issue.complaint_id || '').toLowerCase();
    const title = (issue.title || '').toLowerCase();
    const desc = (issue.description || '').toLowerCase();
    const addr = (issue.address || '').toLowerCase();
    const cat = (issue.category || '').toLowerCase();
    const dept = (issue.ai_department || issue.department || '').toLowerCase();
    const stat = (issue.status || '').toLowerCase();
    const distName = (resolvedDistrict ? resolvedDistrict.name.toLowerCase() : '');

    // A. Exact Complaint ID Match -> Score 1000 (Highest Priority)
    if (q && compId === qLower) {
      score += 1000;
    } else if (q && compId.startsWith(qLower)) {
      score += 500;
    } else if (q && compId.includes(qLower)) {
      score += 300;
    }

    // B. Category Match
    const mappedCat = CATEGORY_ALIASES[qLower];
    if (mappedCat && cat === mappedCat) {
      score += 250;
    } else if (q && cat.includes(qLower)) {
      score += 150;
    }

    // C. District Match
    if (q && (distName === qLower || (resolvedDistrict && resolvedDistrict.code === qLower))) {
      score += 220;
    } else if (q && (distName.includes(qLower) || addr.includes(qLower))) {
      score += 120;
    }

    // D. Status / SLA Match
    const mappedStatus = STATUS_ALIASES[qLower];
    if (mappedStatus === 'overdue' && (issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached')) {
      score += 240;
    } else if (mappedStatus === 'escalated' && (issue.is_escalated || issue.escalation_level > 0)) {
      score += 240;
    } else if (mappedStatus === 'resolved' && (stat === 'resolved' || stat === 'verified')) {
      score += 200;
    } else if (mappedStatus === 'pending' && stat === 'pending') {
      score += 200;
    } else if (q && stat === qLower) {
      score += 180;
    }

    // E. Department Match
    if (q && (dept.includes(qLower) || (qLower === 'highways' && dept.includes('road')))) {
      score += 210;
    }

    // F. Title & Address Match
    if (q && title.includes(qLower)) {
      score += 140;
    }
    if (q && desc.includes(qLower)) {
      score += 60;
    }

    // Base score for recency
    const ageInHours = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 50 - Math.min(50, ageInHours / 24));

    // Sanitized, Privacy-Safe Output Format
    scoredIssues.push({
      id: issue.id,
      complaint_id: issue.complaint_id,
      title: issue.title,
      description: issue.description,
      category: issue.category,
      status: issue.status,
      priority: issue.ai_priority || issue.priority || 'medium',
      department: issue.ai_department || issue.department || 'General Civic Administration',
      address: issue.address,
      district: resolvedDistrict ? {
        id: resolvedDistrict.id,
        name: resolvedDistrict.name,
        nameTa: resolvedDistrict.nameTa,
        code: resolvedDistrict.code
      } : null,
      latitude: issue.latitude,
      longitude: issue.longitude,
      created_at: issue.created_at,
      sla_status: issue.sla_status,
      sla_deadline: issue.sla_deadline,
      is_overdue: Boolean(issue.is_overdue),
      is_escalated: Boolean(issue.is_escalated),
      escalation_level: issue.escalation_level || 0,
      upvotes_count: issue.upvotes_count || 0,
      image_url: issue.image_url || null,
      completion_proof_url: issue.completion_proof_url || null,
      relevance_score: score
    });
  }

  // 4. Sort by relevance score descending, then by created_at descending
  scoredIssues.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const total = scoredIssues.length;
  const paginated = scoredIssues.slice(offset, offset + limit);

  return {
    success: true,
    total,
    page,
    limit,
    query: q,
    data: paginated
  };
}
