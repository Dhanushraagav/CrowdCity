import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeTransportationIssue } from '../services/groqService.js';
import logger from '../config/logger.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { findUnifiedDuplicate } from '../services/duplicateDetectionService.js';
import { computeImageHash } from '../services/imageHashService.js';

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

    // Upload images to Supabase Storage if files were provided via Multer
    const uploadedPhotoUrls = [];
    let primaryImageHash = null;
    if (req.files && req.files.length > 0) {
      const activeClient = supabaseAdmin || supabase;
      for (const file of req.files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reports/${fileName}`;

        const { error: uploadError } = await activeClient.storage
          .from('issue-images')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = activeClient.storage
            .from('issue-images')
            .getPublicUrl(filePath);
          uploadedPhotoUrls.push(publicUrl);
        } else {
          logger.warn('Failed to upload transportation image to storage: ' + uploadError.message);
        }
      }

      if (uploadedPhotoUrls.length === 0) {
        return res.status(500).json({ error: 'Failed to upload photo evidence to storage. Please try again.' });
      }

      // Compute perceptual hash of primary image for duplicate detection
      try {
        const hashResult = await computeImageHash(req.files[0].buffer);
        if (hashResult) primaryImageHash = hashResult.hash;
      } catch (hashErr) {
        logger.warn('Image hash computation failed: ' + hashErr.message);
      }
    }

    // Backend duplicate detection enforcement
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    if (lat && lng && category) {
      try {
        const dupResult = await findUnifiedDuplicate({
          latitude: lat,
          longitude: lng,
          category,
          title,
          description,
          imageHash: primaryImageHash,
          sourceType: 'transportation'
        });

        if (dupResult.result === 'CONFIRMED_DUPLICATE' && dupResult.candidate) {
          return res.status(200).json({
            success: false,
            duplicate_detected: true,
            duplicate_result: dupResult.result,
            duplicate_score: dupResult.score,
            candidate: dupResult.candidate,
            signals: dupResult.signals,
            message: 'A confirmed duplicate complaint exists for this location and issue type.'
          });
        }

        if (dupResult.result === 'POSSIBLE_DUPLICATE' && dupResult.candidate) {
          // For POSSIBLE_DUPLICATE, include advisory info but allow creation
          // The frontend will show the citizen a confirmation dialog
        }
      } catch (dupErr) {
        logger.warn('Duplicate detection non-blocking error: ' + dupErr.message);
      }
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
    const finalPhotoUrls = uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : (Array.isArray(photo_urls) ? photo_urls : []);
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
      image_url: finalPhotoUrls.length > 0 ? finalPhotoUrls[0] : null,
      photo_urls: finalPhotoUrls,
      image_hash: primaryImageHash,
      attachments: uploadedPhotoUrls.map((url, idx) => ({
        id: `att-${idx + 1}`,
        file_url: url,
        file_name: req.files && req.files[idx] ? req.files[idx].originalname : `evidence-${idx + 1}.jpg`,
        file_size: req.files && req.files[idx] ? req.files[idx].size : 0
      })),
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
    if (typeof uploadedPhotoUrls !== 'undefined' && uploadedPhotoUrls.length > 0) {
      try {
        const activeClient = supabaseAdmin || supabase;
        const filePaths = uploadedPhotoUrls.map(u => {
          const match = u.split('/issue-images/');
          return match.length > 1 ? match[1] : null;
        }).filter(Boolean);
        if (filePaths.length > 0) {
          await activeClient.storage.from('issue-images').remove(filePaths);
        }
      } catch (cleanErr) {
        logger.warn('Storage cleanup non-blocking note: ' + cleanErr.message);
      }
    }
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

    return res.status(200).json({ success: true, count: filtered.length, reports: filtered, data: filtered });
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
 * Update transportation record helper
 */
export const updateTransportationRecord = async (id, updatedFields = {}, newLog = null) => {
  let report = memoryReports.find(r => r.id === id || r.report_number === id);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transportation_reports')
        .select('*')
        .or(`id.eq.${id},report_number.eq.${id}`)
        .single();
      if (!error && data) report = data;
    } catch (e) {}
  }

  if (!report) return null;

  Object.assign(report, updatedFields);
  report.updated_at = updatedFields.updated_at || new Date().toISOString();

  if (newLog) {
    memoryUpdates.unshift(newLog);
    persistUpdates();
  }
  persistReports();

  if (supabase) {
    try {
      await supabase
        .from('transportation_reports')
        .update(updatedFields)
        .eq('id', report.id);

      if (newLog) {
        await supabase
          .from('transportation_updates')
          .insert([newLog]);
      }
    } catch (sbErr) {
      logger.warn('Supabase transportation update note: ' + sbErr.message);
    }
  }

  return report;
};

/**
 * 5. Update Report Status & Assign Engineer (Authority Endpoint)
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, assigned_to, completion_photo_url, updated_by } = req.body;

    const report = memoryReports.find(r => r.id === id || r.report_number === id);
    if (!report) {
      return res.status(404).json({ error: 'Transportation report not found.' });
    }

    const updatedStatus = status || report.status;
    const updatedAssignee = assigned_to !== undefined ? assigned_to : report.assigned_to;
    const now = new Date().toISOString();

    const newLog = {
      id: `u-${Date.now()}`,
      report_id: report.id,
      updated_by: updated_by || 'Authority Official',
      status: updatedStatus,
      remarks: remarks || `Status updated to ${updatedStatus}.`,
      completion_photo_url: completion_photo_url || null,
      created_at: now
    };

    const updatedReport = await updateTransportationRecord(
      id,
      {
        status: updatedStatus,
        assigned_to: updatedAssignee,
        official_remarks: remarks || report.official_remarks,
        completion_photo_url: completion_photo_url !== undefined ? completion_photo_url : report.completion_photo_url,
        updated_at: now
      },
      newLog
    );

    return res.status(200).json({ success: true, report: updatedReport, log: newLog });
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
  const detectedDistrict = report.district || (fullAddress.toLowerCase().includes('coimbatore') || fullAddress.toLowerCase().includes('sulur') || fullAddress.toLowerCase().includes('irugur') ? 'Coimbatore' : 'Tamil Nadu');

  const defaultAuthorityResolution = report.authority_resolution || {
    jurisdiction: {
      district: detectedDistrict,
      taluk: report.landmark || 'Sulur',
      villageOrTown: report.ward || 'Irugur',
      localBody: 'Sulur Town Panchayat',
      localBodyType: 'Town Panchayat'
    },
    administrativeAuthority: {
      office: report.responsible_department || 'Highways & Rural Roads Wing',
      designation: 'Assistant Divisional Engineer (Highways)',
      phone: '+91 422 230 1234',
      email: 'highways.sulur@tn.gov.in',
      address: 'Highways Sub-Division Office, Sulur, Coimbatore - 641402'
    },
    escalationContact: {
      office: 'District Collectorate, Coimbatore',
      designation: 'District Revenue Officer (DRO)',
      phone: '+91 422 230 0101',
      email: 'collr-cbe@nic.in'
    }
  };

  return {
    id: report.id,
    complaint_id: report.report_number || report.id,
    tracking_number: report.report_number || report.id,
    source_type: 'transportation',
    sourceType: 'transportation',
    is_transportation: true,
    title: report.title,
    description: report.description,
    category: report.category || 'Damaged Roads',
    status: rawStatus,
    priority: report.priority || 'Medium',
    priority_level: (report.priority || 'Medium').toLowerCase(),
    priority_score: report.severity_score ? report.severity_score * 10 : 50,
    address: fullAddress,
    location: fullAddress,
    district: detectedDistrict,
    road_name: report.road_name || '',
    landmark: report.landmark || '',
    ward: report.ward || '',
    latitude: report.latitude ? parseFloat(report.latitude) : 11.0028,
    longitude: report.longitude ? parseFloat(report.longitude) : 77.0654,
    image_url: (report.photo_urls && report.photo_urls[0]) || null,
    photo_urls: report.photo_urls || [],
    ai_summary: report.summary || report.description,
    suggested_resolution: report.suggested_resolution || 'Inspect location and assign maintenance unit.',
    responsible_department: report.responsible_department || 'Highways & Transportation Department',
    assigned_to: report.assigned_to && report.assigned_to !== 'Unassigned' ? report.assigned_to : null,
    assignedOfficial: report.assigned_to && report.assigned_to !== 'Unassigned' ? report.assigned_to : null,
    assigned_officer: { full_name: report.assigned_to && report.assigned_to !== 'Unassigned' ? report.assigned_to : 'Transportation Engineer' },
    reporter_id: report.user_id || 'anonymous_citizen',
    reporter: { full_name: 'Citizen Reporter', avatar_url: null, email: 'citizen@crowdcity.gov.in' },
    citizen_count: 1,
    upvotes_count: 0,
    created_at: report.created_at,
    createdAt: report.created_at,
    updated_at: report.updated_at || report.created_at,
    updatedAt: report.updated_at || report.created_at,
    authority_resolution: defaultAuthorityResolution,
    history: mappedHistory,
    comments: [],
    supporting_reports: [],
    attachments: (report.attachments && report.attachments.length > 0)
      ? report.attachments
      : (report.photo_urls || []).map((url, i) => ({
          id: `att-${i + 1}`,
          file_url: url,
          file_name: `evidence-${i + 1}.jpg`
        }))
  };
};

/**
 * POST /api/transportation/reports/check-duplicate
 * Advisory pre-check for transportation duplicate complaints.
 */
export const checkTransportationDuplicate = async (req, res) => {
  const { latitude, longitude, category, title, description } = req.body;

  if (!latitude || !longitude || !category) {
    return res.status(400).json({ error: 'Latitude, longitude, and category are required for duplicate checking.' });
  }

  try {
    const result = await findUnifiedDuplicate({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      category,
      title: title || '',
      description: description || '',
      sourceType: 'transportation'
    });

    return res.status(200).json({
      is_duplicate: result.result !== 'NEW_ISSUE',
      result: result.result,
      score: result.score,
      candidate: result.candidate,
      signals: result.signals
    });
  } catch (err) {
    logger.error('checkTransportationDuplicate Error: %O', err);
    return res.status(500).json({ error: 'Failed to check for duplicate complaints' });
  }
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
