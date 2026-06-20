import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import logger from '../config/logger.js';
import { sendWelcomeEmail, sendVerificationOtpEmail, sendLoginOtpEmail, sendResetPasswordEmail } from '../services/emailService.js';
import { otpService } from '../services/otpService.js';

// In-memory safeguard to ensure welcome email is triggered at most once per user session/server run
const SENT_WELCOME_ATTEMPTS = new Set();

/**
 * Helper to trigger welcome email exactly once per user lifetime
 */
async function triggerWelcomeEmail(userId, email, fullName, isMock = false) {
  const emailLower = (email || '').toLowerCase().trim();
  
  if (isMock) {
    let profile = MOCK_PROFILES.find(p => p.id === userId);
    if (!profile) {
      profile = {
        id: userId,
        full_name: fullName || 'Citizen',
        email: emailLower,
        avatar_url: '',
        role: 'citizen',
        welcome_email_sent: false,
        created_at: new Date().toISOString()
      };
      MOCK_PROFILES.push(profile);
    }

    if (profile.welcome_email_sent === true || SENT_WELCOME_ATTEMPTS.has(userId)) {
      logger.info('[Welcome] Existing user - skipping welcome email');
      return { success: true, alreadySent: true };
    }

    logger.info('[Welcome] New account detected');
    logger.info('[Welcome] Sending welcome email...');
    const success = await sendWelcomeEmail(emailLower, fullName || 'Citizen', userId);
    if (success) {
      profile.welcome_email_sent = true;
      SENT_WELCOME_ATTEMPTS.add(userId);
      logger.info('[Welcome] Email sent successfully');
      logger.info('[Welcome] welcome_email_sent updated');
      return { success: true };
    } else {
      logger.error(`[Welcome] Failed to send mock welcome email for user: ${userId}`);
      return { success: false };
    }
  }

  // Real Supabase Mode
  try {
    let { data: profiles, error: selectError } = await supabaseAdmin
      .from('profiles')
      .select('welcome_email_sent, full_name')
      .eq('id', userId);

    if (selectError) {
      logger.error(`[Welcome] Error fetching profile: ${selectError.message}`);
      return { success: false, error: selectError.message };
    }

    let profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!profile) {
      logger.warn(`[Welcome] Profile row not found for user: ${userId}`);
      return { success: false, error: 'Profile not found' };
    }

    if (profile.welcome_email_sent === true || SENT_WELCOME_ATTEMPTS.has(userId)) {
      logger.info('[Welcome] Existing user - skipping welcome email');
      return { success: true, alreadySent: true };
    }

    let verifiedEmail = emailLower;
    if (supabaseAdmin) {
      try {
        const { data, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!authError && data && data.user && data.user.email) {
          verifiedEmail = data.user.email.toLowerCase().trim();
        }
      } catch (e) {
        logger.warn(`[Welcome] Failed to verify email from auth: %O`, e);
      }
    }

    if (!verifiedEmail) {
      logger.error(`[Welcome] No valid email found for user: ${userId}`);
      return { success: false, error: 'No email found' };
    }

    logger.info('[Welcome] New account detected');
    logger.info('[Welcome] Sending welcome email...');
    const success = await sendWelcomeEmail(verifiedEmail, fullName || profile.full_name || 'Citizen', userId);

    if (success) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ welcome_email_sent: true })
        .eq('id', userId);

      if (updateError) {
        logger.warn(`[Welcome] Failed to update welcome_email_sent flag in database: ${updateError.message}`);
      } else {
        logger.info('[Welcome] welcome_email_sent updated');
      }

      SENT_WELCOME_ATTEMPTS.add(userId);
      logger.info('[Welcome] Email sent successfully');
      return { success: true };
    } else {
      logger.error(`[Welcome] Failed to send welcome email for user: ${userId}`);
      return { success: false };
    }
  } catch (err) {
    logger.error(`[Welcome] Exception in triggerWelcomeEmail: %O`, err);
    return { success: false, error: err.message };
  }
}

// Local cache for mock profile data
export let MOCK_PROFILES = [
  {
    id: 'mock-user-id-123',
    full_name: 'Alex Rivera',
    email: 'citizen@crowdcity.mock',
    avatar_url: '',
    role: 'citizen',
    points: 120,
    is_suspended: false,
    is_verified_authority: false,
    created_at: new Date(Date.now() - 30*24*60*60*1000).toISOString()
  },
  {
    id: 'mock-user-authority',
    full_name: 'Officer Davis',
    email: 'authority@crowdcity.mock',
    avatar_url: '',
    role: 'authority',
    points: 80,
    is_suspended: false,
    is_verified_authority: true,
    department_id: 'mock-dept-road',
    created_at: new Date(Date.now() - 60*24*60*60*1000).toISOString()
  },
  {
    id: 'mock-user-admin',
    full_name: 'Super Admin',
    email: 'admin@crowdcity.mock',
    avatar_url: '',
    role: 'admin',
    points: 450,
    is_suspended: false,
    is_verified_authority: false,
    created_at: new Date(Date.now() - 90*24*60*60*1000).toISOString()
  }
];

/**
 * Get the current user's profile details (includes role).
 */
export const getProfile = async (req, res) => {
  const userId = req.user.id;
  let profileToReturn = null;
  let userEmail = req.user.email;

  // Fallback for Mock Mode
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';
  if (!isSupabaseConfigured || userId.startsWith('mock-')) {
    let profile = MOCK_PROFILES.find(p => p.id === userId);
    let justCreated = false;
    if (!profile) {
      const mockRole = req.user.role || 'citizen';
      profile = {
        id: userId,
        full_name: req.user.user_metadata?.full_name || 'Citizen',
        email: req.user.email || `${mockRole}@crowdcity.mock`,
        avatar_url: '',
        role: mockRole,
        welcome_email_sent: false,
        created_at: new Date().toISOString()
      };
      MOCK_PROFILES.push(profile);
      justCreated = true;
    }
    
    profileToReturn = profile;
    userEmail = profile.email;

    // Trigger welcome email asynchronously ONLY if the profile was just created
    if (justCreated && userEmail && !userEmail.includes('@crowdcity.mock')) {
      triggerWelcomeEmail(userId, userEmail, profile.full_name, true);
    } else if (profile && profile.welcome_email_sent !== true) {
      logger.info('[Welcome] Existing user - skipping welcome email');
    }

    return res.status(200).json(profileToReturn);
  }

  try {
    const activeClient = getSupabaseClient(req);
    const { data: profiles, error } = await activeClient
      .from('profiles')
      .select('*')
      .eq('id', userId);

    console.log(`[getProfile] User ID: ${userId}`);
    console.log(`[getProfile] Query result count: ${profiles ? profiles.length : 0}`);
    console.log(`[getProfile] Returned profile data:`, profiles ? JSON.stringify(profiles) : null);

    if (error) {
      logger.error('getProfile Fetch Error: %O', error);
      return res.status(400).json({ error: error.message });
    }

    let profile = null;
    let justCreated = false;
    if (!profiles || profiles.length === 0) {
      // If profile is not found but authenticated, create it automatically
      console.log(`[getProfile] No profile found for user ${userId}. Automatically creating profile row...`);
      const { data: createdProfiles, error: createError } = await activeClient
        .from('profiles')
        .insert({
          id: userId,
          full_name: req.user.user_metadata?.full_name || 'Citizen',
          avatar_url: '',
          role: 'citizen'
        })
        .select();

      if (createError) {
        logger.error('getProfile Auto-creation Error: %O', createError);
        return res.status(400).json({ error: createError.message });
      }

      profile = createdProfiles && createdProfiles.length > 0 ? createdProfiles[0] : null;
      justCreated = true;
      console.log(`[getProfile] Created profile data:`, JSON.stringify(profile));
    } else {
      profile = profiles[0];
    }

    profileToReturn = profile;

    // Trigger welcome email asynchronously ONLY if the profile was just created
    if (justCreated && userEmail && profileToReturn) {
      triggerWelcomeEmail(userId, userEmail, profileToReturn.full_name, false);
    } else if (profileToReturn && profileToReturn.welcome_email_sent !== true) {
      logger.info('[Welcome] Existing user - skipping welcome email');
    }

    return res.status(200).json(profileToReturn);
  } catch (err) {
    logger.error('getProfile Error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving profile' });
  }
};

/**
 * Update another user's role (Admin Only)
 */
export const updateUserRole = async (req, res) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: 'Please provide userId and role' });
  }

  const allowedRoles = ['citizen', 'authority', 'admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role designation' });
  }

  // Fallback for Mock Mode
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';
  if (!isSupabaseConfigured || userId.startsWith('mock-')) {
    let profile = MOCK_PROFILES.find(p => p.id === userId);
    if (profile) {
      profile.role = role;
    } else {
      profile = {
        id: userId,
        full_name: `Mock User`,
        email: `${role}@crowdcity.mock`,
        avatar_url: '',
        role: role,
        created_at: new Date().toISOString()
      };
      MOCK_PROFILES.push(profile);
    }
    return res.status(200).json({
      message: 'User role updated successfully (Mock)',
      profile: profile
    });
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Profile not found or access denied' });
    }

    return res.status(200).json({ message: 'User role updated successfully', profile: data[0] });
  } catch (err) {
    logger.error('updateUserRole Error: %O', err);
    return res.status(500).json({ error: 'Server error updating user role' });
  }
};

/**
 * Get all users and their profiles (Admin Only)
 */
export const getAllUsers = async (req, res) => {
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';
  
  if (!isSupabaseConfigured || req.user.id.startsWith('mock-')) {
    return res.status(200).json(MOCK_PROFILES);
  }

  try {
    let usersList = [];
    if (supabaseAdmin) {
      const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (!usersError && users) {
        usersList = users;
      }
    }

    const activeClient = getSupabaseClient(req);
    const { data: profiles, error: profilesError } = await activeClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return res.status(400).json({ error: profilesError.message });
    }

    const profilesWithEmail = profiles.map(profile => {
      const matchedUser = usersList.find(u => u.id === profile.id);
      return {
        ...profile,
        email: matchedUser ? matchedUser.email : 'N/A'
      };
    });

    return res.status(200).json(profilesWithEmail);
  } catch (err) {
    logger.error('getAllUsers Error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving users list' });
  }
};

/**
 * Toggle suspension status of a user (Admin Only)
 */
export const toggleUserSuspension = async (req, res) => {
  const { id } = req.params;
  const { isSuspended } = req.body;

  if (isSuspended === undefined) {
    return res.status(400).json({ error: 'Please specify isSuspended state.' });
  }

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || id.startsWith('mock-');

  if (isMock) {
    const profile = MOCK_PROFILES.find(p => p.id === id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    profile.is_suspended = !!isSuspended;
    return res.status(200).json({ message: 'User suspension status updated successfully (Mock)', profile });
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('profiles')
      .update({ is_suspended: !!isSuspended })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Profile not found or access denied');
    
    return res.status(200).json({ message: 'User suspension status updated successfully', profile: data[0] });
  } catch (err) {
    logger.error('toggleUserSuspension Error: %O', err);
    return res.status(500).json({ error: 'Server error updating suspension status' });
  }
};

/**
 * Toggle verification status of an authority inspector (Admin Only)
 */
export const toggleAuthorityVerification = async (req, res) => {
  const { id } = req.params;
  const { isVerified } = req.body;

  if (isVerified === undefined) {
    return res.status(400).json({ error: 'Please specify isVerified state.' });
  }

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || id.startsWith('mock-');

  if (isMock) {
    const profile = MOCK_PROFILES.find(p => p.id === id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    profile.is_verified_authority = !!isVerified;
    return res.status(200).json({ message: 'Authority verification status updated successfully (Mock)', profile });
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('profiles')
      .update({ is_verified_authority: !!isVerified })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Profile not found or access denied');

    return res.status(200).json({ message: 'Authority verification status updated successfully', profile: data[0] });
  } catch (err) {
    logger.error('toggleAuthorityVerification Error: %O', err);
    return res.status(500).json({ error: 'Server error updating authority verification' });
  }
};

/**
 * Assign a department to an authority user (Admin Only)
 */
export const assignUserDepartment = async (req, res) => {
  const { id } = req.params;
  const { departmentId } = req.body;

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || id.startsWith('mock-');

  if (isMock) {
    const profile = MOCK_PROFILES.find(p => p.id === id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    profile.department_id = departmentId || null;
    return res.status(200).json({ message: 'Authority department assigned successfully (Mock)', profile });
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('profiles')
      .update({ department_id: departmentId || null })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Profile not found or access denied');

    return res.status(200).json({ message: 'Authority department assigned successfully', profile: data[0] });
  } catch (err) {
    logger.error('assignUserDepartment Error: %O', err);
    return res.status(500).json({ error: 'Server error assigning authority department' });
  }
};

/**
 * Public endpoint to trigger welcome email immediately after successful registration
 */
export const sendWelcomeEmailAfterSignup = async (req, res) => {
  const { email, userId, fullName } = req.body;

  if (!email || !userId) {
    logger.warn(`[Welcome Email Audit] Missing required parameters for welcome email request. Received Body: ${JSON.stringify(req.body)}`);
    return res.status(400).json({ error: 'Please provide email and userId' });
  }

  logger.info(`[Welcome Email Audit] Received public send-welcome request for User ID: ${userId}, Email: ${email}`);

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';
                               
  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  const result = await triggerWelcomeEmail(userId, email, fullName, isMock);

  if (result.success) {
    return res.status(200).json({ 
      message: result.alreadySent ? 'Welcome email already sent' : 'Welcome email delivered successfully', 
      welcome_email_sent: true 
    });
  } else {
    return res.status(500).json({ error: result.error || 'Failed to send welcome email' });
  }
};

/**
 * Send OTP Code for Login or Signup
 */
export const sendOtpCode = async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type || !['login', 'signup'].includes(type)) {
    return res.status(400).json({ error: 'Email address and valid verification type (login/signup) are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  // 1. Throttling check (30s)
  if (!otpService.canResendOTP(emailLower, type)) {
    return res.status(429).json({ error: 'Please wait 30 seconds before requesting another code.' });
  }

  // Check if Supabase mode or Mock mode is active
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';
  
  if (isSupabaseConfigured) {
    try {
      // Check user existence in Supabase auth
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        logger.error(`[authController] Failed to list users during OTP request: ${listError.message}`);
        return res.status(500).json({ error: 'Database verification failed' });
      }

      const existingUser = users.find(u => u.email && u.email.toLowerCase() === emailLower);

      if (type === 'login') {
        if (!existingUser) {
          return res.status(404).json({ error: 'Account not found. Please register first.' });
        }
        // Check if suspended
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('is_suspended')
          .eq('id', existingUser.id)
          .single();
        if (profile && profile.is_suspended) {
          return res.status(403).json({ error: 'This account has been suspended by administration.' });
        }
      } else if (type === 'signup') {
        if (existingUser) {
          return res.status(409).json({ error: 'Email address is already registered. Please sign in.' });
        }
      }
    } catch (dbErr) {
      logger.error(`[authController] Error validating user in DB: %O`, dbErr);
      return res.status(500).json({ error: 'Internal server error verifying account' });
    }
  } else {
    // Mock Mode validation
    const existingMockUser = MOCK_PROFILES.find(p => p.email.toLowerCase() === emailLower);
    if (type === 'login') {
      if (!existingMockUser) {
        return res.status(404).json({ error: 'Mock Account not found. Please register first.' });
      }
      if (existingMockUser.is_suspended) {
        return res.status(403).json({ error: 'This mock account has been suspended.' });
      }
    } else if (type === 'signup') {
      if (existingMockUser) {
        return res.status(409).json({ error: 'Mock email is already registered.' });
      }
    }
  }

  // 2. Generate and Send OTP
  const code = otpService.generateOTP(emailLower, type);
  
  let success = false;
  if (type === 'login') {
    success = await sendLoginOtpEmail(emailLower, code);
  } else {
    success = await sendVerificationOtpEmail(emailLower, code);
  }

  // Return success response (never expose code to the client)
  if (success) {
    return res.status(200).json({ message: 'Verification code sent successfully.', email: emailLower });
  } else {
    // If SMTP is not set up (development fallback), we can return the code in development ONLY if no Resend key is set
    const apiKey = process.env.RESEND_API_KEY;
    const isMockEmail = !apiKey || apiKey.includes('placeholder') || apiKey === '';
    
    if (isMockEmail) {
      logger.info(`[Dev OTP Helper] Verification code for ${emailLower} is: ${code}`);
      return res.status(200).json({ 
        message: 'Verification code simulated (logged to server console).', 
        email: emailLower,
        mockOtp: code // Exposed only when SMTP is disabled to allow testing without actual email
      });
    }
    return res.status(500).json({ error: 'Failed to send verification email. Please try again later.' });
  }
};

/**
 * Verify OTP Code
 */
export const verifyOtpCode = async (req, res) => {
  const { email, code, type } = req.body;
  if (!email || !code || !type || !['login', 'signup'].includes(type)) {
    return res.status(400).json({ error: 'Email, valid 6-digit code, and verification type are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  // Verify OTP
  const result = otpService.verifyOTP(emailLower, code, type);

  if (result.valid) {
    const isSupabaseConfigured = process.env.SUPABASE_URL && 
                                 !process.env.SUPABASE_URL.includes('placeholder') &&
                                 process.env.SUPABASE_URL !== '';

    if (type === 'login' && isSupabaseConfigured) {
      try {
        // Find user
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email && u.email.toLowerCase() === emailLower);
        
        if (!existingUser) {
          return res.status(404).json({ error: 'Account not found during login resolution.' });
        }

        // Generate magic link session tokens
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: emailLower
        });

        if (error || !data) {
          logger.error(`[authController] Failed to generate login tokens: ${error?.message}`);
          return res.status(500).json({ error: 'Failed to generate sign-in session' });
        }

        // Action link is verify URL like: http://.../verify?token=xyz&type=magiclink
        const actionLink = data.properties?.action_link;
        if (!actionLink) {
          return res.status(500).json({ error: 'Login session link was empty' });
        }

        // Exchange verify link for session tokens by requesting it programmatically on the backend
        const exchangeRes = await fetch(actionLink, { redirect: 'manual' });
        const redirectUrlStr = exchangeRes.headers.get('location');
        
        if (!redirectUrlStr) {
          logger.error(`[authController] Action link did not return redirect location. Status: ${exchangeRes.status}`);
          return res.status(500).json({ error: 'Login token exchange failed (no redirect)' });
        }

        const url = new URL(redirectUrlStr);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresAt = params.get('expires_in') ? Math.floor(Date.now() / 1000) + parseInt(params.get('expires_in'), 10) : null;

        if (!accessToken) {
          const errorMsg = params.get('error_description') || 'Login token exchange failed';
          logger.error(`[authController] Login token exchange failed: ${errorMsg}`);
          return res.status(500).json({ error: errorMsg });
        }

        return res.status(200).json({
          message: 'OTP verified successfully.',
          session: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            user: existingUser
          }
        });
      } catch (err) {
        logger.error(`[authController] Error resolving OTP login session: %O`, err);
        return res.status(500).json({ error: 'Internal server error resolving sign-in' });
      }
    } else if (type === 'login' && !isSupabaseConfigured) {
      // Mock Login Session
      const existingMockProfile = MOCK_PROFILES.find(p => p.email.toLowerCase() === emailLower);
      if (!existingMockProfile) {
        return res.status(404).json({ error: 'Mock account not found' });
      }
      return res.status(200).json({
        message: 'OTP verified successfully (mock session).',
        session: {
          access_token: `mock-jwt-token-${existingMockProfile.role}`,
          user: {
            id: existingMockProfile.id,
            email: existingMockProfile.email,
            user_metadata: { full_name: existingMockProfile.full_name },
            role: existingMockProfile.role
          }
        }
      });
    }

    // Signup type returns verified success, account creation occurs in registerVerifiedUser
    return res.status(200).json({ message: 'Verification successful.' });
  } else {
    return res.status(400).json({ error: result.error });
  }
};

/**
 * Create user account and sign in after email OTP verification succeeds
 */
export const registerVerifiedUser = async (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email address, and password are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  if (isSupabaseConfigured) {
    try {
      // Create user in Supabase auth using Admin API (bypasses double email verification)
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: password,
        email_confirm: true, // Mark email as verified immediately
        user_metadata: {
          full_name: fullName
        }
      });

      if (createError || !authData || !authData.user) {
        logger.error(`[authController] Failed to create user in Supabase auth: ${createError?.message}`);
        return res.status(400).json({ error: createError?.message || 'Registration failed.' });
      }

      const user = authData.user;
      logger.info(`[authController] Created user ${user.id} in Supabase auth.`);

      // Send welcome email asynchronously using the helper
      triggerWelcomeEmail(user.id, emailLower, fullName, false);

      // Generate magic link session tokens for immediate login
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: emailLower
      });

      if (linkError || !linkData) {
        logger.error(`[authController] Failed to generate login tokens after registration: ${linkError?.message}`);
        return res.status(201).json({
          message: 'Account created successfully. Please sign in manually.',
          user
        });
      }

      const actionLink = linkData.properties?.action_link;
      const url = new URL(actionLink);
      const hash = url.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresAt = params.get('expires_in') ? Math.floor(Date.now() / 1000) + parseInt(params.get('expires_in'), 10) : null;

      return res.status(201).json({
        message: 'Account created and verified successfully.',
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          user
        }
      });
    } catch (err) {
      logger.error(`[authController] Exception during verified registration: %O`, err);
      return res.status(500).json({ error: 'Internal server error completing registration' });
    }
  } else {
    // Mock Mode signup
    const mockUserId = 'mock-user-id-' + Date.now();
    const newMockProfile = {
      id: mockUserId,
      full_name: fullName,
      email: emailLower,
      avatar_url: '',
      role: 'citizen',
      points: 0,
      is_suspended: false,
      is_verified_authority: false,
      created_at: new Date().toISOString()
    };
    MOCK_PROFILES.push(newMockProfile);

    // Send simulated welcome email using the helper
    triggerWelcomeEmail(mockUserId, emailLower, fullName, true);

    return res.status(201).json({
      message: 'Mock account created and verified successfully.',
      session: {
        access_token: 'mock-jwt-token-citizen',
        user: {
          id: mockUserId,
          email: emailLower,
          user_metadata: { full_name: fullName },
          role: 'citizen'
        }
      }
    });
  }
};

/**
 * Request Password Reset token and send Recovery email
 */
export const requestPasswordRecovery = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const emailLower = email.toLowerCase().trim();

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  if (isSupabaseConfigured) {
    try {
      // Check if user exists
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.find(u => u.email && u.email.toLowerCase() === emailLower);

      if (!existingUser) {
        // Do not leak user existence information in recovery flow (standard security practice)
        return res.status(200).json({ message: 'If this email is registered, you will receive a secure reset link shortly.' });
      }

      // Generate recovery reset token
      const token = otpService.generateResetToken(emailLower);

      // Send email using Resend
      const success = await sendResetPasswordEmail(emailLower, token);

      if (success) {
        return res.status(200).json({ message: 'If this email is registered, you will receive a secure reset link shortly.' });
      } else {
        return res.status(500).json({ error: 'Failed to deliver password reset email. Please try again later.' });
      }
    } catch (err) {
      logger.error(`[authController] Exception in requestPasswordRecovery: %O`, err);
      return res.status(500).json({ error: 'Internal server error processing recovery request.' });
    }
  } else {
    // Mock Mode recovery
    const mockUser = MOCK_PROFILES.find(p => p.email.toLowerCase() === emailLower);
    if (!mockUser) {
      return res.status(200).json({ message: 'Mock recovery email process simulated.' });
    }
    const token = otpService.generateResetToken(emailLower);
    const appUrl = process.env.APP_URL || 'https://crowdcity-api.onrender.com';
    const mockResetLink = `${appUrl}/reset-password.html?token=${token}&email=${encodeURIComponent(emailLower)}`;
    logger.info(`[Dev Recovery Helper] Password reset link for ${emailLower} is: ${mockResetLink}`);
    return res.status(200).json({ 
      message: 'Mock recovery process simulated (logged to server console).',
      mockResetLink
    });
  }
};

/**
 * Handle custom secure Token-based Password Reset override
 */
export const resetPasswordOverride = async (req, res) => {
  const { token, email, newPassword } = req.body;

  if (!token || !email || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Token, email, and password (min 6 characters) are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  // Verify token
  const isValid = otpService.verifyResetToken(token, emailLower);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid or expired password reset link. Please request a new one.' });
  }

  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  if (isSupabaseConfigured) {
    try {
      // Find user in Supabase auth to get user ID
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.find(u => u.email && u.email.toLowerCase() === emailLower);

      if (!existingUser) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      // Update password using Supabase Admin API
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: newPassword
      });

      if (error) {
        logger.error(`[authController] Failed to update user password in Supabase: ${error.message}`);
        return res.status(400).json({ error: error.message });
      }

      // Invalidate recovery token
      otpService.invalidateResetToken(token);
      return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
      logger.error(`[authController] Exception in resetPasswordOverride: %O`, err);
      return res.status(500).json({ error: 'Internal server error resetting password.' });
    }
  } else {
    // Mock Mode password update
    const mockUser = MOCK_PROFILES.find(p => p.email.toLowerCase() === emailLower);
    if (!mockUser) {
      return res.status(404).json({ error: 'Mock account not found.' });
    }
    
    // Invalidate recovery token
    otpService.invalidateResetToken(token);
    logger.info(`[OTP Service] Mock password updated for ${emailLower}`);
    return res.status(200).json({ message: 'Password updated successfully (mock).' });
  }
};

