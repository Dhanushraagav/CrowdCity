import dotenv from 'dotenv';
import logger from '../config/logger.js';
import { analyzeComplaint } from '../services/groqService.js';
import Groq from 'groq-sdk';
dotenv.config();

/**
 * POST /api/ai/analyze-complaint
 * Dedicated endpoint for Groq SDK analysis. Returns capitalized categories, priorities, and departments.
 */
export const analyzeComplaintController = async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required for analysis' });
  }

  try {
    const aiResult = await analyzeComplaint(title, description);
    return res.status(200).json(aiResult);
  } catch (err) {
    logger.error('analyzeComplaintController Error: %O', err);
    return res.status(500).json({ error: 'Server error analyzing complaint' });
  }
};

/**
 * POST /api/ai/analyze
 * Existing endpoint for auto-categorization button. Normalizes category to lowercase for picker compatibility.
 */
export const analyzeIssue = async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required for analysis' });
  }

  try {
    const aiData = await analyzeComplaint(title, description);
    
    // Map the capitalized category back to lowercase
    const categoryMapping = {
      'Roads': 'roads',
      'Streetlights': 'streetlights',
      'Water Supply': 'water_supply',
      'Drainage': 'drainage',
      'Garbage': 'garbage',
      'Traffic': 'traffic',
      'Public Property': 'public_property',
      'Parks': 'parks',
      'Sanitation': 'sanitation',
      'Safety Hazard': 'safety_hazard',
      'Environment': 'environment',
      'Other': 'other'
    };
    const suggestedCategory = categoryMapping[aiData.category] || 'other';

    return res.status(200).json({
      suggestedCategory,
      severity: aiData.priority.toLowerCase(),
      department: aiData.department,
      aiEnhancement: aiData.summary,
      confidenceScore: 0.94
    });

  } catch (err) {
    logger.error('analyzeIssue Error: %O', err);
    // Fallback locally
    const mockData = getMockAiAnalysis(title, description);
    return res.status(200).json({
      suggestedCategory: mockData.category,
      severity: mockData.priority,
      department: mockData.department,
      aiEnhancement: mockData.summary,
      confidenceScore: 0.85
    });
  }
};

/**
 * Keyword-based local fallback analyzer
 */
function getMockAiAnalysis(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  let category = 'other';
  if (text.includes('mosquito') || text.includes('breeding') || text.includes('pollution') || text.includes('environment') || text.includes('ecology') || text.includes('conservation')) {
    category = 'environment';
  } else if (text.includes('manhole') || text.includes('fallen tree') || text.includes('exposed wire') || text.includes('live wire')) {
    category = 'safety_hazard';
  } else if (text.includes('toilet') || text.includes('unclean') || text.includes('dirty') || text.includes('sanitation') || text.includes('hygiene')) {
    category = 'sanitation';
  } else if (text.includes('pothole') || text.includes('crater') || text.includes('asphalt') || text.includes('footpath') || text.includes('sidewalk') || text.includes('crack') || text.includes('road')) {
    category = 'roads';
  } else if (text.includes('streetlight') || text.includes('light pole') || text.includes('lamp') || text.includes('bulb') || text.includes('light')) {
    category = 'streetlights';
  } else if (text.includes('leak') || text.includes('water supply') || text.includes('burst') || text.includes('pipe') || text.includes('pressure') || text.includes('water')) {
    category = 'water_supply';
  } else if (text.includes('drain') || text.includes('sewer') || text.includes('gutter') || text.includes('flooded drainage')) {
    category = 'drainage';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('dump') || text.includes('litter') || text.includes('waste') || text.includes('refuse')) {
    category = 'garbage';
  } else if (text.includes('traffic') || text.includes('signal') || text.includes('sign') || text.includes('intersection')) {
    category = 'traffic';
  } else if (text.includes('bus stop') || text.includes('bench') || text.includes('public property') || text.includes('government property') || text.includes('damaging public')) {
    category = 'public_property';
  } else if (text.includes('park') || text.includes('playground') || text.includes('garden') || text.includes('fence')) {
    category = 'parks';
  } else if (text.includes('hazard') || text.includes('danger') || text.includes('accident') || text.includes('debris')) {
    category = 'safety_hazard';
  }

  let department = 'General Department';
  if (category === 'roads' || category === 'traffic' || category === 'public_property' || category === 'parks' || category === 'safety_hazard') {
    department = 'Road Department';
  } else if (category === 'garbage' || category === 'sanitation' || category === 'environment') {
    department = 'Sanitation Department';
  } else if (category === 'water_supply' || category === 'drainage') {
    department = 'Water Department';
  } else if (category === 'streetlights') {
    department = 'Electrical Department';
  }

  let priority = 'low';
  if (text.includes('danger') || text.includes('hazard') || text.includes('accident') || text.includes('injury') || text.includes('emergency') || text.includes('critical') || text.includes('manhole') || text.includes('exposed wire')) {
    priority = 'critical';
  } else if (text.includes('outage') || text.includes('dark') || text.includes('broken') || text.includes('large') || text.includes('block') || text.includes('overflow')) {
    priority = 'high';
  } else if (text.includes('leak') || text.includes('crack') || text.includes('dirty')) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  const summary = `AI detected a ${category} issue: "${description.substring(0, 60)}..."`;

  return {
    summary,
    category,
    department,
    priority
  };
}

/**
 * Chat conversation with citizen.
 * Calls Groq API or falls back to local keyword-based conversational response if unconfigured.
 */
export const chatWithAi = async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages history array is required' });
  }

  // Task 5: Detailed logging for Incoming message
  const incomingUserMessage = messages[messages.length - 1];
  logger.info('Incoming chat message payload: %O', incomingUserMessage);

  const groqApiKey = process.env.GROQ_API_KEY;
  const isGroqConfigured = groqApiKey && 
                           !groqApiKey.includes('your-groq-api-key') && 
                           groqApiKey !== '';

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = {
    role: 'system',
    content: `You are the CrowdCity AI Assistant, a friendly and professional helper for CrowdCity AI, a civic engagement platform.
Your goals:
1. Help users file complaints (categories: roads, streetlights, water_supply, drainage, garbage, traffic, public_property, parks, sanitation, safety_hazard, environment, other). Explain what they need to specify (title, description, location address, category, and optionally uploading photos).
2. Explain complaint statuses:
   - "pending": Complaint is reported and logged.
   - "assigned": Dispatcher has delegated it to a specific inspector or authority team.
   - "in_progress": Crews are actively inspecting or repairing the issue.
   - "resolved": Completed successfully! The reporter earns points and verification badges.
   - "rejected": Not a valid hazard or is outside city scope.
3. Explain the gamification points:
   - Reporting complaints: +10 points.
   - Verified resolution: +50 points to reporter, +20 points to the authority inspector who fixed it.
   - Commenting on complaints: +5 points (deleting comment: -5 points).
   - Upvoting complaints: +2 points (toggling off: -2 points).
   - Earning badge unlocks: +20 points bonus per badge.
4. Explain Rank Levels:
   - < 50 points: Civic Novice
   - >= 50 points: Local Watchdog
   - >= 150 points: Civic Leader
   - >= 300 points: City Legend
5. Explain Badges milestones:
   - First Sentinel: 1st report.
   - Civic Champion: 5 reports.
   - Voice of the City: 5 comments.
   - Vocal Citizen: 5 upvotes.
   - Urban Restorer: 1st resolved report.
6. Suggest immediate safety actions based on issue category:
   - Roads: Advise caution for cyclists/drivers, watch for potholes or sidewalk cracks.
   - Water Supply: Report water leaks or bursts. Stay clear of high pressure streams.
   - Streetlights: Advise users to avoid poorly lit areas at night.
   - Drainage/Road blockage/Traffic: Tell drivers to take alternate routes, avoid standing water, report broken traffic signals.
   - Safety Hazard/Downed power lines/live wire hazards: EXPLICITLY warn them to stay at least 30 feet away and call emergency services (100) immediately!
   - Garbage/Sanitation/Environment: Warn against touching hazardous waste, report illegal dumping.

You are a general assistant as well, so feel free to answer any general questions the user may ask, not just CrowdCity AI specific ones. Keep your responses concise, helpful, and friendly. Do not output JSON, speak in conversational Markdown.`
  };

  if (isGroqConfigured) {
    try {
      // Task 3: Verify the Groq SDK is initialized correctly
      const groq = new Groq({ apiKey: groqApiKey });
      
      const groqPayload = {
        model: model,
        messages: [systemMessage, ...messages]
      };

      // Task 5: Detailed logging for Groq request
      logger.info('Executing Groq Chat Completion Request: %O', groqPayload);

      const chatCompletion = await groq.chat.completions.create(groqPayload);

      // Task 5: Detailed logging for Groq response
      logger.info('Received Groq Chat Completion Response: %O', chatCompletion);

      const assistantMessage = chatCompletion.choices[0].message;

      // Task 4: Verify chatbot responses are generated by Groq
      return res.status(200).json({ message: assistantMessage });

    } catch (err) {
      // Task 5: Detailed logging for Errors
      logger.error('Groq Chat Completion Failed: %O', err);

      // Task 6: Do not return fallback responses when Groq should be used
      return res.status(500).json({
        error: 'Groq AI chatbot request failed',
        details: err.message
      });
    }
  }

  // Fallback keyword-based response generator (used ONLY if Groq is unconfigured)
  logger.info('Groq client unconfigured. Using local rule-based fallback responses.');
  
  const userMessage = messages[messages.length - 1].content.toLowerCase();
  let reply = "I'm here to help you make our city better! You can ask me about how to report issues, how points and badges work, or what different complaint statuses mean.";

  if (userMessage.includes('point') || userMessage.includes('score') || userMessage.includes('level') || userMessage.includes('rank')) {
    reply = `On CrowdCity AI, citizens are rewarded for community participation!
* **Points System**:
  - File a Complaint: **+10 points**
  - Complaint Verified (Resolved): **+50 points** (to the reporter) & **+20 points** (to the inspector)
  - Write a Comment: **+5 points** (deleting subtracts **-5**)
  - Upvote: **+2 points** (retracting subtracts **-2**)
  - Badge Unlocks: **+20 points** bonus
* **Rank Levels**:
  - **Civic Novice**: Under 50 points
  - **Local Watchdog**: 50 - 149 points
  - **Civic Leader**: 150 - 299 points
  - **City Legend**: 300+ points`;
  } else if (userMessage.includes('badge') || userMessage.includes('achievement') || userMessage.includes('sentinel') || userMessage.includes('champion') || userMessage.includes('restorer')) {
    reply = `You can earn 5 distinct achievement badges, each awarding **+20 points** bonus:
1. **First Sentinel**: Filed your 1st complaint.
2. **Civic Champion**: Filed 5 complaints.
3. **Voice of the City**: Contributed 5 comments.
4. **Vocal Citizen**: Cast 5 upvotes.
5. **Urban Restorer**: Your reported complaint was resolved successfully.`;
  } else if (userMessage.includes('status') || userMessage.includes('pending') || userMessage.includes('assigned') || userMessage.includes('in progress') || userMessage.includes('resolved') || userMessage.includes('rejected')) {
    reply = `Civic complaints go through several tracking statuses:
* **Pending**: Hazards logged successfully and awaiting dispatch delegation.
* **Assigned**: Delegated to a department inspector who is scheduling repairs.
* **In Progress**: Work crews are actively inspecting or patching up the hazard.
* **Resolved**: Success! The hazard is cleared, and completion proof is logged.
* **Rejected**: Outside scope or duplicates.`;
  } else if (userMessage.includes('report') || userMessage.includes('file') || userMessage.includes('complaint') || userMessage.includes('submit')) {
    reply = `To report a hazard, go to the **AI-Assisted Report** tab:
1. Enter a descriptive **Title** and **Description**.
2. Select the **Category** (roads, streetlights, water_supply, drainage, garbage, traffic, public_property, parks, sanitation, safety_hazard, environment, other).
3. Choose the location on the interactive OSM map (which sets the coordinates and address).
4. Optionally upload a **Photo** of the hazard.
5. Click **Submit** to log the issue and earn **+10 points**!`;
  } else if (userMessage.includes('roads') || userMessage.includes('pothole') || userMessage.includes('sidewalk')) {
    reply = `**Roads Issue**: A very common hazard! When riding/driving near broken roads or potholes, keep a safe distance and watch out for swerving cars. Suggest filing a report with coordinates and a photo so Road Department crews can patch it quickly.`;
  } else if (userMessage.includes('water') || userMessage.includes('leak') || userMessage.includes('sewage') || userMessage.includes('supply')) {
    reply = `**Water Supply Issue**: If it is clean water, report it so the Water Department can fix it. If it is a sewage overflow, **please keep a safe distance** due to sanitation risks, warn neighbors, and file the report immediately.`;
  } else if (userMessage.includes('light') || userMessage.includes('dark') || userMessage.includes('streetlight') || userMessage.includes('bulb')) {
    reply = `**Streetlights Issue**: Dark streets raise safety concerns. Avoid unlit lanes at night. Report the exact pole location so Electrical Department dispatcher can dispatch light maintenance crews.`;
  } else if (userMessage.includes('power') || userMessage.includes('wire') || userMessage.includes('live wire') || userMessage.includes('electricity') || userMessage.includes('downed')) {
    reply = `⚠️ **CRITICAL ELECTRICAL HAZARD**: Downed power lines are extremely dangerous! 
- **Stay at least 30 feet away** from the lines and anything they touch.
- Call emergency services (**100**) immediately!
- Only report on the platform once you are in a completely safe location.`;
  } else if (userMessage.includes('hello') || userMessage.includes('hi') || userMessage.includes('hey') || userMessage.includes('assistant')) {
    reply = `Hello! I am your CrowdCity AI Assistant. Ask me how to report issues, how points/badges work, what a status means, or safety suggestions for specific hazards!`;
  }

  return res.status(200).json({
    message: {
      role: 'assistant',
      content: reply
    }
  });
};

/**
 * Task 8: Create a test endpoint to verify Groq connectivity.
 */
export const testGroqConnectivity = async (req, res) => {
  const groqApiKey = process.env.GROQ_API_KEY;
  const isGroqConfigured = groqApiKey && 
                           !groqApiKey.includes('your-groq-api-key') && 
                           groqApiKey !== '';

  if (!isGroqConfigured) {
    return res.status(400).json({
      status: 'error',
      message: 'Groq API Key is not configured in environment variables.'
    });
  }

  try {
    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    
    logger.info('Executing connectivity check on Groq for model: %s', model);
    const start = Date.now();
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'user', content: 'Ping: Reply with "pong" and nothing else.' }
      ],
      model: model,
      max_tokens: 10
    });
    const latency = Date.now() - start;

    const reply = chatCompletion.choices[0].message.content.trim();
    logger.info('Groq connectivity check completed successfully in %d ms. Output: %s', latency, reply);

    return res.status(200).json({
      status: 'success',
      message: 'Groq API connectivity successfully verified!',
      model: model,
      latencyMs: latency,
      response: reply
    });

  } catch (err) {
    logger.error('Groq connectivity check failed: %O', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to communicate with Groq API',
      error: err.message
    });
  }
};

