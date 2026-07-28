import { analyzeTransportationIssue } from '../services/groqService.js';
import logger from '../config/logger.js';
import { supabase } from '../config/supabase.js';

// In-memory fallback store when Supabase connection is offline
let memoryReports = [
  {
    id: 'trp-001',
    report_number: 'TRP-2026-1001',
    user_id: 'c101',
    title: 'Severe Pothole on DB Road Junction',
    description: 'Deep asphalt crater near RS Puram signal causing sudden braking and axle damage to vehicles.',
    category: 'Potholes',
    priority: 'High',
    severity: 'High',
    status: 'In Progress',
    address: 'Diwan Bahadur Road, RS Puram, Coimbatore, Tamil Nadu',
    latitude: 11.0065,
    longitude: 76.9520,
    photo_urls: ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop'],
    responsible_department: 'Roads Department',
    suggested_resolution: 'Deploy hot-mix asphalt patching crew and roller compaction team.',
    confidence_score: 95.8,
    summary: 'Deep asphalt crater near RS Puram signal causing vehicle damage and traffic bottleneck.',
    assigned_to: 'Eng. K. Rajan (Roads Dept)',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'trp-002',
    report_number: 'TRP-2026-1002',
    user_id: 'c102',
    title: 'Traffic Light Power Failure at Gandhipuram Flyover',
    description: 'All four traffic signal heads are unlit creating dangerous gridlock during peak hours.',
    category: 'Traffic Signal Not Working',
    priority: 'Critical',
    severity: 'Critical',
    status: 'Assigned',
    address: 'Gandhipuram Signal Junction, Coimbatore, Tamil Nadu',
    latitude: 11.0183,
    longitude: 76.9644,
    photo_urls: [],
    responsible_department: 'Traffic Police',
    suggested_resolution: 'Deploy traffic police constable for manual control and dispatch signal electrician.',
    confidence_score: 97.4,
    summary: 'Complete traffic light outage at Gandhipuram intersection causing severe congestion.',
    assigned_to: 'Insp. S. Murugan (Traffic Police)',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'trp-003',
    report_number: 'TRP-2026-1003',
    user_id: 'c103',
    title: 'Waterlogging Under Avinashi Road Railway Underpass',
    description: '3 feet of stagnant storm water accumulated under the underpass following heavy rain.',
    category: 'Waterlogging',
    priority: 'High',
    severity: 'High',
    status: 'Submitted',
    address: 'Avinashi Road Railway Bridge, Coimbatore, Tamil Nadu',
    latitude: 11.0118,
    longitude: 76.9691,
    photo_urls: [],
    responsible_department: 'Municipal Corporation',
    suggested_resolution: 'Position mobile dewatering pump and clear blocked storm drain inlet.',
    confidence_score: 93.2,
    summary: 'Waterlogging under Avinashi Road underpass stalling light vehicles.',
    assigned_to: 'Unassigned',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 6).toISOString()
  }
];

let memoryUpdates = [
  {
    id: 'u001',
    report_id: 'trp-001',
    updated_by: 'Eng. K. Rajan',
    status: 'In Progress',
    remarks: 'Field inspection completed. Asphalt patching unit dispatched to site.',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

// Helper to generate unique report numbers
function generateReportNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TRP-${new Date().getFullYear()}-${rand}`;
}

/**
 * 1. AI Analysis Endpoint for Draft Input
 */
export const analyzeReportAI = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required for analysis.' });
    }

    const aiResult = await analyzeTransportationIssue(title, description, category);
    return res.status(200).json({ success: true, analysis: aiResult });
  } catch (err) {
    logger.error('Error in analyzeReportAI controller:', err);
    return res.status(500).json({ error: 'Failed to analyze transportation issue.' });
  }
};

/**
 * 2. Create Transportation Report
 */
export const createReport = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      address,
      road_name,
      landmark,
      ward,
      latitude,
      longitude,
      photo_urls,
      user_id
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    // Run AI Classification Engine
    let aiTriage = {};
    try {
      aiTriage = await analyzeTransportationIssue(title, description, category);
    } catch (e) {
      logger.warn('AI analysis fallback triggered:', e);
      aiTriage = {
        category: category || 'Damaged Roads',
        priority: 'Medium',
        severity: 'Medium',
        severity_score: 5,
        department: 'Roads Department',
        suggested_resolution: 'Inspect site and assign maintenance crew.',
        confidence_score: 89.0,
        summary: title
      };
    }

    const reportNumber = generateReportNumber();
    const newReport = {
      id: `trp-${Date.now()}`,
      report_number: reportNumber,
      user_id: user_id || 'anonymous_citizen',
      title,
      description,
      category: aiTriage.category || category || 'Damaged Roads',
      priority: aiTriage.priority || 'Medium',
      severity: aiTriage.severity || 'Medium',
      severity_score: aiTriage.severity_score || 5,
      status: 'Submitted',
      address: address || 'Coimbatore, Tamil Nadu',
      road_name: road_name || '',
      landmark: landmark || '',
      ward: ward || '',
      latitude: latitude ? parseFloat(latitude) : 11.0168,
      longitude: longitude ? parseFloat(longitude) : 76.9558,
      photo_urls: Array.isArray(photo_urls) ? photo_urls : [],
      responsible_department: aiTriage.department || 'Roads Department',
      suggested_resolution: aiTriage.suggested_resolution || 'Inspect location and assign repair unit.',
      confidence_score: aiTriage.confidence_score || 92.5,
      summary: aiTriage.summary || title,
      assigned_to: 'Unassigned',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try Supabase Insertion first
    if (supabase) {
      const { data, error } = await supabase
        .from('transportation_reports')
        .insert([newReport])
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({ success: true, report: data, aiAnalysis: aiTriage });
      }
    }

    // Fallback to Memory Store
    memoryReports.unshift(newReport);
    return res.status(201).json({ success: true, report: newReport, aiAnalysis: aiTriage });
  } catch (err) {
    logger.error('Error creating transportation report:', err);
    return res.status(500).json({ error: 'Failed to submit transportation report.' });
  }
};

/**
 * 3. Get Transportation Reports with Filtering & Search
 */
export const getReports = async (req, res) => {
  try {
    const { category, priority, department, status, search, user_id, road_name } = req.query;

    let reports = [...memoryReports];

    // Try fetching from Supabase if connected
    if (supabase) {
      try {
        let query = supabase.from('transportation_reports').select('*').order('created_at', { ascending: false });

        if (category && category !== 'All') query = query.eq('category', category);
        if (priority && priority !== 'All') query = query.eq('priority', priority);
        if (department && department !== 'All') query = query.eq('responsible_department', department);
        if (status && status !== 'All') query = query.eq('status', status);
        if (user_id) query = query.eq('user_id', user_id);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          reports = data;
        }
      } catch (sbErr) {
        logger.warn('Supabase fetch error, using memory store:', sbErr);
      }
    }

    // Apply filtering & searching on local collection
    let filtered = reports;

    if (user_id) {
      filtered = filtered.filter(r => r.user_id === user_id || user_id === 'all');
    }
    if (category && category !== 'All') {
      filtered = filtered.filter(r => (r.category || '').toLowerCase() === category.toLowerCase());
    }
    if (priority && priority !== 'All') {
      filtered = filtered.filter(r => (r.priority || '').toLowerCase() === priority.toLowerCase());
    }
    if (department && department !== 'All') {
      filtered = filtered.filter(r => (r.responsible_department || '').toLowerCase() === department.toLowerCase());
    }
    if (status && status !== 'All') {
      filtered = filtered.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    if (road_name && road_name.trim() !== '') {
      const rn = road_name.trim().toLowerCase();
      filtered = filtered.filter(r => (r.road_name || '').toLowerCase().includes(rn) || (r.address || '').toLowerCase().includes(rn));
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r => 
        (r.title || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q) ||
        (r.road_name || '').toLowerCase().includes(q) ||
        (r.landmark || '').toLowerCase().includes(q) ||
        (r.report_number || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
      );
    }

    return res.status(200).json({ success: true, count: filtered.length, reports: filtered });
  } catch (err) {
    logger.error('Error fetching transportation reports:', err);
    return res.status(500).json({ error: 'Failed to fetch transportation reports.' });
  }
};

/**
 * 4. Get Report Details by ID
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    let report = memoryReports.find(r => r.id === id || r.report_number === id);

    if (supabase) {
      const { data, error } = await supabase
        .from('transportation_reports')
        .select('*')
        .or(`id.eq.${id},report_number.eq.${id}`)
        .single();
      if (!error && data) report = data;
    }

    if (!report) {
      return res.status(404).json({ error: 'Transportation report not found.' });
    }

    const updates = memoryUpdates.filter(u => u.report_id === report.id);
    return res.status(200).json({ success: true, report, history: updates });
  } catch (err) {
    logger.error('Error fetching report by ID:', err);
    return res.status(500).json({ error: 'Failed to load report details.' });
  }
};

/**
 * 5. Update Report Status & Assign Engineer (Authority Endpoint)
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, assigned_to, completion_photo_url, updated_by } = req.body;

    let report = memoryReports.find(r => r.id === id || r.report_number === id);

    if (supabase) {
      const { data, error } = await supabase
        .from('transportation_reports')
        .select('*')
        .or(`id.eq.${id},report_number.eq.${id}`)
        .single();
      if (!error && data) report = data;
    }

    if (!report) {
      return res.status(404).json({ error: 'Transportation report not found.' });
    }

    // Update fields
    const updatedStatus = status || report.status;
    const updatedAssignee = assigned_to || report.assigned_to;
    const now = new Date().toISOString();

    report.status = updatedStatus;
    report.assigned_to = updatedAssignee;
    report.updated_at = now;

    // Create Update Log
    const newLog = {
      id: `u-${Date.now()}`,
      report_id: report.id,
      updated_by: updated_by || 'Authority Official',
      status: updatedStatus,
      remarks: remarks || `Status updated to ${updatedStatus}.`,
      completion_photo_url: completion_photo_url || null,
      created_at: now
    };

    memoryUpdates.unshift(newLog);

    if (supabase) {
      await supabase
        .from('transportation_reports')
        .update({ status: updatedStatus, assigned_to: updatedAssignee, updated_at: now })
        .eq('id', report.id);

      await supabase
        .from('transportation_updates')
        .insert([newLog]);
    }

    return res.status(200).json({ success: true, report, log: newLog });
  } catch (err) {
    logger.error('Error updating transportation report status:', err);
    return res.status(500).json({ error: 'Failed to update report status.' });
  }
};
