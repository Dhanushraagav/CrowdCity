import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeTransportationIssue } from '../services/groqService.js';
import logger from '../config/logger.js';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/transportation_reports.json');
const UPDATES_FILE = path.join(__dirname, '../data/transportation_updates.json');

function loadStoredReports() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    logger.warn('Failed to load transportation reports from disk: ' + err.message);
  }
  return [];
}

function loadStoredUpdates() {
  try {
    if (fs.existsSync(UPDATES_FILE)) {
      const data = fs.readFileSync(UPDATES_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    logger.warn('Failed to load transportation updates from disk: ' + err.message);
  }
  return [];
}

function persistReports() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryReports, null, 2), 'utf8');
  } catch (err) {
    logger.warn('Failed to persist transportation reports to disk: ' + err.message);
  }
}

function persistUpdates() {
  try {
    fs.writeFileSync(UPDATES_FILE, JSON.stringify(memoryUpdates, null, 2), 'utf8');
  } catch (err) {
    logger.warn('Failed to persist transportation updates to disk: ' + err.message);
  }
}

// In-memory fallback store when Supabase connection is offline
let memoryReports = loadStoredReports();
let memoryUpdates = loadStoredUpdates();

// Ensure canonical record trp-1790582037960 is seeded
if (!memoryReports.some(r => r.id === 'trp-1790582037960')) {
  memoryReports.unshift({
    id: 'trp-1790582037960',
    report_number: 'TRP-2026-9281',
    user_id: 'anonymous_citizen',
    title: 'Damaged Roads',
    description: 'Deep Asphalt Road pothole causing hazard for motorists and two-wheelers.',
    category: 'Damaged Roads',
    priority: 'Medium',
    severity: 'Medium',
    severity_score: 5,
    status: 'Submitted',
    address: 'KM 331/6 of Nagapattinam-Mysore Road - Pappampatty Road, Irugur, Sulur, Tamil Nadu, India',
    road_name: 'KM 331/6 of Nagapattinam-Mysore Road',
    landmark: 'Pappampatty Road',
    ward: 'Ward 12',
    latitude: 11.0028,
    longitude: 77.0654,
    photo_urls: [],
    responsible_department: 'Highways & Transportation Department',
    suggested_resolution: 'Fill pothole with hot-mix asphalt and compact surface.',
    confidence_score: 95.0,
    summary: 'Damaged road with deep asphalt pothole requiring immediate resurfacing.',
    assigned_to: 'Unassigned',
    created_at: '2026-09-28T05:13:57.960Z',
    updated_at: '2026-09-28T05:13:57.960Z'
  });
  persistReports();
}

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

    // Persist to memory and disk store
    memoryReports.unshift(newReport);
    persistReports();

    // Try Supabase Insertion
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('transportation_reports')
          .insert([newReport])
          .select()
          .single();

        if (!error && data) {
          return res.status(201).json({ success: true, report: data, aiAnalysis: aiTriage });
        }
      } catch (sbErr) {
        logger.warn('Supabase insert note in createReport: ' + sbErr.message);
      }
    }

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
    const found = await findTransportationRecord(id);
    if (!found || !found.report) {
      return res.status(404).json({ error: 'Transportation report not found.' });
    }
    return res.status(200).json({ success: true, report: found.report, history: found.updates });
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
    persistUpdates();
    persistReports();

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

/**
 * Find transportation record by ID or report number across Supabase, in-memory, and disk fallback
 */
export const findTransportationRecord = async (id) => {
  if (!id) return null;
  const targetId = String(id).trim();

  // 1. Try Supabase first if connected
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transportation_reports')
        .select('*')
        .or(`id.eq.${targetId},report_number.eq.${targetId}`)
        .maybeSingle();
      if (!error && data) {
        let updates = [];
        try {
          const { data: uData } = await supabase
            .from('transportation_updates')
            .select('*')
            .eq('report_id', data.id)
            .order('created_at', { ascending: false });
          if (uData) updates = uData;
        } catch (ue) {}
        return { report: data, updates };
      }
    } catch (sbErr) {
      logger.warn('Supabase lookup note in findTransportationRecord: ' + sbErr.message);
    }
  }

  // 2. Memory & Disk store lookup
  const report = memoryReports.find(r => r.id === targetId || r.report_number === targetId);
  if (!report) return null;
  const updates = memoryUpdates.filter(u => u.report_id === report.id);
  return { report, updates };
};

/**
 * Normalize transportation report into unified complaint schema for Issue Details and Timeline
 */
export const normalizeTransportationToIssue = (report, updates = []) => {
  if (!report) return null;
  const rawStatus = (report.status || 'submitted').toLowerCase().replace(/\s+/g, '_');

  const mappedHistory = (updates || []).map(u => ({
    id: u.id,
    issue_id: report.id,
    status: (u.status || rawStatus).toLowerCase().replace(/\s+/g, '_'),
    notes: u.remarks || `Status updated to ${u.status}`,
    created_at: u.created_at,
    profiles: {
      full_name: u.updated_by || 'Authority Official',
      role: 'authority'
    }
  }));

  const fullAddress = report.address || (report.road_name ? `${report.road_name}${report.landmark ? ', ' + report.landmark : ''}` : 'Coimbatore, Tamil Nadu');

  return {
    id: report.id,
    complaint_id: report.report_number || report.id,
    tracking_number: report.report_number || report.id,
    source_type: 'transportation',
    sourceType: 'transportation',
    is_transportation: true,
    title: report.title,
    description: report.description,
    category: report.category || 'roads',
    status: rawStatus,
    priority: report.priority || 'Medium',
    priority_level: (report.priority || 'Medium').toLowerCase(),
    priority_score: report.severity_score ? report.severity_score * 10 : 50,
    address: fullAddress,
    road_name: report.road_name || '',
    landmark: report.landmark || '',
    ward: report.ward || '',
    latitude: report.latitude ? parseFloat(report.latitude) : 11.0168,
    longitude: report.longitude ? parseFloat(report.longitude) : 76.9558,
    image_url: (report.photo_urls && report.photo_urls[0]) || null,
    photo_urls: report.photo_urls || [],
    ai_summary: report.summary || report.description,
    suggested_resolution: report.suggested_resolution || 'Inspect location and assign maintenance unit.',
    responsible_department: report.responsible_department || 'Highways & Transportation Department',
    assigned_to: report.assigned_to || 'Unassigned',
    assigned_officer: { full_name: report.assigned_to && report.assigned_to !== 'Unassigned' ? report.assigned_to : 'Transportation Engineer' },
    reporter_id: report.user_id || 'anonymous_citizen',
    reporter: { full_name: 'Citizen Reporter', avatar_url: null },
    citizen_count: 1,
    upvotes_count: 0,
    created_at: report.created_at,
    updated_at: report.updated_at,
    history: mappedHistory,
    comments: [],
    supporting_reports: [],
    attachments: []
  };
};

/**
 * Retrieve all transportation records for combined queries
 */
export const getAllTransportationRecords = async (filters = {}) => {
  let reports = [...memoryReports];
  if (supabase) {
    try {
      let query = supabase.from('transportation_reports').select('*').order('created_at', { ascending: false });
      if (filters.user_id && filters.user_id !== 'all') query = query.eq('user_id', filters.user_id);
      if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
      if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        reports = data;
      }
    } catch (e) {}
  }
  return reports;
};
