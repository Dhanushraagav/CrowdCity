import { supabase } from '../config/supabase.js';

/**
 * Middleware to verify Supabase JWT tokens.
 * Enforces production-only Supabase token verification.
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

    // Query profiles to check if suspended and check role
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_suspended')
      .eq('id', user.id);

    if (profileError) {
      console.error(`[Auth Middleware] Failed to fetch user profile:`, profileError.message);
      return res.status(500).json({ error: 'Authentication database verification failed' });
    }

    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (profile && profile.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact administrative support.' });
    }

    req.user = user;
    if (profile) {
      req.user.role = profile.role;
    } else {
      // Default fallback if profile record is missing but authentication is valid
      req.user.role = 'citizen';
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
