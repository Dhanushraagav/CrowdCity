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
    const filterStatus = filters.status.toLowerCase();
    filteredIssues = filteredIssues.filter(i => {
      const st = (i.status || 'pending').toLowerCase();
      if (filterStatus === 'overdue') return i.is_overdue || i.sla_status === 'overdue' || i.sla_status === 'breached';
      if (filterStatus === 'escalated') return i.is_escalated || i.escalation_level > 0 || i.sla_status === 'escalated';
      if (filterStatus === 'resolved' || filterStatus === 'verified') return st === 'resolved' || st === 'verified';
      return st === filterStatus;
    });
  }

  if (filters.department && filters.department !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const dept = (i.ai_department || i.department || '').toLowerCase();
      return dept.includes(filters.department.toLowerCase());
    });
  }

  // 5. Compute Overview (Scope-aware: reflects selected district if filtered, or All Tamil Nadu)
  const selectedDistrictId = filters.district && filters.district !== 'all' ? filters.district.toLowerCase() : null;
  const overviewIssues = selectedDistrictId
    ? filteredIssues.filter(i => i.district_id === selectedDistrictId)
    : filteredIssues;

  const tnTotal = overviewIssues.length;
  let tnResolved = 0;
  let tnPending = 0;
  let tnOpen = 0;
  let tnOverdue = 0;
  let tnEscalated = 0;
  let tnCritical = 0;

  overviewIssues.forEach(issue => {
    const st = (issue.status || 'pending').toLowerCase();
    const isResolved = st === 'resolved' || st === 'verified';
    if (isResolved) {
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
    const isResolved = st === 'resolved' || st === 'verified';
    if (isResolved) {
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
    const isResolved = st === 'resolved' || st === 'verified';
    if (isResolved) {
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
    const displayStatus = (st === 'verified') ? 'resolved' : st;
    statusCounts[displayStatus] = (statusCounts[displayStatus] || 0) + 1;

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

/**
 * Format milliseconds into human-readable duration (hours or days)
 */
function formatResolutionDuration(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '0 hrs';
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

/**
 * Fetch and calculate dynamic Authority Civic Intelligence with strict RBAC enforcement
 * @param {Object} officerContext - Authenticated officer { id, role, district, department, department_id }
 * @param {Object} filters - Requested filter parameters
 */
export async function getAuthorityCivicIntelligence(officerContext, filters = {}) {
  const activeClient = supabaseAdmin || supabase;
  const isAdmin = officerContext?.role === 'admin';

  // 1. Determine geographic & departmental permissions based on RBAC
  let enforcedDistrict = null;
  let enforcedDepartment = null;

  if (!isAdmin) {
    if (officerContext?.district) {
      enforcedDistrict = officerContext.district.toLowerCase();
    }
    if (officerContext?.department) {
      enforcedDepartment = officerContext.department.toLowerCase();
    }
  }

  // If officer is district-scoped, override any attempted query manipulation
  const requestedDistrict = enforcedDistrict || (filters.district && filters.district !== 'all' ? filters.district.toLowerCase() : null);
  const requestedDepartment = enforcedDepartment || (filters.department && filters.department !== 'all' ? filters.department.toLowerCase() : null);

  // 2. Fetch live issues from Supabase with resilient retry
  let rawIssues = null;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await activeClient
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        rawIssues = data;
        break;
      }
      lastError = error;
    } catch (e) {
      lastError = e;
    }
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  if (!rawIssues && lastError) {
    logger.error('[Authority Analytics] Error querying issues: %O', lastError);
    throw lastError;
  }

  const allIssues = rawIssues || [];

  // 3. Tag each complaint with verified district and live SLA state
  const taggedIssues = allIssues.map(issue => {
    if (typeof computeSlaState === 'function') {
      computeSlaState(issue);
    }
    const districtInfo = resolveDistrict(issue);
    return {
      ...issue,
      district_id: districtInfo.id,
      district_name: districtInfo.name,
      district_code: districtInfo.code
    };
  });

  // 4. Filter by RBAC base boundary
  let scopedIssues = taggedIssues;
  if (enforcedDistrict) {
    scopedIssues = scopedIssues.filter(i => i.district_id === enforcedDistrict);
  }
  if (enforcedDepartment) {
    scopedIssues = scopedIssues.filter(i => {
      const dept = (i.ai_department || i.department || '').toLowerCase();
      return dept.includes(enforcedDepartment);
    });
  }

  // 5. Apply User Filters (Date bounds, Category, Priority, Status, District, Department)
  let filteredIssues = scopedIssues;

  // Date Range Filtering
  const dateBounds = resolveDateRangeBounds(filters.date_range, filters.start_date, filters.end_date);
  if (dateBounds && dateBounds.start) {
    filteredIssues = filteredIssues.filter(issue => {
      const cDate = new Date(issue.created_at || 0);
      return cDate >= dateBounds.start && (!dateBounds.end || cDate <= dateBounds.end);
    });
  }

  // District filter (Admins can select any district; District Authorities are locked)
  if (requestedDistrict && requestedDistrict !== 'all') {
    filteredIssues = filteredIssues.filter(i => i.district_id === requestedDistrict);
  }

  // Department filter
  if (requestedDepartment && requestedDepartment !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const dept = (i.ai_department || i.department || '').toLowerCase();
      return dept.includes(requestedDepartment);
    });
  }

  // Category filter
  if (filters.category && filters.category !== 'all') {
    filteredIssues = filteredIssues.filter(i => (i.category || '').toLowerCase() === filters.category.toLowerCase());
  }

  // Priority filter
  if (filters.priority && filters.priority !== 'all') {
    filteredIssues = filteredIssues.filter(i => {
      const p = (i.ai_priority || i.priority || 'medium').toLowerCase();
      if (filters.priority.toLowerCase() === 'critical') {
        return p === 'critical' || i.is_emergency === true;
      }
      return p === filters.priority.toLowerCase();
    });
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    const filterStatus = filters.status.toLowerCase();
    filteredIssues = filteredIssues.filter(i => {
      const st = (i.status || 'pending').toLowerCase();
      if (filterStatus === 'overdue') return i.is_overdue || i.sla_status === 'overdue' || i.sla_status === 'breached';
      if (filterStatus === 'escalated') return i.is_escalated || i.escalation_level > 0 || i.sla_status === 'escalated';
      if (filterStatus === 'resolved' || filterStatus === 'verified') return st === 'resolved' || st === 'verified';
      return st === filterStatus;
    });
  }

  // 6. Authority Overview Calculations
  const total = filteredIssues.length;
  let resolvedCount = 0;
  let pendingCount = 0;
  let inProgressCount = 0;
  let assignedCount = 0;
  let criticalCount = 0;
  let overdueCount = 0;
  let escalatedCount = 0;
  let totalResolutionDurationMs = 0;
  let resolvedWithDurationCount = 0;

  const categoryMap = {};
  const areaMap = {};
  const statusMap = { pending: 0, assigned: 0, in_progress: 0, resolved: 0, verified: 0, rejected: 0 };
  const departmentMap = {};

  filteredIssues.forEach(issue => {
    const st = (issue.status || 'pending').toLowerCase();
    if (statusMap[st] !== undefined) {
      statusMap[st]++;
    } else {
      statusMap.pending++;
    }

    const isResolved = st === 'resolved' || st === 'verified';
    if (isResolved) {
      resolvedCount++;
      // Resolution time calculation
      const created = new Date(issue.created_at).getTime();
      const resolved = new Date(issue.responded_at || issue.updated_at).getTime();
      if (resolved > created) {
        totalResolutionDurationMs += (resolved - created);
        resolvedWithDurationCount++;
      }
    } else {
      if (st === 'pending') pendingCount++;
      else if (st === 'in_progress') inProgressCount++;
      else if (st === 'assigned') assignedCount++;
    }

    const isOverdue = issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached';
    if (isOverdue) overdueCount++;

    const isEscalated = issue.is_escalated || issue.escalation_level > 0 || issue.sla_status === 'escalated';
    if (isEscalated) escalatedCount++;

    const pr = (issue.ai_priority || issue.priority || '').toLowerCase();
    if (pr === 'critical' || issue.is_emergency === true) {
      criticalCount++;
    }

    // Category distribution
    const cat = (issue.category || 'other').toLowerCase();
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;

    // Hotspot area distribution
    const area = extractAreaName(issue.address);
    if (area) {
      areaMap[area] = (areaMap[area] || 0) + 1;
    }

    // Department grouping
    const rawDept = issue.ai_department || issue.department || 'General Administration';
    const deptKey = rawDept.trim();
    if (!departmentMap[deptKey]) {
      departmentMap[deptKey] = {
        name: deptKey,
        total: 0,
        resolved: 0,
        pending: 0,
        overdue: 0,
        escalated: 0
      };
    }
    const dObj = departmentMap[deptKey];
    dObj.total++;
    if (isResolved) dObj.resolved++;
    else dObj.pending++;
    if (isOverdue) dObj.overdue++;
    if (isEscalated) dObj.escalated++;
  });

  const activeCount = total - resolvedCount;
  const resolutionRateNumeric = total > 0 ? parseFloat(((resolvedCount / total) * 100).toFixed(1)) : 0;
  const slaComplianceNumeric = total > 0 ? parseFloat((((total - overdueCount) / total) * 100).toFixed(1)) : 100;
  const avgResolutionTimeMs = resolvedWithDurationCount > 0 ? (totalResolutionDurationMs / resolvedWithDurationCount) : 0;
  const avgResolutionTime = formatResolutionDuration(avgResolutionTimeMs);

  const overview = {
    total_complaints: total,
    active_complaints: activeCount,
    resolved_complaints: resolvedCount,
    pending_dispatch: pendingCount,
    in_progress: inProgressCount,
    assigned: assignedCount,
    critical_complaints: criticalCount,
    overdue_complaints: overdueCount,
    escalated_complaints: escalatedCount,
    resolution_rate: `${resolutionRateNumeric}%`,
    resolution_rate_numeric: resolutionRateNumeric,
    sla_compliance: `${slaComplianceNumeric}%`,
    sla_compliance_numeric: slaComplianceNumeric,
    avg_resolution_time: avgResolutionTime
  };

  // 7. Issue Category Breakdown
  const categoryAnalytics = Object.entries(categoryMap)
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // 8. Affected Areas / Hotspots
  const topHotspots = Object.entries(areaMap)
    .map(([area, count]) => ({
      area,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 9. SLA & Escalation Intelligence
  const onTrackCount = Math.max(0, total - overdueCount);
  const slaIntelligence = {
    sla_compliance: `${slaComplianceNumeric}%`,
    sla_compliance_numeric: slaComplianceNumeric,
    on_track: onTrackCount,
    pending_sla: activeCount,
    overdue: overdueCount,
    escalated: escalatedCount,
    sla_breached: overdueCount,
    avg_resolution_time: avgResolutionTime
  };

  // 10. Department Performance
  const departmentPerformance = Object.values(departmentMap).map(d => {
    const resRate = d.total > 0 ? parseFloat(((d.resolved / d.total) * 100).toFixed(1)) : 0;
    const slaComp = d.total > 0 ? parseFloat((((d.total - d.overdue) / d.total) * 100).toFixed(1)) : 100;
    return {
      department: d.name,
      total_assigned: d.total,
      resolved: d.resolved,
      pending: d.pending,
      overdue: d.overdue,
      escalated: d.escalated,
      resolution_rate: `${resRate}%`,
      resolution_rate_numeric: resRate,
      sla_compliance: `${slaComp}%`,
      sla_compliance_numeric: slaComp
    };
  }).sort((a, b) => b.total_assigned - a.total_assigned);

  // 11. District Intelligence & Comparison Matrix
  let districtAnalytics = [];
  let comparisonMatrix = [];

  if (isAdmin) {
    // Admins see full 38-district metrics and cross-district comparison
    const districtAgg = new Map();
    TN_DISTRICTS.forEach(d => {
      districtAgg.set(d.id, {
        id: d.id,
        name: d.name,
        nameTa: d.nameTa,
        code: d.code,
        total_issues: 0,
        resolved_issues: 0,
        critical_issues: 0,
        overdue_issues: 0,
        escalated_issues: 0,
        total_duration_ms: 0,
        resolved_count: 0,
        categories: {}
      });
    });

    filteredIssues.forEach(issue => {
      const d = districtAgg.get(issue.district_id);
      if (!d) return;

      d.total_issues++;
      const st = (issue.status || 'pending').toLowerCase();
      const isResolved = st === 'resolved' || st === 'verified';
      if (isResolved) {
        d.resolved_issues++;
        const c = new Date(issue.created_at).getTime();
        const r = new Date(issue.responded_at || issue.updated_at).getTime();
        if (r > c) {
          d.total_duration_ms += (r - c);
          d.resolved_count++;
        }
      }

      if (issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached') {
        d.overdue_issues++;
      }
      if (issue.is_escalated || issue.escalation_level > 0 || issue.sla_status === 'escalated') {
        d.escalated_issues++;
      }
      const pr = (issue.ai_priority || issue.priority || '').toLowerCase();
      if (pr === 'critical' || issue.is_emergency === true) {
        d.critical_issues++;
      }

      const cat = (issue.category || 'other').toLowerCase();
      d.categories[cat] = (d.categories[cat] || 0) + 1;
    });

    districtAnalytics = Array.from(districtAgg.values()).map(d => {
      const rate = d.total_issues > 0 ? parseFloat(((d.resolved_issues / d.total_issues) * 100).toFixed(1)) : 0;
      let topCat = 'None';
      let topCatCount = 0;
      for (const [c, cnt] of Object.entries(d.categories)) {
        if (cnt > topCatCount) {
          topCatCount = cnt;
          topCat = c;
        }
      }

      const avgDurMs = d.resolved_count > 0 ? (d.total_duration_ms / d.resolved_count) : 0;

      return {
        id: d.id,
        district: d.name,
        district_code: d.code,
        total_issues: d.total_issues,
        resolved_issues: d.resolved_issues,
        resolution_rate: `${rate}%`,
        resolution_rate_numeric: rate,
        critical_issues: d.critical_issues,
        overdue_issues: d.overdue_issues,
        escalated_issues: d.escalated_issues,
        most_reported_category: topCat,
        avg_resolution_time: formatResolutionDuration(avgDurMs)
      };
    });

    comparisonMatrix = [...districtAnalytics].sort((a, b) => b.total_issues - a.total_issues || b.resolution_rate_numeric - a.resolution_rate_numeric);
  } else if (enforcedDistrict) {
    // District Authority only sees their permitted district
    const singleDist = getDistrictById(enforcedDistrict);
    const distIssues = filteredIssues.filter(i => i.district_id === enforcedDistrict);
    const distTotal = distIssues.length;
    let distResolved = 0;
    let distCritical = 0;
    let distOverdue = 0;
    let distEscalated = 0;
    let distDurMs = 0;
    let distDurCount = 0;
    const distCats = {};

    distIssues.forEach(i => {
      const st = (i.status || 'pending').toLowerCase();
      const isRes = st === 'resolved' || st === 'verified';
      if (isRes) {
        distResolved++;
        const c = new Date(i.created_at).getTime();
        const r = new Date(i.responded_at || i.updated_at).getTime();
        if (r > c) {
          distDurMs += (r - c);
          distDurCount++;
        }
      }
      if (i.is_overdue || i.sla_status === 'overdue' || i.sla_status === 'breached') distOverdue++;
      if (i.is_escalated || i.escalation_level > 0 || i.sla_status === 'escalated') distEscalated++;
      const pr = (i.ai_priority || i.priority || '').toLowerCase();
      if (pr === 'critical' || i.is_emergency === true) distCritical++;
      const cat = (i.category || 'other').toLowerCase();
      distCats[cat] = (distCats[cat] || 0) + 1;
    });

    let topCat = 'None';
    let maxC = 0;
    for (const [c, cnt] of Object.entries(distCats)) {
      if (cnt > maxC) {
        maxC = cnt;
        topCat = c;
      }
    }

    const rate = distTotal > 0 ? parseFloat(((distResolved / distTotal) * 100).toFixed(1)) : 0;
    const singleObj = {
      id: enforcedDistrict,
      district: singleDist?.name || enforcedDistrict,
      district_code: singleDist?.code || enforcedDistrict.toUpperCase(),
      total_issues: distTotal,
      resolved_issues: distResolved,
      resolution_rate: `${rate}%`,
      resolution_rate_numeric: rate,
      critical_issues: distCritical,
      overdue_issues: distOverdue,
      escalated_issues: distEscalated,
      most_reported_category: topCat,
      avg_resolution_time: formatResolutionDuration(distDurCount > 0 ? distDurMs / distDurCount : 0)
    };

    districtAnalytics = [singleObj];
    comparisonMatrix = [singleObj];
  }

  // 12. Time Trends (Timeline buckets across selected date range)
  const timeBuckets = {};
  filteredIssues.forEach(issue => {
    const d = new Date(issue.created_at);
    // Format YYYY-MM-DD in Asia/Kolkata
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!timeBuckets[key]) {
      timeBuckets[key] = { date: key, reported: 0, resolved: 0, critical: 0, overdue: 0 };
    }
    timeBuckets[key].reported++;
    const st = (issue.status || 'pending').toLowerCase();
    if (st === 'resolved' || st === 'verified') timeBuckets[key].resolved++;
    const pr = (issue.ai_priority || issue.priority || '').toLowerCase();
    if (pr === 'critical' || issue.is_emergency === true) timeBuckets[key].critical++;
    if (issue.is_overdue || issue.sla_status === 'overdue' || issue.sla_status === 'breached') timeBuckets[key].overdue++;
  });

  const timeline = Object.values(timeBuckets).sort((a, b) => a.date.localeCompare(b.date));

  return {
    overview,
    category_analytics: categoryAnalytics,
    top_hotspots: topHotspots,
    sla_intelligence: slaIntelligence,
    department_performance: departmentPerformance,
    district_intelligence: districtAnalytics,
    district_comparison: isAdmin ? comparisonMatrix : null,
    timeline,
    meta: {
      scope: {
        role: officerContext?.role,
        is_admin: isAdmin,
        enforced_district: enforcedDistrict,
        enforced_department: enforcedDepartment,
        active_district: requestedDistrict || 'all',
        active_department: requestedDepartment || 'all'
      },
      filters_applied: {
        district: requestedDistrict || 'all',
        department: requestedDepartment || 'all',
        category: filters.category || 'all',
        status: filters.status || 'all',
        priority: filters.priority || 'all',
        date_range: filters.date_range || 'all_time'
      },
      timezone: 'Asia/Kolkata',
      generated_at: new Date().toISOString()
    }
  };
}
