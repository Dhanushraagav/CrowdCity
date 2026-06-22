import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import logger from '../config/logger.js';

export const getDepartments = async (req, res) => {
  try {
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data || []);
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

  const codeUpper = code.trim().toUpperCase();

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
