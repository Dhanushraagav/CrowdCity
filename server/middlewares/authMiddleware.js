import { supabase } from '../config/supabase.js';
import { MOCK_PROFILES } from '../controllers/authController.js';

/**
 * Middleware to verify Supabase JWT tokens.
 * Supports mock bypass for local development if Supabase is unconfigured.
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  // Check if we are running in Mock/Development Mode
  const isMockToken = token.startsWith('mock-jwt-token');
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  if (!isSupabaseConfigured) {
    // Infer role from mock token string if specified: e.g. mock-jwt-token-authority
    let mockRole = 'citizen';
    if (token.includes('authority')) mockRole = 'authority';
    else if (token.includes('admin')) mockRole = 'admin';

    let mockId = token === 'mock-jwt-token' ? 'mock-user-id-123' : `mock-user-${mockRole}`;
    if (token.startsWith('mock-jwt-token-')) {
      const suffix = token.substring('mock-jwt-token-'.length);
      mockId = `mock-user-${suffix}`;
    }

    // Check if user is suspended in mock profiles
    const profile = MOCK_PROFILES.find(p => p.id === mockId);
    if (profile && profile.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact administrative support.' });
    }

    req.user = {
      id: mockId,
      email: `${mockRole}@crowdcity.mock`,
      user_metadata: { full_name: `Mock ${mockRole.charAt(0).toUpperCase() + mockRole.slice(1)}` },
      role: mockRole // Cache role directly on the user object
    };
    return next();
  }

  try {
    // Verify the token by calling supabase.auth.getUser()
    console.log(`[Auth Middleware] Verifying token prefix: ${token ? token.substring(0, 15) + '...' : 'none'}`);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error(`[Auth Middleware] JWT validation failed. Error:`, error);
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid or expired token',
        details: error ? error.message : 'No user payload returned' 
      });
    }

    // Query profiles to check if suspended
    const { data: profiles } = await supabase
      .from('profiles')
      .select('role, is_suspended')
      .eq('id', user.id);

    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (profile && profile.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact administrative support.' });
    }

    req.user = user;
    if (profile) {
      req.user.role = profile.role;
    }
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server authentication error' });
  }
};

/**
 * Role-based access control middleware.
 * Must be used AFTER requireAuth.
 */
export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // Fallback for Mock Mode
    const isSupabaseConfigured = process.env.SUPABASE_URL && 
                                 !process.env.SUPABASE_URL.includes('placeholder') &&
                                 process.env.SUPABASE_URL !== '';

    if (!isSupabaseConfigured || req.user.id.startsWith('mock-')) {
      const userRole = req.user.role || 'citizen';
      if (allowedRoles.includes(userRole)) {
        req.userProfile = { role: userRole };
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    try {
      // Query the user's role from the public profiles table
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id);

      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (error || !profile || !allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }

      req.userProfile = profile;
      next();
    } catch (err) {
      console.error('Role check middleware error:', err);
      return res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
};
