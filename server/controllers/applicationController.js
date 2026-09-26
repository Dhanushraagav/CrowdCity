import {
  listUserApplications,
  createUserApplication,
  updateUserApplication,
  deleteUserApplication
} from '../services/applicationTrackerService.js';

/**
 * GET /api/applications
 * Returns all application records strictly belonging to the authenticated user.
 */
export const getApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { status, search } = req.query;
    const applications = await listUserApplications(userId, { status, search });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (err) {
    console.error('[ApplicationController] getApplications error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to load applications'
    });
  }
};

/**
 * POST /api/applications
 * Creates a new application record bound strictly to req.user.id.
 * Ignores any client-supplied user_id in req.body to prevent privilege escalation.
 */
export const createApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const created = await createUserApplication(userId, req.body || {});

    return res.status(201).json({
      success: true,
      application: created
    });
  } catch (err) {
    console.error('[ApplicationController] createApplication error:', err.message);
    return res.status(err.statusCode || 400).json({
      error: err.message || 'Failed to create application record'
    });
  }
};

/**
 * PATCH /api/applications/:id
 * Updates an application record ONLY if owned by req.user.id.
 */
export const updateApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const appId = req.params.id;
    const updated = await updateUserApplication(userId, appId, req.body || {});

    return res.status(200).json({
      success: true,
      application: updated
    });
  } catch (err) {
    console.error('[ApplicationController] updateApplication error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to update application record'
    });
  }
};

/**
 * DELETE /api/applications/:id
 * Deletes an application record ONLY if owned by req.user.id.
 */
export const deleteApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const appId = req.params.id;
    const result = await deleteUserApplication(userId, appId);

    return res.status(200).json({
      success: true,
      message: 'Application record deleted successfully',
      ...result
    });
  } catch (err) {
    console.error('[ApplicationController] deleteApplication error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to delete application record'
    });
  }
};
