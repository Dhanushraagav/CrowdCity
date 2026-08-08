import dotenv from 'dotenv';
import logger from '../config/logger.js';
import { analyzeComplaint, explainSchemeEligibility, chatWithGovernmentAssistant, verifyDocumentReadiness, getFormFieldGuidance, translateAndCleanVoiceText, analyzeComplaintImage } from '../services/groqService.js';
import { generatePersonalizedRecommendations } from '../services/recommendationService.js';
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

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = {
    role: 'system',
    content: `You are the CrowdCity AI Assistant, an official assistant for CrowdCity AI civic engagement, government services, and transportation portal.

STRICT DOMAIN BOUNDARY & GREETINGS RULES:
1. GREETINGS & BASIC CONVERSATION ALLOWED: You MAY respond naturally to basic greetings, courtesies, and pleasantries (such as "hi", "hello", "hey", "good morning", "how are you", "who are you", "thank you", "bye"). Greet the user politely and offer assistance with CrowdCity AI features.
2. WEBSITE-ONLY SCOPE GUARDRAIL: Other than basic greetings and courtesies, you MUST ONLY answer questions that are directly related to our website (CrowdCity AI), the founder and engineering team behind CrowdCity AI, Tamil Nadu municipal civic grievance reporting, city transportation issues, government welfare schemes, portal navigation, complaint status tracking, gamification ranks/badges, and public emergency services.
3. OUT-OF-SCOPE DECLINATIONS: If the user asks ANY question outside the scope of our website or civic/transportation/government services (such as coding, math, sports, recipes, entertainment, trivia, general knowledge, or creative writing), you MUST politely decline with:
"I am specialized to answer questions related only to the CrowdCity AI portal, civic grievances, transportation reporting, and public government services. Please ask a question related to our website."
4. NO EMOJIS ALLOWED: You MUST NOT use any emojis in your responses under any circumstances.

CROWDCITY AI TEAM & LEADERSHIP INFORMATION (ABOUT OUR WEBSITE):
- Founder: Sandeep Kumar J (Founder — CrowdCity AI)
  About: Sandeep Kumar J is the founder of CrowdCity AI and an entrepreneur focused on building technology-driven solutions for smarter and more connected communities. His vision is to use innovation and AI to make civic interaction more efficient, transparent, and accessible.
- Developer: Dhanush Raagav S (Developer)
  About: Dhanush Raagav S is a technology enthusiast and developer passionate about building modern digital products and intelligent applications. He focuses on transforming ideas into scalable, user-friendly solutions through clean development and innovative technology.
- Test Engineer: Tulasiram V (Test Engineer)
  About: Tulasiram V works as the Test Engineer for CrowdCity AI, focusing on quality, reliability, and real-world usability. He helps identify issues, validate system behaviour, and ensure that every major feature delivers a consistent user experience.
- Software Architect: Aathi Shankar A (Software Architect)
  About: Aathi Shankar A contributes to CrowdCity AI as a Software Architect, focusing on system structure, scalability, and technical design. His role is to ensure that the platform is built on a reliable architecture capable of evolving with future requirements.
- DevOps Engineer: Padmadev D (DevOps Engineer)
  About: Padmadev D contributes as the DevOps Engineer, focusing on deployment, infrastructure, development workflows, and system reliability. He helps ensure that CrowdCity AI can move efficiently from development to a stable and maintainable production environment.

When asked about the founder, team members, developers, software architect, test engineer, devops engineer, or who created/built CrowdCity AI, ALWAYS answer accurately using the above team information.

Portal Guidance:
1. Help users file complaints (categories: roads, streetlights, water_supply, drainage, garbage, traffic, public_property, parks, sanitation, safety_hazard, environment, other). Explain required fields: title, description, location address, category, and photo evidence.
2. Explain complaint statuses:
   - "pending": Complaint is reported and logged.
   - "assigned": Dispatcher has delegated it to a specific inspector or authority team.
   - "in_progress": Crews are actively inspecting or repairing the issue.
   - "resolved": Completed successfully. The reporter earns points and verification badges.
   - "rejected": Not a valid hazard or outside city scope.
3. Explain gamification points:
   - Reporting complaints: +10 points.
   - Verified resolution: +50 points to reporter, +20 points to authority inspector.
   - Commenting on complaints: +5 points.
   - Upvoting complaints: +2 points.
   - Badge unlocks: +20 points bonus.
4. Explain Rank Levels: Civic Novice (<50), Local Watchdog (>=50), Civic Leader (>=150), City Legend (>=300).
5. Explain Badges: First Sentinel, Civic Champion, Voice of the City, Vocal Citizen, Urban Restorer.
6. Safety actions based on issue category:
   - Safety Hazard / Exposed electrical wires: Warn users to stay at least 30 feet away and dial emergency services (100) immediately.

Keep your responses concise, professional, and helpful. Do not output JSON, speak in plain conversational Markdown without emojis.`
  };

  if (!isGroqConfigured) {
    return res.status(503).json({ error: 'AI chatbot service is temporarily unconfigured. Please contact administrator.' });
  }

  try {
    // Verify the Groq SDK is initialized correctly
    const groq = new Groq({ apiKey: groqApiKey });
    
    const groqPayload = {
      model: model,
      messages: [systemMessage, ...messages]
    };

    // Detailed logging for Groq request
    logger.info('Executing Groq Chat Completion Request: %O', groqPayload);

    const chatCompletion = await groq.chat.completions.create(groqPayload);

    // Detailed logging for Groq response
    logger.info('Received Groq Chat Completion Response: %O', chatCompletion);

    const assistantMessage = chatCompletion.choices[0].message;

    return res.status(200).json({ message: assistantMessage });

  } catch (err) {
    logger.error('Groq Chat Completion Failed: %O', err);
    return res.status(500).json({
      error: 'Groq AI chatbot request failed',
      details: err.message
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
  const { docMeta, extractedText, scheme } = req.body;

  if (!docMeta) {
    return res.status(400).json({ error: 'Document metadata is required for verification' });
  }

  try {
    const report = await verifyDocumentReadiness(docMeta, extractedText || '', scheme || {});
    return res.status(200).json({ success: true, report });
  } catch (err) {
    logger.error('verifyDocumentController Error: %O', err);
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
 * POST /api/ai/analyze-image
 * Dedicated endpoint for Groq Vision AI camera image complaint detection.
 */
export const analyzeImageController = async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image data is required for visual AI detection.' });
  }

  try {
    const data = await analyzeComplaintImage(image);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('analyzeImageController Error: %O', err);
    return res.status(500).json({ error: 'Server error analyzing image with AI' });
  }
};









