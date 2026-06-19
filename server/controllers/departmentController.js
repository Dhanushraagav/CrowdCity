import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import logger from '../config/logger.js';

export let MOCK_DEPARTMENTS = [
  { id: 'mock-dept-road', name: 'Road Department', code: 'ROAD', description: 'Responsible for potholes, road damage, and sidewalks.' },
  { id: 'mock-dept-san', name: 'Sanitation Department', code: 'SAN', description: 'Responsible for garbage collection, waste management, and littering.' },
  { id: 'mock-dept-water', name: 'Water Department', code: 'WATER', description: 'Responsible for water leakages, pipeline bursts, and drainage blockages.' },
  { id: 'mock-dept-elec', name: 'Electrical Department', code: 'ELEC', description: 'Responsible for streetlight outages and electrical faults.' }
];

export const getDepartments = async (req, res) => {
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || (req.user && req.user.id.startsWith('mock-'));

  if (isMock) {
    return res.status(200).json(MOCK_DEPARTMENTS);
  }

  try {
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    logger.error('getDepartments Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching departments' });
  }
};

export const createDepartment = async (req, res) => {
  const { name, code, description } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'Name and code are required for departments.' });
  }

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || (req.user && req.user.id.startsWith('mock-'));

  const codeUpper = code.trim().toUpperCase();

  if (isMock) {
    const exists = MOCK_DEPARTMENTS.some(d => d.code === codeUpper);
    if (exists) {
      return res.status(400).json({ error: `Department with code '${codeUpper}' already exists.` });
    }
    const newDept = {
      id: `mock-dept-${Date.now()}`,
      name: name.trim(),
      code: codeUpper,
      description: description ? description.trim() : ''
    };
    MOCK_DEPARTMENTS.push(newDept);
    return res.status(201).json(newDept);
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('departments')
      .insert({
        name: name.trim(),
        code: codeUpper,
        description: description ? description.trim() : ''
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Department name or code already exists.' });
      }
      throw error;
    }
    return res.status(201).json(data);
  } catch (err) {
    logger.error('createDepartment Error: %O', err);
    return res.status(500).json({ error: 'Server error creating department' });
  }
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || id.startsWith('mock-');

  if (isMock) {
    const dept = MOCK_DEPARTMENTS.find(d => d.id === id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }
    if (name) dept.name = name.trim();
    if (description !== undefined) dept.description = description.trim();
    return res.status(200).json(dept);
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();

    const { data, error } = await activeClient
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    logger.error('updateDepartment Error: %O', err);
    return res.status(500).json({ error: 'Server error updating department' });
  }
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || id.startsWith('mock-');

  if (isMock) {
    const index = MOCK_DEPARTMENTS.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }
    MOCK_DEPARTMENTS.splice(index, 1);
    return res.status(200).json({ message: 'Department deleted successfully (Mock)' });
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { error } = await activeClient
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(200).json({ message: 'Department deleted successfully' });
  } catch (err) {
    logger.error('deleteDepartment Error: %O', err);
    return res.status(500).json({ error: 'Server error deleting department' });
  }
};
