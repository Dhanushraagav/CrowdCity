import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import { createNotification } from './notificationController.js';
import { awardPointsAndCheckBadges } from './gamificationController.js';
import logger from '../config/logger.js';
import { whatsappService } from '../whatsapp/whatsappService.js';
import { analyzeComplaint } from '../services/groqService.js';
import { validateServiceArea } from '../services/serviceAreaService.js';
import { getUserEmail, sendIssueCreatedEmail, sendIssueStatusUpdateEmail, sendIssueWithdrawnEmail, sendNewChatMessageEmail } from '../services/emailService.js';

/**
 * Get all reported civic issues.
 */
export const getAllIssues = async (req, res) => {
  const { category, status, reporter_id, assigned_to, sort_by, limit } = req.query;

  logger.info(`[getAllIssues] Filters - Category: "${category}" | Status: "${status}" | Reporter: "${reporter_id}" | AssignedTo: "${assigned_to}"`);

  // Extract user ID from Authorization header if present
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    } catch (err) {}
  }

  try {
    const activeClient = getSupabaseClient(req);
    let query = activeClient
      .from('issues')
      .select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)');

    if (category) {
      if (category === 'roads') {
        query = query.in('category', ['roads', 'pothole']);
      } else if (category === 'streetlights') {
        query = query.in('category', ['streetlights', 'streetlight']);
      } else {
        query = query.eq('category', category);
      }
    }
    if (status) {
      if (status === 'resolved') {
        query = query.in('status', ['resolved', 'verified']);
      } else {
        query = query.eq('status', status);
      }
    }
    if (reporter_id) query = query.eq('reporter_id', reporter_id);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const orderByColumn = sort_by === 'popularity' ? 'upvotes_count' : 'created_at';
    let issuesQuery = query.order(orderByColumn, { ascending: false });

    if (limit) {
      issuesQuery = issuesQuery.limit(parseInt(limit, 10));
    }

    // Run issues query and user votes query concurrently
    const votesPromise = userId
      ? activeClient.from('votes').select('issue_id').eq('user_id', userId)
      : Promise.resolve({ data: null, error: null });

    const [issuesRes, votesRes] = await Promise.all([
      issuesQuery,
      votesPromise
    ]);

    if (issuesRes.error) {
      logger.error('Failed to fetch issues from Supabase: %O', issuesRes.error);
      return res.status(400).json({ error: `Database query failed: ${issuesRes.error.message}` });
    }

    const data = issuesRes.data;
    logger.info(`[getAllIssues SUPABASE] Query returned ${data ? data.length : 0} issues`);

    const userVotes = votesRes.data;
    const votesError = votesRes.error;

    // Populate user_has_upvoted
    if (userId && data && data.length > 0 && !votesError && userVotes) {
      const votedIssueIds = new Set(userVotes.map(v => v.issue_id));
      data.forEach(issue => {
        issue.user_has_upvoted = votedIssueIds.has(issue.id);
      });
    } else if (data) {
      data.forEach(issue => {
        issue.user_has_upvoted = false;
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    logger.error('getAllIssues Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching issues' });
  }
};

/**
 * Get issue details by ID.
 */
export const getIssueById = async (req, res) => {
  const { id } = req.params;

  // Extract user ID from Authorization header if present
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    } catch (err) {}
  }

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error: issueError } = await activeClient
      .from('issues')
      .select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)')
      .eq('id', id)
      .single();

    if (issueError) {
      logger.error('getIssueById DB Error: %O', issueError);
      return res.status(404).json({ error: `Issue not found: ${issueError.message}` });
    }

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const { data: comments, error: commentsError } = await activeClient
      .from('comments')
      .select('*, profiles:profiles(full_name, avatar_url)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    const { data: history, error: historyError } = await activeClient
      .from('status_history')
      .select('*, profiles:profiles(full_name, avatar_url)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    // Check if user has upvoted
    let userHasUpvoted = false;
    if (userId) {
      const { data: vote, error: voteError } = await activeClient
        .from('votes')
        .select('id')
        .eq('user_id', userId)
        .eq('issue_id', id)
        .maybeSingle();
      if (!voteError && vote) {
        userHasUpvoted = true;
      }
    }

    // Fetch evidence attachments
    const { data: attachments, error: attachError } = await activeClient
      .from('issue_attachments')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    return res.status(200).json({
      ...issue,
      comments: commentsError ? [] : comments,
      history: historyError ? [] : history,
      attachments: attachError ? [] : (attachments || []),
      user_has_upvoted: userHasUpvoted
    });
  } catch (err) {
    logger.error('getIssueById Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching issue details' });
  }
};

/**
 * Analyze issue details via Groq API.
 */
async function performGroqAnalysis(title, description) {
  try {
    return await analyzeComplaint(title, description);
  } catch (err) {
    logger.error('Groq analysis failed during issue creation: %O', err);
    return {
      summary: null,
      category: null,
      priority: null,
      department: null
    };
  }
}

/**
 * Get a default premium placeholder image URL based on category
 */
function getCategoryDefaultImage(category) {
  switch(category) {
    case 'roads': return 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80';
    case 'streetlights': return 'https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&w=600&q=80';
    case 'water_supply': return 'https://images.unsplash.com/photo-1508873696983-2df519f0397e?auto=format&fit=crop&w=600&q=80';
    case 'drainage': return 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&w=600&q=80';
    case 'garbage': return 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80';
    case 'traffic': return 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=600&q=80';
    case 'public_property': return 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80';
    case 'parks': return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=600&q=80';
    case 'sanitation': return 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80';
    case 'safety_hazard': return 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=600&q=80';
    case 'environment': return 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&w=600&q=80';
    default: return 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=600&q=80';
  }
}

/**
 * Report a new issue.
 */
export const createIssue = async (req, res) => {
  const { title, description, category, latitude, longitude, address, is_emergency } = req.body;
  const reporter_id = req.user.id;

  if (!title || title.trim().length < 5 || title.trim().length > 100) {
    return res.status(400).json({ error: 'Title is required and must be between 5 and 100 characters.' });
  }
  if (!description || description.trim().length < 10 || description.trim().length > 1000) {
    return res.status(400).json({ error: 'Description is required and must be between 10 and 1000 characters.' });
  }
  
  const validCategories = ['roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other'];
  if (!category || !validCategories.includes(category)) {
    return res.status(400).json({ error: 'Please specify a valid category.' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Please provide valid latitude and longitude coordinates.' });
  }

  // Verify that the coordinates fall within Tamil Nadu service area
  try {
    const isServiceAreaValid = await validateServiceArea(lat, lng);
    if (!isServiceAreaValid) {
      return res.status(400).json({ error: 'Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.' });
    }
  } catch (err) {
    logger.error('Service Area Validation error in createIssue: %O', err);
  }

  try {
    let imageUrl = '';
    const uploadedAttachments = [];

    if (req.files && req.files.length > 0) {
      const activeClient = supabaseAdmin || supabase;
      
      // 1. Process primary image (first uploaded file)
      const primaryFile = req.files[0];
      const fileExt = primaryFile.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { data: uploadData, error: uploadError } = await activeClient.storage
        .from('issue-images')
        .upload(filePath, primaryFile.buffer, {
          contentType: primaryFile.mimetype,
          upsert: true
        });

      if (!uploadError) {
        const { data: { publicUrl } } = activeClient.storage
          .from('issue-images')
          .getPublicUrl(filePath);
        imageUrl = publicUrl;
      } else {
        imageUrl = `data:${primaryFile.mimetype};base64,${primaryFile.buffer.toString('base64')}`;
      }

      // 2. Process remaining images as attachments
      const attachmentFiles = req.files.slice(1);
      for (const file of attachmentFiles) {
        const ext = file.originalname.split('.').pop();
        const fName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const fPath = `evidence/${fName}`;

        const { data: uploadAttachData, error: uploadAttachError } = await activeClient.storage
          .from('issue-images')
          .upload(fPath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (!uploadAttachError) {
          const { data: { publicUrl } } = activeClient.storage
            .from('issue-images')
            .getPublicUrl(fPath);
          uploadedAttachments.push({
            file_url: publicUrl,
            file_name: file.originalname,
            file_size: file.size
          });
        }
      }
    }

    // Perform AI analysis on submission
    const aiResult = await performGroqAnalysis(title, description);

    const newIssue = {
      reporter_id,
      title: title.trim(),
      description: description.trim(),
      category,
      latitude: lat,
      longitude: lng,
      address: address ? address.trim() : 'Location detected. Address unavailable.',
      image_url: imageUrl || getCategoryDefaultImage(category),
      status: 'pending',
      upvotes_count: 0,
      assigned_to: null,
      completion_proof_url: null,
      completion_notes: null,
      
      // Store AI results
      ai_summary: aiResult.summary,
      ai_category: aiResult.category,
      ai_department: aiResult.department,
      ai_priority: (is_emergency === 'true' || is_emergency === true) ? 'critical' : (aiResult.priority ? aiResult.priority.toLowerCase() : 'medium'),
      is_emergency: is_emergency === 'true' || is_emergency === true
    };

    // Production flow: insert to Supabase using request-scoped client
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .insert(newIssue)
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert issue into Supabase: %O', error);
      return res.status(400).json({
        error: `Supabase insert failed: ${error.message}`,
        details: error.details,
        hint: error.hint
      });
    }

    // Insert additional attachments if any were uploaded
    if (uploadedAttachments.length > 0) {
      const attachmentsToInsert = uploadedAttachments.map(att => ({
        issue_id: issue.id,
        uploaded_by: reporter_id,
        file_url: att.file_url,
        file_name: att.file_name,
        file_size: att.file_size
      }));

      const { error: attachInsertError } = await activeClient
        .from('issue_attachments')
        .insert(attachmentsToInsert);

      if (attachInsertError) {
        logger.error('Failed to insert additional issue attachments: %O', attachInsertError);
      }
    }

    // Insert timeline tracking entry using admin context to bypass citizen restrictions on status_history
    const activeAdmin = supabaseAdmin || supabase;
    const { error: historyError } = await activeAdmin
      .from('status_history')
      .insert({
        issue_id: issue.id,
        status: 'pending',
        notes: 'Complaint submitted by citizen.'
      });

    if (historyError) {
      logger.error('Failed to insert initial status history: %O', historyError);
      return res.status(400).json({
        error: `Status history registration failed: ${historyError.message}`,
        details: historyError.details
      });
    }

    awardPointsAndCheckBadges(req.user.id, 10, 'report', req).catch(err => logger.error('Background gamification error:', err));

    // Send confirmation email (background)
    getUserEmail(req.user.id).then(email => {
      if (email) sendIssueCreatedEmail(email, req.user.user_metadata?.full_name || 'Citizen', issue);
    }).catch(err => logger.error('Background email error:', err));

    // Send WhatsApp notification (background)
    whatsappService.sendNotification(req.user.id, 'complaint_created', {
      complaint_id: issue.id,
      category: issue.category
    }).catch(err => logger.error('Background WhatsApp notification error:', err));

    return res.status(201).json(issue);
  } catch (err) {
    logger.error('createIssue Error: %O', err);
    return res.status(500).json({ error: 'Server error reporting issue' });
  }
};

/**
 * Toggle upvote on an issue.
 */
export const upvoteIssue = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: existingVote, error: checkError } = await activeClient
      .from('votes')
      .select('id')
      .eq('user_id', user_id)
      .eq('issue_id', id)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingVote) {
      const { error: deleteError } = await activeClient
        .from('votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) throw deleteError;
      
      awardPointsAndCheckBadges(user_id, -2, 'upvote_retract', req).catch(err => logger.error('Background gamification error:', err));
      return res.status(200).json({ upvoted: false, message: 'Upvote removed' });
    } else {
      const { error: insertError } = await activeClient
        .from('votes')
        .insert({ user_id, issue_id: id });

      if (insertError) throw insertError;
      
      awardPointsAndCheckBadges(user_id, 2, 'upvote', req).catch(err => logger.error('Background gamification error:', err));
      return res.status(200).json({ upvoted: true, message: 'Upvote recorded' });
    }
  } catch (err) {
    logger.error('upvoteIssue Error: %O', err);
    return res.status(400).json({ error: `Upvote operation failed: ${err.message || err}` });
  }
};

/**
 * Add a comment to an issue.
 */
export const addComment = async (req, res) => {
  const { id } = req.params;
  const { comment_text } = req.body;
  const user_id = req.user.id;

  if (!comment_text) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const newComment = {
      issue_id: id,
      user_id,
      comment_text
    };

    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('comments')
      .insert(newComment)
      .select('*, profiles:profiles(full_name, avatar_url)')
      .single();

    if (error) throw error;

    awardPointsAndCheckBadges(user_id, 5, 'comment', req).catch(err => logger.error('Background gamification error:', err));
    return res.status(201).json(data);
  } catch (err) {
    logger.error('addComment Error: %O', err);
    return res.status(400).json({ error: `Comment insertion failed: ${err.message || err}` });
  }
};

/**
 * Update Issue Status, upload resolution proof, and log timeline notes (Authority & Admin Only)
 */
export const updateIssueStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'timeline_update'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Please provide a valid status.' });
  }

  try {
    const activeClient = getSupabaseClient(req);

    // Fetch original issue details to evaluate validation
    const { data: originalIssue, error: fetchError } = await activeClient
      .from('issues')
      .select('status, reporter_id, completion_proof_url, title')
      .eq('id', id)
      .single();

    if (fetchError || !originalIssue) {
      return res.status(404).json({ error: 'Issue not found in database' });
    }

    const targetStatus = status === 'timeline_update' ? originalIssue.status : status;

    // Enforce mandatory proof image file when status transitions to resolved
    if (targetStatus === 'resolved') {
      if (!req.file) {
        if (!originalIssue.completion_proof_url) {
          return res.status(400).json({ error: 'Resolution proof image is strictly required to resolve a complaint.' });
        }
      }
    }

    let proofUrl = '';

    // Handle resolution image upload if status is resolved and file exists
    if (targetStatus === 'resolved' && req.file) {
      const activeStorageClient = supabaseAdmin || activeClient;
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `resolved-${Date.now()}.${fileExt}`;
      const filePath = `resolved/${fileName}`;

      const { data: uploadData, error: uploadError } = await activeStorageClient.storage
        .from('issue-images')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) {
        logger.error('Failed to upload completion proof image: %O', uploadError);
        return res.status(500).json({ error: 'Failed to upload resolution proof image.' });
      }

      const { data: { publicUrl } } = activeStorageClient.storage
        .from('issue-images')
        .getPublicUrl(filePath);
      proofUrl = publicUrl;
    }

    const updates = { 
      status: targetStatus, 
      updated_at: new Date() 
    };

    if (targetStatus === 'resolved') {
      if (proofUrl) updates.completion_proof_url = proofUrl;
      updates.completion_notes = notes || 'Complaint resolved successfully.';
    }

    // 1. Update status
    const { data: issue, error: issueError } = await activeClient
      .from('issues')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (issueError) throw issueError;

    // 2. Insert timeline tracking entry using request-scoped client
    const { error: historyError } = await activeClient
      .from('status_history')
      .insert({
        issue_id: id,
        status: targetStatus,
        updated_by: req.user.id,
        notes: notes || (status === 'timeline_update' ? 'Caselog timeline update posted.' : `Status updated to ${status.toUpperCase()} by authority dispatch.`)
      });

    if (historyError) {
      logger.error('Failed to log status history update: %O', historyError);
    }

    // 3. Notify the citizen reporter
    const isTimelineUpdate = status === 'timeline_update';
    const notifTitle = isTimelineUpdate ? "Complaint Timeline Update" : "Complaint Status Update";
    const notifBody = isTimelineUpdate
      ? `A progress update has been added to your complaint '${issue.title}': "${notes || 'No notes provided'}"`
      : `Your reported complaint '${issue.title}' has been updated to ${status.toUpperCase()}.`;

    await createNotification(
      issue.reporter_id,
      notifTitle,
      notifBody,
      isTimelineUpdate ? "timeline_update" : "status_change",
      id
    );

    // Send status update email (background)
    getUserEmail(issue.reporter_id).then(email => {
      if (email) sendIssueStatusUpdateEmail(email, '', issue, status, notes);
    }).catch(err => logger.error('Background email error:', err));

    // Send WhatsApp notification (background)
    const eventName = targetStatus === 'resolved' ? 'complaint_resolved' : 'complaint_status_updated';
    whatsappService.sendNotification(issue.reporter_id, eventName, {
      complaint_id: issue.id,
      status: targetStatus,
      remarks: notes || updates.completion_notes
    }).catch(err => logger.error('Background WhatsApp notification error:', err));

    return res.status(200).json({ message: 'Status updated successfully', issue });
  } catch (err) {
    logger.error('updateIssueStatus Error: %O', err);
    return res.status(400).json({ error: `Failed to update status: ${err.message || err}` });
  }
};

/**
 * Assign Complaint to an Authority user (Self-Assignment)
 */
export const assignIssue = async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;
  let authorityId = assigned_to || req.user.id;

  // Enforce self-assignment for authority inspectors
  if (req.user && req.user.role === 'authority') {
    authorityId = req.user.id;
  }

  console.log("SELF ASSIGN STARTED");
  console.log("ISSUE ID: " + id);
  console.log("AUTHORITY ID: " + authorityId);

  try {
    const activeClient = getSupabaseClient(req);

    // Log parameters
    console.log(`[Assign] current user id: ${req.user.id}, authorityId: ${authorityId}, issue id: ${id}`);

    // Fetch inspector's profile to get name for timeline notes
    let inspectorName = 'Inspector';
    const { data: profiles, error: profileError } = await activeClient
      .from('profiles')
      .select('*')
      .eq('id', authorityId);
    
    console.log(`[Assign] profile query result:`, profiles, `error:`, profileError);

    if (profileError) {
      throw new Error(`Profile query failed: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log("UPDATE PAYLOAD: null");
      console.log("ROWS UPDATED: 0");
      console.log("Assignment failed reason: profile missing");
      return res.status(404).json({ error: `Authority profile not found for user ID: ${authorityId}` });
    }

    inspectorName = profiles[0].full_name;

    // Verify if the issue exists and check its record count
    const { data: checkIssue, error: checkError } = await activeClient
      .from('issues')
      .select('id, reporter_id, title')
      .eq('id', id);
    
    console.log(`[Assign] issue lookup result:`, checkIssue, `error:`, checkError);

    if (checkError) {
      throw new Error(`Issue lookup failed: ${checkError.message}`);
    }

    if (!checkIssue || checkIssue.length === 0) {
      console.log("UPDATE PAYLOAD: null");
      console.log("ROWS UPDATED: 0");
      console.log("Assignment failed reason: issue missing");
      return res.status(404).json({ error: `Issue not found in database for ID: ${id}` });
    }

    const updatePayload = { 
      assigned_to: authorityId, 
      status: 'assigned', 
      updated_at: new Date() 
    };
    console.log("UPDATE PAYLOAD: " + JSON.stringify(updatePayload));

    // 1. Update assignment
    const { data: updateData, error: updateError } = await activeClient
      .from('issues')
      .update(updatePayload)
      .eq('id', id)
      .select();

    console.log(`[Assign] assignment query result (raw update):`, updateData, `error:`, updateError);

    if (updateError) {
      throw updateError;
    }

    const rowsUpdated = updateData ? updateData.length : 0;
    console.log("ROWS UPDATED: " + rowsUpdated);

    if (!updateData || updateData.length === 0) {
      return res.status(400).json({ 
        error: `Assignment failed: Zero rows updated. Please verify that your inspector account is verified and RLS policies allow you to update issues.` 
      });
    }

    const issue = updateData[0];

    // 2. Insert assignment timeline log
    const { error: historyError } = await activeClient
      .from('status_history')
      .insert({
        issue_id: id,
        status: 'assigned',
        updated_by: req.user.id,
        notes: `Complaint assigned to inspector ${inspectorName}.`
      });

    if (historyError) {
      logger.error('Failed to log assignment status history: %O', historyError);
    }

    // 3. Notify the assigned authority/inspector
    await createNotification(
      authorityId,
      "New Case Assigned",
      `A new complaint '${issue.title}' has been assigned to you.`,
      "assignment",
      id
    );

    // 4. Notify the citizen reporter of the assignment
    await createNotification(
      issue.reporter_id,
      "Complaint Assigned",
      `Your complaint '${issue.title}' has been assigned to inspector ${inspectorName}.`,
      "status_change",
      id
    );

    return res.status(200).json({ message: 'Issue assigned successfully', issue });
  } catch (err) {
    logger.error('assignIssue Error: %O', err);
    return res.status(400).json({ error: `Assignment failed: ${err.message || err}` });
  }
};

/**
 * Verify issue resolution (Citizen Reporter Only)
 */
export const verifyIssue = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const isReporter = userId === issue.reporter_id || req.user.role === 'admin';
    if (!isReporter) {
      return res.status(403).json({ error: 'Only the original citizen reporter can approve and verify this complaint.' });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({ error: 'Complaint must be in RESOLVED status before it can be verified.' });
    }

    // Update status to verified
    const { data: updatedIssue, error: updateError } = await activeClient
      .from('issues')
      .update({ status: 'verified', updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const { error: historyError } = await activeClient
      .from('status_history')
      .insert({
        issue_id: id,
        status: 'verified',
        updated_by: userId,
        notes: 'Resolution approved and verified by citizen reporter.'
      });

    if (historyError) {
      logger.error('Failed to log verification status history: %O', historyError);
    }

    // Award gamification points on verification
    awardPointsAndCheckBadges(issue.reporter_id, 50, 'report_verified', req).catch(err => logger.error('Background gamification error:', err));
    if (issue.assigned_to) {
      awardPointsAndCheckBadges(issue.assigned_to, 20, 'resolve_complaint', req).catch(err => logger.error('Background gamification error:', err));
    }

    // Send notifications
    await createNotification(
      issue.reporter_id,
      "Complaint Resolution Approved",
      `You have successfully approved and verified the resolution of '${issue.title}'. +50 XP awarded!`,
      "status_change",
      id
    );

    if (issue.assigned_to) {
      await createNotification(
        issue.assigned_to,
        "Complaint Resolution Verified",
        `The citizen reporter has verified and approved your resolution for '${issue.title}'. +20 XP awarded!`,
        "status_change",
        id
      );
    }

    return res.status(200).json({ message: 'Complaint successfully verified', issue: updatedIssue });
  } catch (err) {
    logger.error('verifyIssue Error: %O', err);
    return res.status(400).json({ error: `Verification failed: ${err.message || err}` });
  }
};

/**
 * Reopen a resolved issue (Citizen Reporter Only)
 */
export const reopenIssue = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const isReporter = userId === issue.reporter_id || req.user.role === 'admin';
    if (!isReporter) {
      return res.status(403).json({ error: 'Only the original citizen reporter can reopen this complaint.' });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({ error: 'Only complaints in RESOLVED status can be reopened.' });
    }

    const notes = reason ? `Complaint reopened by citizen. Reason: ${reason}` : 'Complaint reopened by citizen for further inspection.';

    const { data: updatedIssue, error: updateError } = await activeClient
      .from('issues')
      .update({ status: 'in_progress', updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const { error: historyError } = await activeClient
      .from('status_history')
      .insert({
        issue_id: id,
        status: 'in_progress',
        updated_by: userId,
        notes: notes
      });

    if (historyError) {
      logger.error('Failed to log reopening status history: %O', historyError);
    }

    await createNotification(
      issue.reporter_id,
      "Complaint Reopened",
      `You have reopened the complaint '${issue.title}' for further work.`,
      "status_change",
      id
    );

    if (issue.assigned_to) {
      await createNotification(
        issue.assigned_to,
        "Complaint Reopened by Citizen",
        `Your resolved complaint '${issue.title}' has been reopened by the citizen reporter. Reason: ${reason || 'Not specified'}.`,
        "status_change",
        id
      );
    }

    return res.status(200).json({ message: 'Complaint successfully reopened', issue: updatedIssue });
  } catch (err) {
    logger.error('reopenIssue Error: %O', err);
    return res.status(400).json({ error: `Reopening failed: ${err.message || err}` });
  }
};

/**
 * Get statistics for the logged-in Authority User
 */
export const getAuthorityStats = async (req, res) => {
  const authorityId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);

    // 1. Pending: count of all pending cases
    const { count: pendingCount, error: pendingError } = await activeClient
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingError) {
      logger.error('Failed to fetch pending stats from Supabase: %O', pendingError);
      return res.status(400).json({ error: `Supabase query failed: ${pendingError.message}` });
    }

    // 2. Assigned: count of cases assigned to this user with status 'assigned'
    const { count: assignedCount, error: assignedError } = await activeClient
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', authorityId)
      .eq('status', 'assigned');

    if (assignedError) {
      logger.error('Failed to fetch assigned stats from Supabase: %O', assignedError);
      return res.status(400).json({ error: `Supabase query failed: ${assignedError.message}` });
    }

    // 3. In Progress: count of cases assigned to this user with status 'in_progress'
    const { count: inProgressCount, error: inProgressError } = await activeClient
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', authorityId)
      .eq('status', 'in_progress');

    if (inProgressError) {
      logger.error('Failed to fetch in_progress stats from Supabase: %O', inProgressError);
      return res.status(400).json({ error: `Supabase query failed: ${inProgressError.message}` });
    }

    // 4. Resolved Today: get all resolved/verified cases for this user to check timestamps
    const { data: resolvedCases, error: resolvedError } = await activeClient
      .from('issues')
      .select('updated_at')
      .eq('assigned_to', authorityId)
      .in('status', ['resolved', 'verified']);

    if (resolvedError) {
      logger.error('Failed to fetch resolved cases from Supabase: %O', resolvedError);
      return res.status(400).json({ error: `Supabase query failed: ${resolvedError.message}` });
    }

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const resolvedTodayCount = (resolvedCases || []).filter(c => new Date(c.updated_at) >= todayStart).length;

    return res.status(200).json({
      pending: pendingCount || 0,
      assigned: assignedCount || 0,
      inProgress: inProgressCount || 0,
      resolvedToday: resolvedTodayCount
    });
  } catch (err) {
    logger.error('getAuthorityStats Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching authority stats' });
  }
};

/**
 * Delete Issue (Admin Only)
 */
export const deleteIssue = async (req, res) => {
  const { id } = req.params;

  try {
    const activeClient = getSupabaseClient(req);
    const { error } = await activeClient
      .from('issues')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ message: 'Issue deleted successfully' });
  } catch (err) {
    logger.error('deleteIssue Error: %O', err);
    return res.status(400).json({ error: `Deletion failed: ${err.message || err}` });
  }
};

/**
 * Get system analytics (Admin Only)
 */
export const getAdminAnalytics = async (req, res) => {
  try {
    const activeClient = getSupabaseClient(req);
    
    // Fetch issues
    const { data: dbIssues, error: issuesError } = await activeClient
      .from('issues')
      .select('status, category, assigned_to');
    
    if (issuesError) throw issuesError;
    const issues = dbIssues || [];

    // Fetch profiles that are authorities or admins
    const { data: dbProfiles, error: profilesError } = await activeClient
      .from('profiles')
      .select('id, full_name')
      .in('role', ['authority', 'admin']);

    if (profilesError) throw profilesError;
    const profiles = dbProfiles || [];

    // 1. Group by category
    const categories = ['roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other'];
    const categoryCounts = {};
    categories.forEach(c => categoryCounts[c] = 0);
    issues.forEach(issue => {
      const cat = issue.category;
      if (categories.includes(cat)) {
        categoryCounts[cat]++;
      } else {
        categoryCounts['other'] = (categoryCounts['other'] || 0) + 1;
      }
    });

    // 2. Group by status
    const statuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
    const statusCounts = {};
    statuses.forEach(s => statusCounts[s] = 0);
    issues.forEach(issue => {
      const stat = issue.status;
      if (statuses.includes(stat)) {
        statusCounts[stat]++;
      }
    });

    // 3. Authority Resolution Performance
    const performance = {};
    profiles.forEach(p => {
      performance[p.full_name] = 0;
    });

    issues.forEach(issue => {
      if (issue.status === 'resolved' && issue.assigned_to) {
        const profile = profiles.find(p => p.id === issue.assigned_to);
        if (profile) {
          performance[profile.full_name] = (performance[profile.full_name] || 0) + 1;
        } else {
          performance['Other Inspector'] = (performance['Other Inspector'] || 0) + 1;
        }
      }
    });

    const performanceData = Object.keys(performance).map(name => ({
      name,
      resolvedCount: performance[name]
    }));

    return res.status(200).json({
      byCategory: categoryCounts,
      byStatus: statusCounts,
      performance: performanceData,
      totalComplaints: issues.length
    });

  } catch (err) {
    logger.error('getAdminAnalytics Error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving analytics data' });
  }
};

/**
 * Get advanced system analytics for dashboard visualization (accessible to all authenticated users)
 */
export const getAdvancedAnalytics = async (req, res) => {
  try {
    const activeClient = getSupabaseClient(req);
    const { data: dbIssues, error: issuesError } = await activeClient
      .from('issues')
      .select('id, title, category, status, latitude, longitude, address, upvotes_count, created_at, updated_at, ai_department');
    
    if (issuesError) throw issuesError;
    const issues = dbIssues || [];

    // 1. Group by category
    const categories = ['roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other'];
    const categoryCounts = {};
    categories.forEach(c => categoryCounts[c] = 0);
    
    // 2. Group by status
    const statuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
    const statusCounts = {};
    statuses.forEach(s => statusCounts[s] = 0);

    // 3. Location points for heatmap
    const heatmapPoints = [];

    // 4. Area distribution count
    const areaCounts = {};

    // 5. Monthly Trends
    const monthlyCounts = {};

    // 6. Department Performance
    const deptStats = {};

    // 7. Time range grouping for Growth Trends
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    let thisMonthCount = 0;
    let lastMonthCount = 0;

    const categoryThisMonth = {};
    const categoryLastMonth = {};
    categories.forEach(c => {
      categoryThisMonth[c] = 0;
      categoryLastMonth[c] = 0;
    });

    let totalResolutionTimeMs = 0;
    let resolvedCount = 0;

    issues.forEach(issue => {
      const cat = issue.category;
      if (categories.includes(cat)) {
        categoryCounts[cat]++;
      } else {
        categoryCounts['other'] = (categoryCounts['other'] || 0) + 1;
      }

      const stat = issue.status;
      if (statuses.includes(stat)) {
        statusCounts[stat]++;
      }

      if (typeof issue.latitude === 'number' && typeof issue.longitude === 'number') {
        const weight = (issue.upvotes_count || 0) + 1;
        heatmapPoints.push({
          id: issue.id,
          title: issue.title,
          category: issue.category,
          status: issue.status,
          lat: issue.latitude,
          lng: issue.longitude,
          created_at: issue.created_at,
          weight
        });
      }

      if (issue.address) {
        const parts = issue.address.split(',');
        const street = parts[0].trim();
        const area = street.replace(/^\d+\s+/, '').trim() || 'Unknown';
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      } else {
        areaCounts['Unknown'] = (areaCounts['Unknown'] || 0) + 1;
      }

      if (issue.created_at) {
        const date = new Date(issue.created_at);
        if (!isNaN(date)) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const key = `${year}-${month}`;
          monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;

          // Categorize for Growth
          if (date >= thirtyDaysAgo) {
            thisMonthCount++;
            const c = issue.category || 'other';
            if (categoryThisMonth[c] !== undefined) categoryThisMonth[c]++;
            else categoryThisMonth['other']++;
          } else if (date >= sixtyDaysAgo && date < thirtyDaysAgo) {
            lastMonthCount++;
            const c = issue.category || 'other';
            if (categoryLastMonth[c] !== undefined) categoryLastMonth[c]++;
            else categoryLastMonth['other']++;
          }
        }
      }

      const dept = issue.ai_department || 'Unassigned';
      if (!deptStats[dept]) {
        deptStats[dept] = { total: 0, resolved: 0, totalResolutionHours: 0 };
      }
      deptStats[dept].total++;

      if (issue.status === 'resolved') {
        deptStats[dept].resolved++;
        resolvedCount++;

        if (issue.created_at && issue.updated_at) {
          const start = new Date(issue.created_at);
          const end = new Date(issue.updated_at);
          if (!isNaN(start) && !isNaN(end)) {
            const diffMs = end - start;
            if (diffMs > 0) {
              const diffHours = diffMs / (3600 * 1000);
              deptStats[dept].totalResolutionHours += diffHours;
              totalResolutionTimeMs += diffMs;
            }
          }
        }
      }
    });

    // Compute Category Growth Trends
    const categoryGrowth = {};
    categories.forEach(c => {
      const curr = categoryThisMonth[c];
      const prev = categoryLastMonth[c];
      let growth = 0;
      if (prev > 0) {
        growth = Math.round(((curr - prev) / prev) * 100);
      } else if (curr > 0) {
        growth = 100;
      }
      categoryGrowth[c] = growth;
    });

    const overallGrowth = lastMonthCount > 0 
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : 0;

    // Format Area Distribution as array of { area, count } sorted descending
    const areaDistribution = Object.keys(areaCounts).map(area => ({
      area,
      count: areaCounts[area]
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Format Monthly Trends as array of { month, count } sorted chronologically
    const monthlyTrends = Object.keys(monthlyCounts).map(month => ({
      month,
      count: monthlyCounts[month]
    })).sort((a, b) => a.month.localeCompare(b.month));

    // Format Department Performance with score and grade
    const departmentPerformance = Object.keys(deptStats).map(dept => {
      const stats = deptStats[dept];
      const avgResolutionHours = stats.resolved > 0 
        ? Math.round((stats.totalResolutionHours / stats.resolved) * 10) / 10 
        : 0;

      // Score = (Resolution Rate * 70) + (Speed Factor * 30)
      const resolutionRate = stats.total > 0 ? (stats.resolved / stats.total) : 0;
      let speedFactor = 40; 
      if (avgResolutionHours > 0) {
        if (avgResolutionHours <= 24) speedFactor = 100;
        else if (avgResolutionHours <= 72) speedFactor = 85;
        else if (avgResolutionHours <= 168) speedFactor = 60;
      } else if (stats.total > 0 && stats.resolved === 0) {
        speedFactor = 0;
      } else {
        speedFactor = 100; 
      }

      const score = stats.total > 0
        ? Math.round((resolutionRate * 70) + (speedFactor * 0.3))
        : 100;

      let grade = 'A+';
      if (score >= 95) grade = 'A+';
      else if (score >= 90) grade = 'A';
      else if (score >= 80) grade = 'B';
      else if (score >= 70) grade = 'C';
      else if (score >= 50) grade = 'D';
      else grade = 'F';

      return {
        department: dept,
        totalCount: stats.total,
        resolvedCount: stats.resolved,
        avgResolutionHours,
        performanceScore: score,
        grade
      };
    });

    const averageResolutionTimeHours = resolvedCount > 0 
      ? Math.round((totalResolutionTimeMs / (resolvedCount * 3600000)) * 10) / 10 
      : 0;

    // AI Insight generation (Groq with rule-based fallback)
    let aiInsights = [];
    const groqApiKey = process.env.GROQ_API_KEY;
    const isGroqConfigured = groqApiKey && 
                             !groqApiKey.includes('your-groq-api-key') && 
                             groqApiKey !== '';

    if (isGroqConfigured) {
      try {
        const statsPrompt = `
        Total complaints: ${issues.length}
        Resolved complaints: ${resolvedCount}
        Category breakdown: ${JSON.stringify(categoryCounts)}
        Category monthly growth: ${JSON.stringify(categoryGrowth)}
        Department statistics: ${JSON.stringify(departmentPerformance)}
        Top neighborhoods: ${JSON.stringify(areaDistribution)}
        `;

        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
              {
                role: 'system',
                content: 'You are an expert urban planner and municipal data analyst. Analyze the provided municipal issues statistics of CrowdCity AI and generate exactly 3-4 professional, actionable, data-driven "Smart City Insights". Do not use placeholders. Each insight must be a single, impactful sentence. Highlight category growth, neighborhood hotspots, and department repair efficiencies. Output ONLY a valid JSON array of strings, e.g. ["insight 1", "insight 2", "insight 3"].'
              },
              {
                role: 'user',
                content: statsPrompt
              }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (aiRes.ok) {
          const result = await aiRes.json();
          const content = result.choices[0].message.content;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            aiInsights = parsed;
          } else if (parsed.insights && Array.isArray(parsed.insights)) {
            aiInsights = parsed.insights;
          }
        }
      } catch (err) {
        logger.error('Groq AI Insights generation failed: %O', err);
      }
    }

    if (!aiInsights || aiInsights.length === 0) {
      aiInsights = generateLocalInsights(categoryGrowth, areaDistribution, departmentPerformance, thisMonthCount);
    }

    return res.status(200).json({
      byCategory: categoryCounts,
      byStatus: statusCounts,
      heatmapPoints,
      areaDistribution,
      monthlyTrends,
      departmentPerformance,
      averageResolutionTimeHours,
      totalComplaints: issues.length,
      resolvedCount,
      aiInsights
    });

  } catch (err) {
    logger.error('getAdvancedAnalytics Error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving advanced analytics data' });
  }
};

// Local insight generator helper
function generateLocalInsights(categoryGrowth, areaDistribution, departmentPerformance, thisMonthCount) {
  const insights = [];
  const catNames = {
    roads: 'Roads',
    streetlights: 'Streetlights',
    water_supply: 'Water Supply',
    drainage: 'Drainage',
    garbage: 'Garbage',
    traffic: 'Traffic',
    public_property: 'Public Property',
    parks: 'Parks',
    sanitation: 'Sanitation',
    safety_hazard: 'Safety Hazard',
    environment: 'Environment',
    other: 'Other'
  };

  // 1. Growth Insights
  let maxGrowthCat = 'other';
  let maxGrowthVal = -100;
  Object.entries(categoryGrowth).forEach(([cat, val]) => {
    if (val > maxGrowthVal && cat !== 'other') {
      maxGrowthVal = val;
      maxGrowthCat = cat;
    }
  });

  if (maxGrowthVal > 0) {
    insights.push(`${catNames[maxGrowthCat]} complaints increased by ${maxGrowthVal}% this month compared to the last period.`);
  } else {
    insights.push(`Overall civic complaints remained stable, with a total of ${thisMonthCount} new issues reported this month.`);
  }

  // 2. Hotspots
  const topArea = areaDistribution && areaDistribution[0] ? areaDistribution[0].area : null;
  if (topArea && topArea !== 'Unknown') {
    insights.push(`Neighborhood analysis shows ${topArea} currently has the highest volume of reported complaints.`);
  } else {
    insights.push(`Central zones exhibit the highest density of unresolved citizens' reports this period.`);
  }

  // 3. Department Efficiency
  let slowestDept = null;
  let slowestTime = 0;
  let fastestDept = null;
  let fastestScore = 0;

  departmentPerformance.forEach(d => {
    if (d.avgResolutionHours > slowestTime) {
      slowestTime = d.avgResolutionHours;
      slowestDept = d.department;
    }
    if (d.performanceScore > fastestScore) {
      fastestScore = d.performanceScore;
      fastestDept = d.department;
    }
  });

  if (slowestDept && slowestTime > 48) {
    insights.push(`The ${slowestDept} average repair speed is currently ${Math.round(slowestTime / 24 * 10) / 10} days, representing the city's largest backlog.`);
  } else if (fastestDept && fastestScore >= 80) {
    insights.push(`The ${fastestDept} leads municipal operations with a high performance rating of ${fastestScore}%.`);
  } else {
    insights.push("Municipal departments are currently maintaining an average response time of under 3 days.");
  }

  // 4. Actionable suggestion
  insights.push("Proactive allocation of sanitizing and electrical crew assets is advised for the upcoming high-density weeks.");

  return insights;
}

/**
 * Edit a comment (Only own comments)
 */
export const editComment = async (req, res) => {
  const { commentId } = req.params;
  const { comment_text } = req.body;
  const userId = req.user.id;

  if (!comment_text) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const activeClient = getSupabaseClient(req);
    const { data: existingComment, error: fetchError } = await activeClient
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own comments' });
    }

    const { data, error } = await activeClient
      .from('comments')
      .update({ comment_text })
      .eq('id', commentId)
      .select('*, profiles:profiles(full_name, avatar_url)')
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    logger.error('editComment Error: %O', err);
    return res.status(400).json({ error: `Comment update failed: ${err.message || err}` });
  }
};

/**
 * Delete a comment (Only own comments or admins)
 */
export const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: existingComment, error: fetchError } = await activeClient
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isAdmin = req.user.role === 'admin';
    if (existingComment.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own comments' });
    }

    const { error } = await activeClient
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    awardPointsAndCheckBadges(existingComment.user_id, -5, 'comment_delete', req).catch(err => logger.error('Background gamification error:', err));
    return res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    logger.error('deleteComment Error: %O', err);
    return res.status(400).json({ error: `Comment deletion failed: ${err.message || err}` });
  }
};

/**
 * GET /api/issues/admin/ai-decisions
 * Get all reported issues with AI analytics (Admin Only)
 */
export const getAiDecisions = async (req, res) => {
  try {
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('issues')
      .select('id, title, category, status, created_at, ai_summary, ai_category, ai_department, ai_priority')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    logger.error('getAiDecisions Error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving AI decisions data' });
  }
};

/**
 * POST /api/issues/admin/ai-decisions/:id/override
 * Override AI prediction for category, department, or priority (Admin Only)
 */
export const overrideAiDecision = async (req, res) => {
  const { id } = req.params;
  const { category, department, priority } = req.body;

  try {
    const notes = `AI prediction overridden by administrator. Category: ${category || 'N/A'}, Department: ${department || 'N/A'}, Priority: ${priority || 'N/A'}`;

    const updates = {};
    if (category) updates.category = category;
    if (department) updates.ai_department = department;
    if (priority) updates.ai_priority = priority;
    updates.updated_at = new Date();

    const activeClient = supabaseAdmin || supabase;
    const { data: issue, error } = await activeClient
      .from('issues')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await activeClient
      .from('status_history')
      .insert({
        issue_id: id,
        status: issue.status,
        updated_by: req.user.id,
        notes: notes
      });

    return res.status(200).json({ message: 'AI decisions overridden successfully', issue });
  } catch (err) {
    logger.error('overrideAiDecision Error: %O', err);
    return res.status(500).json({ error: 'Server error overriding AI decision' });
  }
};

/**
 * GET /api/issues/admin/reports/export
 * Export system report: daily, weekly, monthly. Format: csv, pdf. (Admin Only)
 */
export const exportReport = async (req, res) => {
  const { range, format } = req.query;

  if (!range || !format) {
    return res.status(400).send('Please provide range (daily, weekly, monthly) and format (csv, pdf).');
  }

  // Calculate timeframe filter
  let days = 1;
  if (range === 'weekly') days = 7;
  else if (range === 'monthly') days = 30;

  const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    let issues = [];
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('issues')
      .select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)')
      .gte('created_at', thresholdDate.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    issues = data || [];

    if (format === 'csv') {
      // Generate Excel compatible CSV file
      let csvContent = 'Issue ID,Title,Reporter,Category,Department,Priority,Status,Created At,Latitude,Longitude,Address,Upvotes\n';
      issues.forEach(i => {
        const id = i.id;
        const title = `"${(i.title || '').replace(/"/g, '""')}"`;
        const reporter = `"${(i.reporter?.full_name || 'Anonymous').replace(/"/g, '""')}"`;
        const category = i.category || 'other';
        const department = `"${(i.ai_department || 'Unassigned').replace(/"/g, '""')}"`;
        const priority = i.ai_priority || 'low';
        const status = i.status || 'pending';
        const created = i.created_at;
        const lat = i.latitude || 0;
        const lng = i.longitude || 0;
        const addr = `"${(i.address || '').replace(/"/g, '""')}"`;
        const upvotes = i.upvotes_count || 0;

        csvContent += `${id},${title},${reporter},${category},${department},${priority},${status},${created},${lat},${lng},${addr},${upvotes}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=crowdcity-report-${range}-${Date.now()}.csv`);
      return res.status(200).send(csvContent);
    } 
    
    if (format === 'pdf') {
      const totalCount = issues.length;
      const resolvedCount = issues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
      const inProgressCount = issues.filter(i => i.status === 'in_progress').length;
      const pendingCount = issues.filter(i => i.status === 'pending').length;
      const rejectedCount = issues.filter(i => i.status === 'rejected').length;

      // Group by categories
      const categories = {};
      issues.forEach(i => { categories[i.category] = (categories[i.category] || 0) + 1; });

      // Group by departments
      const departments = {};
      issues.forEach(i => { 
        const d = i.ai_department || 'Unassigned';
        departments[d] = (departments[d] || 0) + 1; 
      });

      const categoriesHtml = Object.entries(categories)
        .map(([k, v]) => `<li><strong>${k.toUpperCase()}:</strong> ${v} complaints (${((v/totalCount)*100 || 0).toFixed(1)}%)</li>`)
        .join('');

      const deptsHtml = Object.entries(departments)
        .map(([k, v]) => `<tr><td style="padding:8px; border-bottom:1px solid #ddd;">${k}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;"><strong>${v}</strong></td></tr>`)
        .join('');

      const issuesListHtml = issues.map(i => `
        <tr style="font-size:11px;">
          <td style="padding:6px; border-bottom:1px solid #eee;">${i.title}</td>
          <td style="padding:6px; border-bottom:1px solid #eee; text-transform:capitalize;">${i.category}</td>
          <td style="padding:6px; border-bottom:1px solid #eee;">${i.ai_department || 'Road Department'}</td>
          <td style="padding:6px; border-bottom:1px solid #eee; text-transform:uppercase;">${i.ai_priority || 'low'}</td>
          <td style="padding:6px; border-bottom:1px solid #eee; text-transform:uppercase; font-weight:bold; color:${i.status === 'resolved' || i.status==='verified'?'#10b981':(i.status==='in_progress'?'#8b5cf6':'#f59e0b')}">${i.status}</td>
          <td style="padding:6px; border-bottom:1px solid #eee;">${new Date(i.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CrowdCity AI Municipal Report - ${range.toUpperCase()}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; padding: 40px; }
            .header { border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: bold; color: #10b981; }
            .title { font-size: 20px; font-weight: bold; margin: 0; }
            .date { font-size: 12px; color: #666; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background-color: #f8fafc; }
            .card h3 { margin-top: 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; color: #10b981; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
            .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
            .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; }
            .kpi-value { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 4px; }
            .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 8px; background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; color: #475569; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background-color:#10b981; color:white; border:none; padding:10px 20px; border-radius:4px; font-size:14px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>
          </div>

          <div class="header">
            <div>
              <div class="logo">CrowdCity AI</div>
              <div class="date">Civic Engagement & Operations Report</div>
            </div>
            <div style="text-align: right;">
              <h2 class="title">${range.toUpperCase()} PERFORMANCE REPORT</h2>
              <div class="date">Generated on ${new Date().toLocaleString()} (Timeframe: past ${days} days)</div>
            </div>
          </div>

          <div class="kpi-container">
            <div class="kpi" style="border-top: 4px solid #64748b;">
              <div class="kpi-value">${totalCount}</div>
              <div class="kpi-label">Total Reports</div>
            </div>
            <div class="kpi" style="border-top: 4px solid #f59e0b;">
              <div class="kpi-value">${pendingCount}</div>
              <div class="kpi-label">Pending / Assigned</div>
            </div>
            <div class="kpi" style="border-top: 4px solid #8b5cf6;">
              <div class="kpi-value">${inProgressCount}</div>
              <div class="kpi-label">In Progress</div>
            </div>
            <div class="kpi" style="border-top: 4px solid #10b981;">
              <div class="kpi-value">${resolvedCount}</div>
              <div class="kpi-label">Resolved / Verified</div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <h3>Category Breakdown</h3>
              <ul style="padding-left:20px; font-size:13px; margin:0; line-height:2.0;">
                ${categoriesHtml || '<li>No complaints reported in this period.</li>'}
              </ul>
            </div>
            <div class="card">
              <h3>Department Caseload</h3>
              <table style="font-size:13px; margin:0;">
                <thead>
                  <tr>
                    <th style="padding:6px; background:none; border-bottom:1px solid #ddd;">Department</th>
                    <th style="padding:6px; text-align:right; background:none; border-bottom:1px solid #ddd;">Active Issues</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptsHtml || '<tr><td colspan="2" style="padding:8px; text-align:center;">No departments assigned.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div style="margin-top: 40px;">
            <h3 style="font-size:13px; text-transform:uppercase; border-bottom:2px solid #cbd5e1; padding-bottom:6px; margin-bottom:15px; color:#1e293b;">Detailed Reports Listing</h3>
            <table>
              <thead>
                <tr>
                  <th>Complaint Title</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                ${issuesListHtml || '<tr><td colspan="6" style="padding:15px; text-align:center; color:#666;">No complaints reported in this timeframe.</td></tr>'}
              </tbody>
            </table>
          </div>

          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => { window.print(); }, 800);
            });
          </script>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(htmlContent);
    }

    return res.status(400).send('Invalid export format specified. Support: csv, pdf.');
  } catch (err) {
    logger.error('exportReport Error: %O', err);
    return res.status(500).send('Server error generating report export file.');
  }
};

/**
 * Withdraw an issue (Citizen Reporter Only)
 */
export const withdrawIssue = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (userId !== issue.reporter_id) {
      return res.status(403).json({ error: 'Only the original citizen reporter can withdraw this complaint.' });
    }

    const allowedStatuses = ['pending', 'assigned', 'in_progress'];
    if (!allowedStatuses.includes(issue.status)) {
      return res.status(400).json({ error: `Complaint cannot be withdrawn when status is ${issue.status.toUpperCase()}.` });
    }

    // Update status to withdrawn
    const { data: updatedIssue, error: updateError } = await activeClient
      .from('issues')
      .update({ status: 'withdrawn', updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Insert status_history entry using admin to bypass citizen restrictions
    const activeAdmin = supabaseAdmin || supabase;
    const { error: historyError } = await activeAdmin
      .from('status_history')
      .insert({
        issue_id: id,
        status: 'withdrawn',
        updated_by: userId,
        notes: 'Complaint withdrawn by citizen reporter.'
      });

    if (historyError) {
      logger.error('Failed to log withdrawal status history: %O', historyError);
    }

    // Notify the reporter
    await createNotification(
      issue.reporter_id,
      "Complaint Withdrawn",
      `You have withdrawn the complaint '${issue.title}'.`,
      "status_change",
      id
    );

    // Notify the assigned authority if any
    if (issue.assigned_to) {
      await createNotification(
        issue.assigned_to,
        "Complaint Withdrawn by Citizen",
        `The complaint '${issue.title}' has been withdrawn by the citizen reporter.`,
        "status_change",
        id
      );
    }

    // Send withdrawal email (background)
    getUserEmail(req.user.id).then(email => {
      if (email) sendIssueWithdrawnEmail(email, req.user.user_metadata?.full_name || 'Citizen', issue);
    }).catch(err => logger.error('Background email error:', err));

    return res.status(200).json({ message: 'Complaint withdrawn successfully', issue: updatedIssue });
  } catch (err) {
    logger.error('withdrawIssue Error: %O', err);
    return res.status(400).json({ error: `Withdrawal failed: ${err.message || err}` });
  }
};

/**
 * Upload additional evidence for an issue (Citizen Reporter Only)
 */
export const uploadEvidence = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (userId !== issue.reporter_id) {
      return res.status(403).json({ error: 'Only the original citizen reporter can upload evidence for this complaint.' });
    }

    const disallowedStatuses = ['resolved', 'verified', 'withdrawn', 'rejected'];
    if (disallowedStatuses.includes(issue.status)) {
      return res.status(400).json({ error: `Evidence cannot be uploaded when complaint status is ${issue.status.toUpperCase()}.` });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No evidence files provided.' });
    }

    const activeStorageClient = supabaseAdmin || supabase;
    const attachments = [];

    for (const file of req.files) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `evidence/${fileName}`;

      const { error: uploadError } = await activeStorageClient.storage
        .from('issue-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        logger.error('Failed to upload evidence file: %O', uploadError);
        continue;
      }

      const { data: { publicUrl } } = activeStorageClient.storage
        .from('issue-images')
        .getPublicUrl(filePath);

      // Insert attachment record
      const { data: attachment, error: attachError } = await activeClient
        .from('issue_attachments')
        .insert({
          issue_id: id,
          uploaded_by: userId,
          file_url: publicUrl,
          file_name: file.originalname,
          file_size: file.size
        })
        .select()
        .single();

      if (attachError) {
        logger.error('Failed to insert attachment record: %O', attachError);
      } else {
        attachments.push(attachment);
      }
    }

    // Insert status_history entry using admin
    const activeAdmin = supabaseAdmin || supabase;
    const { error: historyError } = await activeAdmin
      .from('status_history')
      .insert({
        issue_id: id,
        status: issue.status,
        updated_by: userId,
        notes: 'Additional evidence uploaded by citizen.'
      });

    if (historyError) {
      logger.error('Failed to log evidence upload status history: %O', historyError);
    }

    return res.status(200).json({ message: 'Evidence uploaded successfully', attachments });
  } catch (err) {
    logger.error('uploadEvidence Error: %O', err);
    return res.status(400).json({ error: `Evidence upload failed: ${err.message || err}` });
  }
};

/**
 * Get a printable receipt for an issue
 */
export const getIssueReceipt = async (req, res) => {
  const { id } = req.params;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: issue, error } = await activeClient
      .from('issues')
      .select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)')
      .eq('id', id)
      .single();

    if (error || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const statusColors = {
      pending: '#f59e0b',
      assigned: '#3b82f6',
      in_progress: '#8b5cf6',
      resolved: '#10b981',
      verified: '#10b981',
      rejected: '#ef4444',
      withdrawn: '#6b7280'
    };
    const badgeColor = statusColors[issue.status] || '#3b82f6';
    const generatedDate = new Date().toLocaleString();

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Receipt - ${issue.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; line-height: 1.6; }
    .receipt-container { max-width: 800px; margin: 0 auto; border: 2px solid #0f766e; background: #ffffff; border-radius: 12px; padding: 50px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; }
    .receipt-container::before { content: ""; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px dashed rgba(15, 118, 110, 0.3); border-radius: 8px; pointer-events: none; }
    
    /* Top Logo Header */
    .logo-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 30px; }
    .gov-logo { height: 75px; object-fit: contain; }
    .cc-logo { height: 60px; object-fit: contain; }
    
    /* Document Titles */
    .title-section { text-align: center; margin-bottom: 35px; }
    .title-gov { font-size: 15px; font-weight: 700; color: #0f766e; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .title-dept { font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .title-doc { font-size: 22px; font-weight: 700; color: #1e293b; letter-spacing: 0.5px; border-bottom: 2px solid #0f766e; display: inline-block; padding-bottom: 6px; }
    
    /* Detail Layout */
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 30px; margin-bottom: 35px; }
    .detail-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; font-weight: 700; margin-bottom: 4px; }
    .detail-value { font-size: 14px; color: #1e293b; font-weight: 500; }
    .full-width { grid-column: 1 / -1; }
    
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .description-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; font-size: 14px; color: #334155; line-height: 1.7; }
    
    /* Validation & Seal */
    .validation-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 35px; }
    .seal-text { font-size: 12px; color: #64748b; max-width: 450px; line-height: 1.5; }
    .qr-placeholder { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font-size: 10px; text-align: center; color: #64748b; font-weight: 600; background: #f8fafc; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100px; height: 100px; justify-content: center; }
    .qr-icon { font-size: 28px; color: #0f766e; margin-bottom: 4px; }
    
    .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 40px; }
    .print-btn { display: inline-block; padding: 10px 24px; background: #0f766e; color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(15, 118, 110, 0.2); }
    .print-btn:hover { background: #0d9488; }
    
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt-container { border: none; padding: 10px; box-shadow: none; }
      .receipt-container::before { display: none; }
      .print-btn-container { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-btn-container" style="max-width: 800px; margin: 0 auto 15px auto; text-align: right;">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  
  <div class="receipt-container">
    <div class="logo-header">
      <img src="/images/tamilnadu_auth.png" alt="Government of Tamil Nadu" class="gov-logo">
      <img src="/images/crowdcity_logo_transparent.png" alt="CrowdCity AI" class="cc-logo">
    </div>
    
    <div class="title-section">
      <div class="title-gov">Government of Tamil Nadu</div>
      <div class="title-dept">Civic Issue Acknowledgement Receipt</div>
      <div class="title-doc">Complaint Receipt</div>
    </div>
    
    <div class="detail-grid">
      <div>
        <div class="detail-label">Complaint ID</div>
        <div class="detail-value" style="font-family: monospace; font-size: 13px; font-weight: 600; color: #0f766e;">${issue.id}</div>
      </div>
      <div>
        <div class="detail-label">Status</div>
        <div><span class="status-badge" style="background-color: ${badgeColor};">${(issue.status || 'pending').replace(/_/g, ' ')}</span></div>
      </div>
      
      <div class="full-width">
        <div class="detail-label">Complaint Title</div>
        <div class="detail-value" style="font-size: 16px; font-weight: 600; color: #0f766e;">${issue.title || 'Untitled'}</div>
      </div>
      
      <div>
        <div class="detail-label">Category</div>
        <div class="detail-value" style="text-transform: capitalize;">${(issue.category || 'general').replace(/_/g, ' ')}</div>
      </div>
      <div>
        <div class="detail-label">Date Submitted</div>
        <div class="detail-value">${issue.created_at ? new Date(issue.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
      </div>
      
      <div>
        <div class="detail-label">Submitted By</div>
        <div class="detail-value">${issue.reporter?.full_name || 'Anonymous Citizen'}</div>
      </div>
      <div>
        <div class="detail-label">Assigned Authority</div>
        <div class="detail-value">${issue.assigned_to ? 'Department Official' : 'Pending Assignment'}</div>
      </div>
      
      <div class="full-width">
        <div class="detail-label">Location Address</div>
        <div class="detail-value">${issue.address || 'Address not available'}</div>
      </div>
      
      <div>
        <div class="detail-label">Latitude</div>
        <div class="detail-value">${issue.latitude || 'N/A'}</div>
      </div>
      <div>
        <div class="detail-label">Longitude</div>
        <div class="detail-value">${issue.longitude || 'N/A'}</div>
      </div>
      
      <div class="full-width">
        <div class="detail-label">Complaint Description</div>
        <div class="description-box">${issue.description || 'No description provided.'}</div>
      </div>
    </div>
    
    <div class="validation-row">
      <div class="seal-text">
        <strong style="color: #0f766e; display: block; margin-bottom: 4px;">Digitally Verified Receipt</strong>
        This is an official computer-generated receipt issued by the CrowdCity Civic Engagement Portal, Department of Municipal Administration & Water Supply, Government of Tamil Nadu. It is digitally signed and serves as valid proof of complaint registration.
      </div>
      <div class="qr-placeholder">
        <span style="font-size: 24px; margin-bottom: 2px;">🛡️</span>
        <span style="font-size: 9px; line-height: 1.1;">CROWDCITY<br>VERIFIED</span>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated on ${generatedDate} &bull; System ID: CC-PRT-${issue.id.substring(0,8).toUpperCase()}</p>
      <p style="margin-top: 4px; font-weight: 500; color: #0f766e;">CrowdCity AI &mdash; Enhancing Civic Accountability</p>
    </div>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlContent);
  } catch (err) {
    logger.error('getIssueReceipt Error: %O', err);
    return res.status(500).json({ error: 'Server error generating receipt' });
  }
};

/**
 * Get chat messages for an issue
 */
export const getChatMessages = async (req, res) => {
  const { id } = req.params;

  try {
    const activeClient = getSupabaseClient(req);
    const { data: messages, error } = await activeClient
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ messages: messages || [] });
  } catch (err) {
    logger.error('getChatMessages Error: %O', err);
    return res.status(500).json({ error: 'Server error fetching chat messages' });
  }
};

/**
 * Send a chat message for an issue
 */
export const sendChatMessage = async (req, res) => {
  const { id } = req.params;
  const { message_text } = req.body;
  const userId = req.user.id;

  if (!message_text || !message_text.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty.' });
  }

  try {
    const activeClient = getSupabaseClient(req);

    // Fetch the issue to verify access
    const { data: issue, error: issueError } = await activeClient
      .from('issues')
      .select('*, reporter:profiles!issues_reporter_id_fkey(full_name)')
      .eq('id', id)
      .maybeSingle();

    if (issueError) throw issueError;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Verify user is either reporter or assigned authority
    if (userId !== issue.reporter_id && userId !== issue.assigned_to) {
      return res.status(403).json({ error: 'You are not authorized to send messages on this complaint.' });
    }

    // Insert the message
    const { data: chatMessage, error: insertError } = await activeClient
      .from('messages')
      .insert({
        issue_id: id,
        sender_id: userId,
        message_text: message_text.trim()
      })
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
      .single();

    if (insertError) throw insertError;

    // Determine recipient
    const recipientId = userId === issue.reporter_id ? issue.assigned_to : issue.reporter_id;
    const senderName = chatMessage.sender?.full_name || 'User';

    // Send notification to recipient
    if (recipientId) {
      await createNotification(
        recipientId,
        "New Message",
        `${senderName} sent a message on complaint '${issue.title}'.`,
        "chat_message",
        id
      );

      // Send email notification (background, don't await)
      getUserEmail(recipientId).then(async (email) => {
        if (email) {
          const { data: recipientProfile } = await (supabaseAdmin || supabase)
            .from('profiles')
            .select('full_name')
            .eq('id', recipientId)
            .maybeSingle();
          const recipientName = recipientProfile?.full_name || 'User';
          const preview = message_text.trim().substring(0, 150);
          sendNewChatMessageEmail(email, recipientName, issue.title, senderName, preview);
        }
      }).catch(err => logger.error('Background email error:', err));
    }

    return res.status(201).json({ message: 'Message sent', chatMessage });
  } catch (err) {
    logger.error('sendChatMessage Error: %O', err);
    return res.status(400).json({ error: `Failed to send message: ${err.message || err}` });
  }
};
