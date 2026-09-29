import dotenv from 'dotenv';
import logger from '../config/logger.js';
import { analyzeComplaint, explainSchemeEligibility, chatWithGovernmentAssistant, verifyDocumentReadiness, getFormFieldGuidance, translateAndCleanVoiceText, translateTextToTamil, translateCivicText, getGroqModel } from '../services/groqService.js';
import { generatePersonalizedRecommendations } from '../services/recommendationService.js';
import { analyzeCivicImage } from '../services/vision/visionService.js';
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
    return res.status(500).json({ error: 'AI analysis service is temporarily unavailable. Please configure your categories manually.' });
  }
};

/**
 * Chat conversation with citizen.
 * Calls Groq API only. If unconfigured or error, returns proper error response.
 */
export const chatWithAi = async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages history array is required' });
  }

  // Detailed logging for Incoming message
  const incomingUserMessage = messages[messages.length - 1];
  logger.info('Incoming chat message payload: %O', incomingUserMessage);

  const groqApiKey = process.env.GROQ_API_KEY;
  const isGroqConfigured = groqApiKey && 
                           !groqApiKey.includes('your-groq-api-key') && 
                           groqApiKey !== '';

  const model = getGroqModel();

  const systemMessage = {
    role: 'system',
    content: `You are the CrowdCity Civic Assistant, the official civic engagement and smart governance assistant for the CrowdCity platform in Tamil Nadu.

STRICT DOMAIN RESTRICTION (MANDATORY & HIGHEST PRIORITY):
You are strictly restricted to questions directly concerning CrowdCity, its features, in-portal navigation, civic/transportation grievance reporting, Tamil Nadu government schemes, emergency services, and verified CrowdCity project team information.
If the citizen asks ANY question outside this domain (including but not limited to general programming/coding, math equations, general politics, world history, sports, movies, recipes, health/medical advice, trivia, jokes, creative writing, or general chit-chat), you MUST politely refuse using this EXACT response:
"I'm the CrowdCity Civic Assistant. I can help only with CrowdCity, its features, portal navigation, civic reporting workflows, and available CrowdCity team information."
(If the user asked in Tamil or Tanglish, you may deliver the refusal politely in Tamil/Tanglish conveying this exact scope boundary).

GREETINGS:
You may briefly and warmly respond to basic greetings (e.g., "hi", "hello", "vanakkam") and ask how you can assist them with CrowdCity.

ZERO EMOJIS RULE:
STRICTLY ZERO EMOJIS in all responses under any circumstances. Never output any emoji characters or symbols.

IN-PORTAL NAVIGATION INSTRUCTIONS:
When explaining how or where to access any feature, ALWAYS guide the citizen using exact in-portal UI paths based on the actual application layout (e.g., "Open the left sidebar and select 'Report Issue'", "Look at the top navigation bar and select 'TN Updates'", "On the Citizen Dashboard, scroll to the feed tabs and choose 'Nearby'").
DO NOT provide raw URLs or file paths (e.g., do not say 'report.html', 'services.html', or 'https://...') UNLESS the citizen explicitly asks for a direct link or URL.

VERIFIED CROWDCITY PROJECT TEAM:
Only the following verified individuals are part of the CrowdCity project team. Never invent, infer, or hallucinate other people, roles, credentials, or organizations:
- Sandeep Kumar J: Founder (Visionary entrepreneur dedicated to building technology-driven solutions for smarter, transparent, and connected civic communities).
- Dhanush Raagav S: Developer (Passionate developer focused on building modern digital products, intelligent applications, scalable full-stack web platforms, and responsive user experiences).
- Tulasiram V: Test Engineer (Quality assurance specialist ensuring reliability, robustness, and consistent real-world user experience across the portal).
- Aathisankar A: Software Architect (Specialist in scalable software architecture, system design, data integrity, and high-performance micro-patterns).
- Padmadev D: DevOps Engineer (Infrastructure and automation engineer managing deployment workflows, cloud environments, and production system stability).

COMPREHENSIVE CROWDCITY PLATFORM KNOWLEDGE BASE:

1. Platform Purpose:
CrowdCity is an intelligent civic engagement and smart governance platform designed for Tamil Nadu. It bridges citizens with municipal corporations, district collectors, and highway authorities to report civic grievances, track resolution workflows with SLA countdowns, discover state welfare schemes, and monitor public safety.

2. Citizen Portal & Dashboard:
- Citizen Dashboard: The primary landing view for logged-in citizens. Features live municipal notices, emergency shortcuts, quick action buttons, weather preview, and four live issue feeds.
- Feeds:
  * Recent: Newly filed complaints across the region.
  * Trending: High-priority community issues with the most citizen upvotes.
  * Nearby: Issues geocoded within the citizen's immediate vicinity.
  * Resolved: Closed complaints with authority completion photos and inspection timestamps.
- Category Filters: Roads, Streetlights, Water Supply, Drainage, Garbage, Traffic, Public Property, Parks, Sanitation, Safety Hazard.
- Upvoting / Community Support: Citizens can upvote existing issues to indicate community impact without creating duplicate complaints.

3. Reporting Issues:
- In-portal access: Open the left sidebar and select "Report Issue".
- Dual Complaint Modes:
  * Civic Issues: Municipal issues including potholes, faulty streetlights, water supply leaks, drainage overflows, garbage heaps, sanitation issues, and public safety hazards.
  * Transportation Issues: State and national highway infrastructure defects, traffic signal malfunctions, missing median dividers, bridge damage, and transit corridor hazards.
- Submission Requirements: Title, category, detailed description, exact location/address (with GPS auto-locate or interactive map pin), and photographic evidence (up to 5 images).
- AI Image Analysis: Integrated Groq AI vision inspects uploaded photos, confirms category validity, estimates hazard severity, and detects tampering in real time.
- Duplicate Detection: Dual-tier detection using spatial radius matching, semantic text similarity, and perceptual image hashing (dHash). If a duplicate is found, the citizen is notified and encouraged to upvote the existing complaint instead.

4. Tracking & Lifecycle:
- In-portal access: Open the left sidebar and select "My Complaints".
- Stages in Complaint Lifecycle:
  * Submitted / Pending: Grievance recorded and logged in the municipal database.
  * Verified: Triage and automated AI checks complete.
  * Assigned: Assigned to a municipal engineer, contractor, or local zonal officer.
  * In Progress: Repair crews and equipment actively working on site.
  * Resolved: Work completed with official post-repair proof photo and verified closure.
  * Rejected: Deemed invalid, duplicate, or outside municipal jurisdiction.
- Issue Details View: Shows a complete step-by-step progress timeline, authority notes, assignment cards, SLA countdowns, citizen comments, and resolution verification images.

5. Interactive Map:
- In-portal access: Open the left sidebar and select "Map".
- Displays live geocoded markers for civic and transportation complaints, color-coded by issue category and status.

6. Government Services & Welfare Schemes:
- In-portal access: Open the left sidebar and select "Government Services".
- 38+ Official Tamil Nadu Welfare Schemes across key categories: Social Welfare, Education & Youth, Health & Insurance, Agriculture & Farmers, Skill Development.
- Instant scheme search, category filtering, eligibility checker, required document lists, and official application links.
- AI Scheme Advisor: Specialized assistant that analyzes citizen profile (age, gender, income, community) to recommend eligible government benefits.
- Application Tracker: In-portal milestone tracker to track personal scheme applications.

7. Live Updates & Citizen Utilities:
- TN Updates: Top navigation bar -> "TN Updates". Official Tamil Nadu government announcements, citizen advisories, and administrative releases.
- Public Pulse: Top navigation bar -> "Public Pulse" dropdown. Community sentiment analysis and citizen feedback.
- Weather & Alerts: Hero weather card or "Weather Alerts" in navigation. Real-time Open-Meteo forecasts, hourly predictions, rainfall radar, and IMD advisories for all 38 districts.
- Power Outages / Shutdowns: Top navigation or Dashboard links -> "Power Outages". Scheduled TANGEDCO power maintenance and shutdown notifications filtered by district and substation.
- Office Locator: Accessible via Government Services -> Office Locator. Directory of District Collectorates, Taluk offices, and Corporation zonal offices.
- Tourism: Top navigation or Dashboard links -> "Tourism". Exploration of Tamil Nadu historical monuments, temples, hill stations, and eco-tourism across 38 districts.
- District Helplines: Open the left sidebar and select "District Helplines". Official phone directory for all 38 Tamil Nadu district collectorates and control rooms.
- Emergency Help Center: Open the left sidebar and select "Emergency Help Center". Quick-dial emergency numbers:
  * Medical & Ambulance: 108
  * Police: 100
  * Fire & Rescue: 101
  * Single Emergency Number: 112
  * Women Safety: 1091
  * Municipal Grievance Helpline: 1913
- Secure Document Wallet: Top-right user menu or dashboard banner. MPIN-protected encrypted offline storage for personal documents (Aadhaar, Ration Card, Certificates).
- Civic Helpdesk: Floating widget at the bottom-right of every page.
- User Profile & Notifications: Top-right header icons.

TAMIL / TANGLISH SUPPORT:
If a citizen writes in Tamil or Tanglish (e.g., "complaint epdi podrathu", "status epdi check panrathu", "my complaints enga irukku"), understand the intent and respond warmly in simple Tamil or Tanglish with the exact portal steps (e.g., "Left sidebar la 'Report Issue' click panni complaint submit pannalam").

Keep your responses concise, professional, and practical. Speak in plain conversational Markdown without emojis.`
  };

  if (!isGroqConfigured) {
    return res.status(503).json({ error: 'AI chatbot service is temporarily unconfigured. Please contact administrator.' });
  }

  try {
    // Verify the Groq SDK is initialized correctly
    const groq = new Groq({ apiKey: groqApiKey });
    
    const groqPayload = {
      model: model,
      messages: [systemMessage, ...messages],
      temperature: 0.2
    };

    // Detailed logging for Groq request
    logger.info('Executing Groq Chat Completion Request: %O', groqPayload);

    const chatCompletion = await groq.chat.completions.create(groqPayload);

    // Detailed logging for Groq response
    logger.info('Received Groq Chat Completion Response: %O', chatCompletion);

    const assistantMessage = chatCompletion.choices[0].message;

    // Strictly enforce zero emojis in all assistant outputs
    if (assistantMessage && assistantMessage.content) {
      assistantMessage.content = assistantMessage.content
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{FE0E}\u{FE0F}]/gu, '')
        .trim();
    }

    return res.status(200).json({ message: assistantMessage });

  } catch (err) {
    logger.error('Groq Chat Completion Failed: %O', err);

    let statusCode = 500;
    let errorMessage = 'Groq AI chatbot request failed';
    if (err.status === 401 || (err.message && err.message.includes('API key'))) {
      statusCode = 401;
      errorMessage = 'Invalid or unauthorized Groq API key';
    } else if (err.status === 404 || (err.message && err.message.includes('model'))) {
      statusCode = 404;
      errorMessage = 'Requested Groq model is invalid or unavailable';
    } else if (err.status === 429 || (err.message && err.message.includes('rate limit'))) {
      statusCode = 429;
      errorMessage = 'Groq AI rate limit exceeded. Please wait a moment and try again';
    } else if (err.status === 504 || (err.message && err.message.includes('timeout'))) {
      statusCode = 504;
      errorMessage = 'Groq AI request timed out';
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: err.message || 'Unknown error'
    });
  }
};

/**
 * Create a test endpoint to verify Groq connectivity.
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
    const model = getGroqModel();
    
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

/**
 * POST /api/ai/explain-scheme
 * Dedicated endpoint to generate plain-English/Tamil AI scheme eligibility explanation.
 */
export const explainSchemeController = async (req, res) => {
  const { scheme, userProfile, lang } = req.body;

  if (!scheme) {
    return res.status(400).json({ error: 'Scheme data is required for explanation' });
  }

  try {
    const explanation = await explainSchemeEligibility(scheme, userProfile || {}, lang || 'en');
    return res.status(200).json({ success: true, explanation });
  } catch (err) {
    logger.error('explainSchemeController Error: %O', err);
    return res.status(500).json({ error: 'Server error generating scheme AI explanation' });
  }
};

/**
 * POST /api/ai/assistant-chat
 * Dedicated endpoint for Government Assistant ChatGPT-style conversational advisor.
 */
export const assistantChatController = async (req, res) => {
  const { messages, userProfile, schemeKnowledge } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required for Assistant chat' });
  }

  try {
    const response = await chatWithGovernmentAssistant(messages, userProfile || {}, schemeKnowledge || []);
    return res.status(200).json({ success: true, text: response.text });
  } catch (err) {
    logger.error('assistantChatController Error: %O', err);
    return res.status(500).json({ error: 'Server error in Government Assistant chat' });
  }
};

/**
 * POST /api/ai/verify-document
 * Dedicated endpoint for Document Quality & Readiness Assistant.
 */
export const verifyDocumentController = async (req, res) => {
  const { docMeta, extractedText, scheme, metrics } = req.body;

  if (!docMeta || typeof docMeta !== 'object') {
    return res.status(400).json({ error: 'Document metadata is required for verification' });
  }

  try {
    const report = await verifyDocumentReadiness(docMeta, typeof extractedText === 'string' ? extractedText : '', scheme || {}, metrics || {});
    return res.status(200).json({ success: true, report });
  } catch (err) {
    logger.error('verifyDocumentController Error: %s', err?.message || 'Document verification failed');
    return res.status(500).json({ error: 'Server error analyzing document quality' });
  }
};

/**
 * POST /api/ai/form-guidance
 * Dedicated endpoint for AI Form Field guidance explanations.
 */
export const formGuidanceController = async (req, res) => {
  const { schemeName, fieldName } = req.body;

  if (!fieldName) {
    return res.status(400).json({ error: 'Field name is required for guidance' });
  }

  try {
    const guidance = await getFormFieldGuidance(schemeName || '', fieldName);
    return res.status(200).json({ success: true, guidance });
  } catch (err) {
    logger.error('formGuidanceController Error: %O', err);
    return res.status(500).json({ error: 'Server error generating field guidance' });
  }
};

/**
 * POST /api/ai/recommendations
 * Dedicated endpoint for Proactive AI Recommendations & Insights Engine.
 */
export const recommendationController = async (req, res) => {
  const { profile, docs, apps, reminders } = req.body;

  try {
    const data = await generatePersonalizedRecommendations(profile || {}, docs || [], apps || [], reminders || []);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('recommendationController Error: %O', err);
    return res.status(500).json({ error: 'Server error generating personalized recommendations' });
  }
};

/**
 * POST /api/ai/translate-voice
 * Dedicated endpoint for Speech-to-Text Tamil & Tanglish translation to clear English.
 */
export const translateVoiceController = async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required for voice translation.' });
  }

  try {
    const data = await translateAndCleanVoiceText(text);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('translateVoiceController Error: %O', err);
    return res.status(500).json({ error: 'Server error translating voice text' });
  }
};

/**
 * POST /api/ai/translate
 * Bidirectional translation endpoint for civic complaint descriptions (en <-> ta).
 */
export const translateController = async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Description text is required for translation.'
    });
  }

  const desiredTarget = (targetLang || 'ta').toLowerCase().startsWith('ta') ? 'ta' : 'en';
  const desiredSource = (sourceLang || (desiredTarget === 'ta' ? 'en' : 'ta')).toLowerCase().startsWith('ta') ? 'ta' : 'en';

  try {
    const result = await translateCivicText(text, desiredSource, desiredTarget);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('translateController Error: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Server error translating description.'
    });
  }
};

/**
 * POST /api/ai/translate-to-tamil
 * Dedicated endpoint for translating English civic complaint descriptions into natural Tamil script.
 */
export const translateToTamilController = async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Description text is required for translation.'
    });
  }

  try {
    const result = await translateTextToTamil(text);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('translateToTamilController Error: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Server error translating description to Tamil.'
    });
  }
};

/**
 * POST /api/ai/analyze-image
 * Dedicated endpoint for Open-Source Vision AI (Qwen/Qwen3-VL-2B-Instruct) camera and photo analysis.
 * Provides structured civic issue suggestions with human-in-the-loop review and graceful fallback.
 */
export const analyzeImageController = async (req, res) => {
  const { image, lang } = req.body;

  if (!image) {
    return res.status(400).json({
      success: false,
      error: 'Image data is required for visual AI detection.',
      canProceedManually: true
    });
  }

  try {
    const result = await analyzeCivicImage(image, { lang });

    if (result.statusCode === 400) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    logger.error('analyzeImageController Error: %O', err);
    return res.status(200).json({
      success: false,
      error: 'Image analysis is temporarily unavailable. You can continue submitting your complaint manually.',
      canProceedManually: true
    });
  }
};










