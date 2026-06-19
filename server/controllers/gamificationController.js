import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../config/logger.js';
import { MOCK_PROFILES } from './authController.js';
import { MOCK_ISSUES, MOCK_COMMENTS, MOCK_VOTES } from './issueController.js';
import { createNotification } from './notificationController.js';

// Predefined mock badges for local testing
export let MOCK_USER_BADGES = [];

// Badge Metadata definition
const BADGE_TEMPLATES = {
  first_report: {
    name: "First Sentinel",
    description: "Reported your first community complaint.",
    icon: "fa-solid fa-eye"
  },
  report_5: {
    name: "Civic Champion",
    description: "Reported 5 community complaints.",
    icon: "fa-solid fa-award"
  },
  comment_5: {
    name: "Voice of the City",
    description: "Contributed 5 discussion comments.",
    icon: "fa-regular fa-comments"
  },
  upvote_5: {
    name: "Vocal Citizen",
    description: "Upvoted 5 community complaints.",
    icon: "fa-solid fa-thumbs-up"
  },
  resolve_1: {
    name: "Urban Restorer",
    description: "Your reported complaint was successfully fixed.",
    icon: "fa-solid fa-screwdriver-wrench"
  }
};

/**
 * Helper to determine Rank Level name based on Points
 */
export const getLevelFromPoints = (points) => {
  if (points >= 300) return "City Legend";
  if (points >= 150) return "Civic Leader";
  if (points >= 50) return "Local Watchdog";
  return "Civic Novice";
};


/**
 * GET /api/gamification/badges
 * Fetch badges awarded to the logged-in user
 */
export const getUserBadges = async (req, res) => {
  const userId = req.user.id;
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  if (isMock) {
    const userBadges = MOCK_USER_BADGES.filter(b => b.user_id === userId);
    return res.status(200).json(userBadges);
  }

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    logger.error('getUserBadges Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching user badges' });
  }
};

/**
 * Central utility to award points, verify badge milestones, and dispatch achievements alerts.
 */
export const awardPointsAndCheckBadges = async (userId, pointsToAdd, actionType, req) => {
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  // Helper to trigger badge creation
  const unlockBadge = async (badgeType) => {
    const template = BADGE_TEMPLATES[badgeType];
    if (!template) return;

    if (isMock) {
      // Check if already has it in Mock list
      const alreadyHas = MOCK_USER_BADGES.some(b => b.user_id === userId && b.badge_type === badgeType);
      if (alreadyHas) return;

      const newBadge = {
        id: `mock-b-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        user_id: userId,
        badge_type: badgeType,
        badge_name: template.name,
        badge_description: template.description,
        badge_icon: template.icon,
        awarded_at: new Date().toISOString()
      };
      MOCK_USER_BADGES.unshift(newBadge);

      // Create realtime system notification for the user
      await createNotification(
        userId,
        "Achievement Unlocked! 🏆",
        `You unlocked the badge: "${template.name}" - ${template.description}`,
        "other",
        null
      );

      // Award +20 points achievement bonus!
      const profile = MOCK_PROFILES.find(p => p.id === userId);
      if (profile) {
        profile.points = (profile.points || 0) + 20;
      }
      return;
    }

    try {
      const activeClient = supabaseAdmin || supabase;
      // Production Badge unlock check
      const { data: existing } = await activeClient
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_type', badgeType)
        .maybeSingle();

      if (existing) return;

      // Insert new badge record
      const { error: insertError } = await activeClient
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_type: badgeType,
          badge_name: template.name,
          badge_description: template.description,
          badge_icon: template.icon
        });

      if (insertError) throw insertError;

      // Dispatch alert notification
      await createNotification(
        userId,
        "Achievement Unlocked! 🏆",
        `You unlocked the badge: "${template.name}" - ${template.description}`,
        "other",
        null
      );

      // Award +20 points achievement bonus
      await activeClient.rpc('increment_profile_points', { user_id: userId, amount: 20 });
    } catch (err) {
      logger.error(`Failed to award badge ${badgeType}: %O`, err);
    }
  };

  // 1. Update Profile Points
  if (isMock) {
    const profile = MOCK_PROFILES.find(p => p.id === userId);
    if (profile) {
      profile.points = Math.max(0, (profile.points || 0) + pointsToAdd);
    }
  } else {
    try {
      const activeClient = supabaseAdmin || supabase;
      // Call Supabase RPC increment or direct update (requires direct fetch first or stored procedure rpc)
      // Since profiles has points, let's fetch current points and update
      const { data: profiles } = await activeClient
        .from('profiles')
        .select('points')
        .eq('id', userId);
      
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;
      const currentPoints = profile ? (profile.points || 0) : 0;
      const newPoints = Math.max(0, currentPoints + pointsToAdd);
      
      await activeClient
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', userId);
    } catch (err) {
      logger.error('Failed to update points in production: %O', err);
    }
  }

  // 2. Query stats to check badges
  let reportsCount = 0;
  let resolvedCount = 0;
  let commentsCount = 0;
  let votesCount = 0;

  if (isMock) {
    reportsCount = MOCK_ISSUES.filter(i => i.reporter_id === userId).length;
    resolvedCount = MOCK_ISSUES.filter(i => i.reporter_id === userId && (i.status === 'resolved' || i.status === 'verified')).length;
    
    // Comments
    let cCount = 0;
    for (const key in MOCK_COMMENTS) {
      cCount += MOCK_COMMENTS[key].filter(c => c.user_id === userId).length;
    }
    commentsCount = cCount;

    // Votes
    votesCount = MOCK_VOTES.filter(v => v.user_id === userId).length;
  } else {
    try {
      const activeClient = supabaseAdmin || supabase;
      const [{ count: rCount }, { count: resCount }, { count: cCount }, { count: vCount }] = await Promise.all([
        activeClient.from('issues').select('id', { count: 'exact', head: true }).eq('reporter_id', userId),
        activeClient.from('issues').select('id', { count: 'exact', head: true }).eq('reporter_id', userId).in('status', ['resolved', 'verified']),
        activeClient.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        activeClient.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      ]);

      reportsCount = rCount || 0;
      resolvedCount = resCount || 0;
      commentsCount = cCount || 0;
      votesCount = vCount || 0;
    } catch (err) {
      logger.error('Failed to query engagement stats for badges: %O', err);
    }
  }

  // 3. Evaluate Badge Milestones
  if (reportsCount >= 1) {
    await unlockBadge('first_report');
  }
  if (reportsCount >= 5) {
    await unlockBadge('report_5');
  }
  if (resolvedCount >= 1) {
    await unlockBadge('resolve_1');
  }
  if (commentsCount >= 5) {
    await unlockBadge('comment_5');
  }
  if (votesCount >= 5) {
    await unlockBadge('upvote_5');
  }
};
