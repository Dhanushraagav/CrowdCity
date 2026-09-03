import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../config/logger.js';
import { TN_DISTRICTS, resolveDistrict, getAllDistricts, getDistrictById } from '../config/districtsConfig.js';
import { computeSlaState } from './slaService.js';

/**
 * Resolve start/end timestamps for requested date range in Asia/Kolkata timezone
 */
function resolveDateRangeBounds(rangeType, customStart, customEnd) {
  if (customStart && customEnd) {
    return {
      start: new Date(customStart),
      end: new Date(customEnd)
    };
  }

  const now = new Date();
  // Adjust to IST (+5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  switch (rangeType) {
    case 'today': {
      const startIst = new Date(istNow);
      startIst.setUTCHours(0, 0, 0, 0);
      return {
        start: new Date(startIst.getTime() - istOffsetMs),
        end: now
      };
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    case 'this_year': {
      const startIst = new Date(istNow);
      startIst.setUTCMonth(0, 1);
      startIst.setUTCHours(0, 0, 0, 0);
      return {
        start: new Date(startIst.getTime() - istOffsetMs),
        end: now
      };
    }
    case 'all_time':
    default:
      return null;
  }
}

/**
 * Extract distinct locality/area name from full address
 */
function extractAreaName(address) {
  if (!address || typeof address !== 'string') return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  
  // Filter out general words like India, Tamil Nadu, Post, pin codes
  const filtered = parts.filter(part => {
    const p = part.toLowerCase();
    if (p === 'india' || p === 'tamil nadu' || p === 'tamilnadu') return false;
    if (/^\d{5,6}$/.test(p)) return false; // Pin code
    return true;
  });

  if (filtered.length === 0) return null;
  // Return the most specific neighborhood/locality or first 2 parts
  if (filtered.length >= 2) {
    return `${filtered[0]}, ${filtered[1]}`;
  }
  return filtered[0];
}

/**
 * Fetch and calculate dynamic Tamil Nadu 38-District Civic Intelligence
 */
export async function getTamilNaduCivicIntelligence(filters = {}) {
  const activeClient = supabaseAdmin || supabase;

  // 1. Fetch live issues from Supabase
  let { data: rawIssues, error } = await activeClient
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error querying issues for civic intelligence: %O', error);
    throw error;
  }

  const allIssues = rawIssues || [];

  // 2. Normalize and compute SLA/District state for each complaint
  const taggedIssues = allIssues.map(issue => {
    // Run SLA computation so overdue and escalation states are live and current
    if (typeof computeSlaState === 'function') {
      computeSlaState(issue);
    }
    
    // Tag with verified district
    const districtInfo = resolveDistrict(issue);
    return {
      ...issue,
      district_id: districtInfo.id,
      district_name: districtInfo.name,
      district_code: districtInfo.code
    };
  });

  // 3. Apply Date Filtering
  let filteredIssues = taggedIssues;
  const dateBounds = resolveDateRangeBounds(filters.date_range, filters.start_date, filters.end_date);
  if (dateBounds && dateBounds.start) {
    filteredIssues = filteredIssues.filter(issue => {
      const cDate = new Date(issue.created_at || 0);
      return cDate >= dateBounds.start && (!dateBounds.end || cDate <= dateBounds.end);
    });
  }

  // 4. Apply Additional Factor Filters (Category, Priority, Department)
  if (filters.category && filters.category !== 'all') {
    filteredIssues = filteredIssues.filter(i => (i.category || '').toLowerCase() === filters.category.toLowerCase());
  }

  if (filters.priority && filters.priority !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const p = (i.ai_priority || i.priority || 'medium').toLowerCase();
      if (filters.priority.toLowerCase() === 'critical') {
        return p === 'critical' || i.is_emergency === true;
      }
      return p === filters.priority.toLowerCase();
    });
  }

  if (filters.status && filters.status !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const st = (i.status || 'pending').toLowerCase();
      if (filters.status === 'overdue') return i.is_overdue || i.sla_status === 'overdue' || i.sla_status === 'breached';
      if (filters.status === 'escalated') return i.is_escalated || i.escalation_level > 0 || i.sla_status === 'escalated';
      return st === filters.status.toLowerCase();
    });
  }

  if (filters.department && filters.department !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const dept = (i.ai_department || i.department || '').toLowerCase();
      return dept.includes(filters.department.toLowerCase());
    });
  }

  // 5. Compute State-Wide Overall Overview (Top of page)
  const tnTotal = filteredIssues.length;
  let tnResolved = 0;
  let tnPending = 0;
  let tnOpen = 0;
  let tnOverdue = 0;
  let tnEscalated = 0;
  let tnCritical = 0;

  filteredIssues.forEach(issue => {
    const st = (issue.status || 'pending').toLowerCase();
    if (st === 'resolved') {
      tnResolved++;
    } else {
      tnOpen++;
      if (st === 'pending') tnPending++;
    }

    if (issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached') {
      tnOverdue++;
    }

    if (issue.is_escalated || issue.escalation_level > 0 || issue.sla_status === 'escalated') {
      tnEscalated++;
    }

    const pr = (issue.ai_priority || issue.priority || '').toLowerCase();
    if (pr === 'critical' || issue.is_emergency === true) {
      tnCritical++;
    }
  });

  const tnResolutionRate = tnTotal > 0 ? ((tnResolved / tnTotal) * 100).toFixed(1) : '0.0';

  const overview = {
    total_issues: tnTotal,
    open_issues: tnOpen,
    resolved_issues: tnResolved,
    pending_issues: tnPending,
    overdue_issues: tnOverdue,
    escalated_issues: tnEscalated,
    critical_issues: tnCritical,
    resolution_rate: `${tnResolutionRate}%`,
    resolution_rate_numeric: parseFloat(tnResolutionRate)
  };

  // 6. Compute 38-District View (Full array for all 38 districts)
  const districtMap = new Map();
  TN_DISTRICTS.forEach(d => {
    districtMap.set(d.id, {
      id: d.id,
      name: d.name,
      nameTa: d.nameTa,
      code: d.code,
      lat: d.lat,
      lng: d.lng,
      total_issues: 0,
      resolved_issues: 0,
      pending_issues: 0,
      open_issues: 0,
      overdue_issues: 0,
      escalated_issues: 0,
      critical_issues: 0,
      categories: {},
      areas: {}
    });
  });

  filteredIssues.forEach(issue => {
    const distData = districtMap.get(issue.district_id);
    if (!distData) return;

    distData.total_issues++;
    const st = (issue.status || 'pending').toLowerCase();
    if (st === 'resolved') {
      distData.resolved_issues++;
    } else {
      distData.open_issues++;
      if (st === 'pending') distData.pending_issues++;
    }

    if (issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached') {
      distData.overdue_issues++;
    }

    if (issue.is_escalated || issue.escalation_level > 0 || issue.sla_status === 'escalated') {
      distData.escalated_issues++;
    }

    const pr = (issue.ai_priority || issue.priority || '').toLowerCase();
    if (pr === 'critical' || issue.is_emergency === true) {
      distData.critical_issues++;
    }

    // Category count
    const cat = (issue.category || 'other').toLowerCase();
    distData.categories[cat] = (distData.categories[cat] || 0) + 1;

    // Area count
    const area = extractAreaName(issue.address);
    if (area) {
      distData.areas[area] = (distData.areas[area] || 0) + 1;
    }
  });

  const districtsArray = Array.from(districtMap.values()).map(d => {
    const rate = d.total_issues > 0 ? ((d.resolved_issues / d.total_issues) * 100).toFixed(1) : '0.0';
    
    // Find most reported category
    let mostCategory = 'None';
    let maxCatCount = 0;
    for (const [cat, cnt] of Object.entries(d.categories)) {
      if (cnt > maxCatCount) {
        maxCatCount = cnt;
        mostCategory = cat;
      }
    }

    return {
      id: d.id,
      name: d.name,
      nameTa: d.nameTa,
      code: d.code,
      total_issues: d.total_issues,
      resolved_issues: d.resolved_issues,
      open_issues: d.open_issues,
      pending_issues: d.pending_issues,
      overdue_issues: d.overdue_issues,
      escalated_issues: d.escalated_issues,
      critical_issues: d.critical_issues,
      resolution_rate: `${rate}%`,
      resolution_rate_numeric: parseFloat(rate),
      most_reported_category: mostCategory,
      most_reported_category_count: maxCatCount,
      raw_categories: d.categories,
      raw_areas: d.areas
    };
  });

  // 7. Selected District Scope (or All Tamil Nadu if 'all')
  const selectedDistrictId = filters.district && filters.district !== 'all' ? filters.district.toLowerCase() : null;
  const targetIssues = selectedDistrictId
    ? filteredIssues.filter(i => i.district_id === selectedDistrictId)
    : filteredIssues;

  // Selected Scope Calculations
  const scopeTotal = targetIssues.length;
  let scopeResolved = 0;
  let scopeOpen = 0;
  let scopePending = 0;
  let scopeOverdue = 0;
  let scopeEscalated = 0;
  let scopeCritical = 0;

  const categoryCounts = {};
  const statusCounts = {};
  const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const areaCounts = {};

  targetIssues.forEach(i => {
    const st = (i.status || 'pending').toLowerCase();
    if (st === 'resolved') {
      scopeResolved++;
    } else {
      scopeOpen++;
      if (st === 'pending') scopePending++;
    }

    if (i.is_overdue || i.sla_status === 'overdue' || i.sla_status === 'breached') {
      scopeOverdue++;
    }

    if (i.is_escalated || i.escalation_level > 0 || i.sla_status === 'escalated') {
      scopeEscalated++;
    }

    const pr = (i.ai_priority || i.priority || 'medium').toLowerCase();
    if (pr === 'critical' || i.is_emergency === true) {
      scopeCritical++;
      priorityCounts.critical++;
    } else if (priorityCounts[pr] !== undefined) {
      priorityCounts[pr]++;
    } else {
      priorityCounts.medium++;
    }

    // Category
    const cat = (i.category || 'other').toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // Status
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    // Area
    const area = extractAreaName(i.address);
    if (area) {
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    }
  });

  // Most reported issue in selected scope
  let topCategory = 'None';
  let topCategoryCount = 0;
  for (const [cat, cnt] of Object.entries(categoryCounts)) {
    if (cnt > topCategoryCount) {
      topCategoryCount = cnt;
      topCategory = cat;
    }
  }

  // Format Category Distribution
  const categoryDistribution = Object.entries(categoryCounts)
    .map(([category, count]) => ({
      category,
      count,
      percentage: scopeTotal > 0 ? parseFloat(((count / scopeTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Format Status Distribution
  const statusDistribution = Object.entries(statusCounts)
    .map(([status, count]) => ({
      status,
      count,
      percentage: scopeTotal > 0 ? parseFloat(((count / scopeTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Format Most Affected Areas
  const mostAffectedAreas = Object.entries(areaCounts)
    .map(([area, count]) => ({
      name: area,
      count,
      percentage: scopeTotal > 0 ? parseFloat(((count / scopeTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const scopeResolutionRate = scopeTotal > 0 ? ((scopeResolved / scopeTotal) * 100).toFixed(1) : '0.0';

  const selectedScopeData = {
    district_id: selectedDistrictId || 'all',
    district_name: selectedDistrictId ? (getDistrictById(selectedDistrictId)?.name || selectedDistrictId) : 'All Tamil Nadu',
    overview: {
      total_issues: scopeTotal,
      open_issues: scopeOpen,
      resolved_issues: scopeResolved,
      pending_issues: scopePending,
      overdue_issues: scopeOverdue,
      escalated_issues: scopeEscalated,
      critical_issues: scopeCritical,
      resolution_rate: `${scopeResolutionRate}%`,
      resolution_rate_numeric: parseFloat(scopeResolutionRate)
    },
    most_reported_issue: {
      category: topCategory,
      count: topCategoryCount,
      percentage: scopeTotal > 0 ? parseFloat(((topCategoryCount / scopeTotal) * 100).toFixed(1)) : 0
    },
    category_distribution: categoryDistribution,
    status_distribution: statusDistribution,
    priority_distribution: priorityCounts,
    most_affected_areas: mostAffectedAreas
  };

  // 8. District Comparison Matrix (Sortable ranking list)
  const comparisonMatrix = districtsArray.map(d => ({
    id: d.id,
    district: d.name,
    district_code: d.code,
    total_issues: d.total_issues,
    resolved_issues: d.resolved_issues,
    resolution_rate: d.resolution_rate,
    resolution_rate_numeric: d.resolution_rate_numeric,
    critical_issues: d.critical_issues,
    overdue_issues: d.overdue_issues,
    escalated_issues: d.escalated_issues
  })).sort((a, b) => b.total_issues - a.total_issues || b.resolution_rate_numeric - a.resolution_rate_numeric);

  return {
    state_overview: overview,
    selected_scope: selectedScopeData,
    districts: districtsArray,
    comparison: comparisonMatrix,
    meta: {
      total_districts: 38,
      timezone: 'Asia/Kolkata',
      generated_at: new Date().toISOString(),
      filters_applied: {
        district: filters.district || 'all',
        date_range: filters.date_range || 'all_time',
        category: filters.category || 'all',
        status: filters.status || 'all',
        priority: filters.priority || 'all',
        department: filters.department || 'all'
      }
    }
  };
}
