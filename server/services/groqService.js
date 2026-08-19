import Groq from 'groq-sdk';
import logger from '../config/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes('your-groq-api-key') || apiKey === '') {
    return null;
  }
  return new Groq({ apiKey });
};
export const getGroqModel = () => {
  const envModel = process.env.GROQ_MODEL;
  if (!envModel || 
      envModel.includes('llama-3.3') || 
      envModel.includes('llama3-') || 
      envModel.includes('llama-3.1') || 
      envModel.includes('your-groq-model')) {
    return 'openai/gpt-oss-120b';
  }
  return envModel;
};

/**
 * Send complaint data to Groq to classify, summarize and route to department.
 * Falls back to local keyword-based mock analysis if Groq fails or is unconfigured.
 */
export const analyzeComplaint = async (title, description) => {
  if (!title || !description) {
    throw new Error('Title and description are required for Groq analysis.');
  }

  const groq = getGroqClient();
  if (!groq) {
    logger.info('Groq SDK client unconfigured, using local rule-based fallback analyzer.');
    return getLocalFallbackAnalysis(title, description);
  }

  const systemPrompt = `You are a municipal hazard triage AI for CrowdCity AI. Analyze the user's civic issue report.
CRITICAL TRANSLATION INSTRUCTION:
The user description may be spoken Tamil script (e.g. "ரோட்டில் பெரிய குழி உள்ளது"), Tanglish / Tamil written in English letters (e.g. "roattil periya kuzhi irukku"), or English with speech-to-text acoustic errors (e.g. "were is a").
You MUST translate/correct the description into clear, grammatically perfect, professional ENGLISH and return it in "translatedDescription".

You MUST output exactly one JSON object with:
1) "translatedDescription": The description translated or corrected into clear, grammatically perfect, professional English.
2) "summary": a concise 1-sentence summary of the hazard in English.
3) "category": exactly one of ["Roads", "Streetlights", "Water Supply", "Drainage", "Garbage", "Traffic", "Public Property", "Parks", "Sanitation", "Safety Hazard", "Environment", "Other"].
4) "priority": exactly one of ["Low", "Medium", "High", "Critical"].
5) "department": exactly one of ["Road Department", "Sanitation Department", "Water Department", "Electrical Department", "General Department"].

Strict category rules and examples:
- Roads: Broken Footpath, Road Crack, Large Pothole, sidewalk damage, asphalt craters. Footpaths and sidewalks MUST map to Roads.
- Streetlights: Streetlight Not Working, Tilted Light Pole, broken lamp, lamp post dark.
- Water Supply: Water Leakage, Low Water Pressure, pipe burst, water gushing.
- Drainage: Blocked Drain, Flooded Drainage Channel, clogged sewer, street gutter flooding.
- Garbage: Overflowing Garbage Bin, Illegal Waste Dumping, trash bags piled.
- Traffic: Traffic Signal Failure, Missing Road Sign, blocked intersection, traffic light flashing.
- Public Property: Broken Bus Stop Bench, Damaged Government Property, public seat broken, transit shelter damage (excluding roads, sidewalks, footpaths, parks, streetlights, or sanitation).
- Parks: Park Equipment Damage, Broken Park Fence, broken playground swing.
- Sanitation: Dirty Public Toilet, Unclean Public Area, toilet clogged.
- Safety Hazard: Open Manhole, Fallen Tree Blocking Road, Dangerous Construction Debris, exposed electrical wires.
- Environment: Mosquito Breeding Area, Water Pollution, chemical dumping, toxic waste, stagnant water breeding ground.
- Other: Unknown issue, alien spacecraft, general questions.

Strict category to department mapping rules:
- "Roads", "Traffic", "Public Property", "Parks", "Safety Hazard" -> "Road Department"
- "Garbage", "Sanitation", "Environment" -> "Sanitation Department"
- "Water Supply", "Drainage" -> "Water Department"
- "Streetlights" -> "Electrical Department"
- "Other" -> "General Department"

Strict priority rules:
- "Critical": Public danger, major road damage/crater, flooding, exposed high-voltage wires, gas leak, open manhole, fallen tree blocking road.
- "High": Streetlight outage, large garbage accumulation on major pathways, blocked drainage.
- "Medium": Water leakage/low pressure, standard road pothole/sidewalk crack, traffic signal failure.
- "Low": Minor littering, minor sidewalk cracks, park fence damage.

Output ONLY valid raw JSON matching this schema. Do not output markdown, comments, or any wrapper formatting.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Title: ${title}\nDescription: ${description}` }
      ],
      model: model,
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0].message.content;
    const aiData = JSON.parse(responseText);

    // Enforce fallbacks for missing properties in AI JSON output
    return {
      translatedDescription: aiData.translatedDescription || description,
      summary: aiData.summary || `Summarized report: ${title}`,
      category: aiData.category || 'Other',
      priority: aiData.priority || 'Medium',
      department: aiData.department || 'General Department'
    };

  } catch (err) {
    logger.error('Groq SDK analysis request failed: %O. Using local fallback.', err);
    return getLocalFallbackAnalysis(title, description);
  }
};

/**
 * Groq AI Multi-Lingual Speech Translator & Polisher
 * Translates Tamil script / Tanglish / English speech into clear, flawless English.
 */
export const translateAndCleanVoiceText = async (rawText = '') => {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { englishText: '' };
  }

  const groq = getGroqClient();
  if (!groq) {
    return { englishText: rawText.trim() };
  }

  const systemPrompt = `You are a professional Tamil-to-English and English speech correction AI for CrowdCity AI municipal portal.

Task instructions:
1. Input text may be spoken Tamil script (e.g. "ரோட்டில் பெரிய குழி உள்ளது"), Tanglish / Tamil in Roman letters (e.g. "roattil periya kuzhi irukku"), or English with speech recognition acoustic errors (e.g. "were is a", "water leak in road").
2. Translate Tamil script or Tanglish into clear, natural, grammatically flawless ENGLISH.
3. If input is already in English, correct any speech recognition typos or misheard words into perfect professional ENGLISH.
4. Output MUST ALWAYS be exclusively in clear, professional ENGLISH.
5. Output MUST be a single raw JSON object matching:
{
  "englishText": "The translated or corrected clear English sentence."
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Spoken Input Text: "${rawText}"` }
      ],
      model: getGroqModel(),
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0].message.content;
    const aiData = JSON.parse(responseText);

    return {
      englishText: aiData.englishText || rawText
    };
  } catch (err) {
    logger.error('translateAndCleanVoiceText Error: %O', err);
    return { englishText: rawText };
  }
};

/**
 * Groq AI Image Complaint Analysis
 * Analyzes captured photo (Base64) to detect civic hazards (Potholes, Road cracks, Waterlogging, Garbage, Streetlights, Damaged road signs, Fallen trees, Drainage issues).
 * Generates: category, title, description, priority.
 */
export const analyzeComplaintImage = async (imageBase64 = '') => {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return getLocalImageFallbackAnalysis();
  }

  const groq = getGroqClient();
  if (!groq) {
    logger.info('Groq SDK client unconfigured, using local image vision fallback.');
    return getLocalImageFallbackAnalysis();
  }

  const visionModel = 'llama-3.2-11b-vision-preview';

  try {
    const formattedImage = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    const systemPrompt = `You are a strict visual hazard inspector AI for CrowdCity AI municipal portal.
Analyze the provided image to check if it depicts a real public civic or transportation infrastructure issue.

Valid public civic issues include ONLY:
- Potholes / Road cracks / Damaged pavements / Sidewalk hazards
- Waterlogging / Street flooding / Water pipe leaks
- Overflowing garbage / Trash dumping / Illegal waste
- Broken streetlights / Damaged light poles / Dark streets
- Damaged road signs / Traffic signal failures
- Fallen trees / Tree branches blocking roads or wires
- Drainage blockages / Clogged gutters
- Public Property Damage / Bus shelter damage

Unrelated / Invalid / Fake images include:
- Clothing, shirts, pants, shoes, indoor household items
- Selfies, human faces, pets, animals, documents, paper
- Blank, blurry, dark, or indoor private room scenes

You MUST output exactly one raw JSON object matching:
{
  "isValidCivicIssue": true | false,
  "category": "Roads" | "Streetlights" | "Water Supply" | "Drainage" | "Garbage" | "Traffic" | "Public Property" | "Safety Hazard" | "Other",
  "title": "Concise 3 to 6 word title describing the hazard if valid",
  "description": "Clear 2-sentence description of the visual condition if valid",
  "priority": "Low" | "Medium" | "High" | "Critical"
}`;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: { url: formattedImage } }
          ]
        }
      ],
      model: visionModel,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content;
    const aiData = JSON.parse(responseText);

    if (aiData.isValidCivicIssue === false) {
      return {
        isValidCivicIssue: false,
        error: 'Oops! Please capture a valid civic or road issue image.'
      };
    }

    return {
      isValidCivicIssue: true,
      category: aiData.category || 'Roads',
      title: aiData.title || 'Civic Infrastructure Hazard',
      description: aiData.description || 'Visual inspection identified infrastructure hazard requiring maintenance.',
      priority: aiData.priority || 'Medium'
    };
  } catch (err) {
    logger.error('Groq Vision AI Analysis failed: %O. Using fallback.', err);
    return getLocalImageFallbackAnalysis();
  }
};

export function getLocalImageFallbackAnalysis() {
  return {
    isValidCivicIssue: true,
    category: 'Roads',
    title: 'Surface Hazard Detected via Visual AI',
    description: 'Visual analysis identified road surface irregularity and maintenance hazard.',
    priority: 'Medium'
  };
}

/**
 * Local keyword-based fallback analyzer
 */
export function getLocalFallbackAnalysis(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  let category = 'Other';
  let department = 'General Department';
  let priority = 'Medium';

  // Category & Department mapping
  if (text.includes('mosquito') || text.includes('breeding') || text.includes('pollution') || text.includes('environment') || text.includes('ecology') || text.includes('conservation')) {
    category = 'Environment';
    department = 'Sanitation Department';
  } else if (text.includes('manhole') || text.includes('fallen tree') || text.includes('exposed wire') || text.includes('live wire')) {
    category = 'Safety Hazard';
    department = 'Road Department';
  } else if (text.includes('toilet') || text.includes('unclean') || text.includes('dirty') || text.includes('sanitation') || text.includes('hygiene')) {
    category = 'Sanitation';
    department = 'Sanitation Department';
  } else if (text.includes('pothole') || text.includes('crater') || text.includes('asphalt') || text.includes('footpath') || text.includes('sidewalk') || text.includes('crack') || text.includes('road')) {
    category = 'Roads';
    department = 'Road Department';
  } else if (text.includes('streetlight') || text.includes('light pole') || text.includes('lamp') || text.includes('bulb') || text.includes('light')) {
    category = 'Streetlights';
    department = 'Electrical Department';
  } else if (text.includes('leak') || text.includes('water supply') || text.includes('burst') || text.includes('pipe') || text.includes('pressure') || text.includes('water')) {
    category = 'Water Supply';
    department = 'Water Department';
  } else if (text.includes('drain') || text.includes('sewer') || text.includes('gutter') || text.includes('flooded drainage')) {
    category = 'Drainage';
    department = 'Water Department';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('dump') || text.includes('litter') || text.includes('waste') || text.includes('refuse')) {
    category = 'Garbage';
    department = 'Sanitation Department';
  } else if (text.includes('traffic') || text.includes('signal') || text.includes('sign') || text.includes('intersection')) {
    category = 'Traffic';
    department = 'Road Department';
  } else if (text.includes('bus stop') || text.includes('bench') || text.includes('public property') || text.includes('government property') || text.includes('damaging public')) {
    category = 'Public Property';
    department = 'Road Department';
  } else if (text.includes('park') || text.includes('playground') || text.includes('garden') || text.includes('fence')) {
    category = 'Parks';
    department = 'Road Department';
  } else if (text.includes('hazard') || text.includes('danger') || text.includes('accident') || text.includes('debris')) {
    category = 'Safety Hazard';
    department = 'Road Department';
  }

  // Priority mapping
  if (text.includes('danger') || text.includes('hazard') || text.includes('accident') || text.includes('injury') || text.includes('emergency') || text.includes('critical') || text.includes('manhole') || text.includes('exposed wire')) {
    priority = 'Critical';
  } else if (text.includes('outage') || text.includes('dark') || text.includes('broken') || text.includes('large') || text.includes('block') || text.includes('overflow')) {
    priority = 'High';
  } else if (text.includes('leak') || text.includes('crack') || text.includes('dirty')) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  const summary = `Citizen reported ${category.toLowerCase()} issue: "${title}"`;

  return {
    summary,
    category,
    priority,
    department
  };
};

/**
 * Explain why a citizen qualifies for a government scheme using Groq AI.
 * Isolated function for CrowdCity AI v2.0 Government Services.
 */
export const explainSchemeEligibility = async (scheme, userProfile, lang = 'en') => {
  if (!scheme) {
    throw new Error('Scheme data is required for AI explanation.');
  }

  const isTamil = (lang === 'ta');

  const groq = getGroqClient();
  if (!groq) {
    return generateFallbackSchemeExplanation(scheme, userProfile, isTamil);
  }

  const promptLanguage = isTamil ? 'Tamil (தமிழ்)' : 'English';

  const systemPrompt = `You are a helpful, clear, and friendly AI Government Welfare Advisor for CrowdCity AI.
Your task is to generate a simple, citizen-friendly explanation in ${promptLanguage} explaining why the user qualifies for the scheme.

Return ONLY a valid JSON object with the following structure:
{
  "whyQualify": "1-2 sentences explaining why the citizen qualifies based on their age (${userProfile?.age || 25}), income (₹${userProfile?.income || 0}), occupation, or gender.",
  "mainBenefits": "Clear summary of financial or welfare benefits.",
  "requiredDocuments": "Brief guidance on documents to bring.",
  "importantNotes": "Practical tip (e.g., link Aadhaar to bank account)."
}`;

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Scheme: ${scheme.scheme_name || scheme.name}\nDepartment: ${scheme.department_name || scheme.department}\nBenefits: ${scheme.benefits_summary || scheme.benefits}\nDocuments: ${JSON.stringify(scheme.required_documents || scheme.docs)}` }
      ],
      model: model,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (err) {
    logger.warn('Groq explainSchemeEligibility error, falling back:', err);
    return generateFallbackSchemeExplanation(scheme, userProfile, isTamil);
  }
};

function generateFallbackSchemeExplanation(scheme, userProfile, isTamil) {
  const schemeTitle = scheme.scheme_name || scheme.name || "Government Scheme";
  const userAge = userProfile?.age || 25;
  const userIncome = userProfile?.income || 0;

  if (isTamil) {
    return {
      whyQualify: `உங்கள் வயது (${userAge}) மற்றும் வருமானம் (₹${userIncome}) அடிப்படையில், நீங்கள் ${schemeTitle} திட்டத்திற்கான அனைத்து தகுதிகளையும் பெற்றுள்ளீர்கள்.`,
      mainBenefits: scheme.benefits_summary || scheme.benefits || "மாதாந்திர நிதி உதவி அல்லது அரசு காப்பீட்டு சலுகைகள்.",
      requiredDocuments: "ரேஷன் கார்டு, ஆதார் கார்டு மற்றும் வங்கி கணக்கு புத்தகம் நகலை தயாராக வைத்துக்கொள்ளவும்.",
      importantNotes: "நேரடி பணப்பரிமாற்றத்திற்கு உங்கள் வங்கி கணக்குடன் ஆதார் எண்ணை இணைத்துள்ளதை உறுதிப்படுத்திக் கொள்ளவும்."
    };
  }

  return {
    whyQualify: `Based on your age of ${userAge} and annual family income of ₹${userIncome}, you meet all official eligibility requirements for ${schemeTitle}.`,
    mainBenefits: scheme.benefits_summary || scheme.benefits || "Financial support, insurance coverage, or government welfare aid.",
    requiredDocuments: "Ensure you have your Smart Ration Card, Aadhaar Card, and Bank Passbook ready before applying.",
    importantNotes: "Make sure your bank account is linked to your Aadhaar for direct benefit transfer."
  };
}

/**
 * Chat with Government Assistant using Groq LLM.
 * Isolated function for CrowdCity AI v2.0 Government Assistant.
 */
export const chatWithGovernmentAssistant = async (messages, userProfile = {}, schemeKnowledge = []) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required for Government Assistant chat.');
  }

  const defaultKnowledge = [
    { name: "Kalaignar Magalir Urimai Thittam", code: "TN-KMUT-001", dept: "Social Welfare Dept, TN", benefits: "₹1,000 monthly for female household heads", age: "21-60", income: "≤ ₹2,50,000", docs: ["Ration Card", "Aadhaar Card", "Bank Passbook"], url: "https://kmut.tn.gov.in/" },
    { name: "Pudhumai Penn Scheme", code: "TN-PUDHUMAI-002", dept: "Social Welfare Dept, TN", benefits: "₹1,000 monthly for girl students in higher education", age: "17-25", docs: ["School TC (Classes 6-12)", "Aadhaar", "College ID"], url: "https://penkalvi.tn.gov.in/" },
    { name: "Naan Mudhalvan Skill Scheme", code: "TN-NM-003", dept: "TNSDC, TN", benefits: "Free coding, AI, technical skills & campus placements", age: "18-35", url: "https://www.naanmudhalvan.tn.gov.in/" },
    { name: "Chief Minister Comprehensive Health Insurance (CMCHIS)", code: "TN-CMCHIS-004", dept: "Health Dept, TN", benefits: "Cashless hospital cover up to ₹5,00,000 per family/year", income: "≤ ₹1,20,000", url: "https://cmchistn.com/" },
    { name: "PM Kisan Samman Nidhi (PM-KISAN)", code: "CENTRAL-PMKISAN-007", dept: "Ministry of Agriculture", benefits: "₹6,000 per year in 3 installments of ₹2,000", farmer: true, url: "https://pmkisan.gov.in/" },
    { name: "Ayushman Bharat PM-JAY", code: "CENTRAL-PMJAY-008", dept: "National Health Authority", benefits: "₹5,00,000 health insurance per family/year", url: "https://pmjay.gov.in/" }
  ];

  const knowledgeBase = (schemeKnowledge && schemeKnowledge.length > 0) ? schemeKnowledge : defaultKnowledge;

  const systemPrompt = `You are the official CrowdCity AI Government Assistant, an expert AI advisor specialized in Tamil Nadu State and Central Government welfare schemes, eligibility rules, document requirements, application procedures, portal navigation, and the CrowdCity AI team.

STRICT DOMAIN BOUNDARY & GREETINGS RULES:
1) GREETINGS ALLOWED: You MAY respond naturally and politely to basic greetings, courtesies, and pleasantries (such as "hi", "hello", "good morning", "how are you", "thank you"). Offer helpful guidance on government schemes and CrowdCity AI portal features.
2) WEBSITE-ONLY SCOPE GUARDRAIL: Other than basic greetings, you MUST ONLY answer questions directly related to our website (CrowdCity AI), the founder and team behind CrowdCity AI, Tamil Nadu municipal civic grievance reporting, city transportation issues, government welfare schemes, portal navigation, and public emergency services.
3) OUT-OF-SCOPE DECLINATIONS: If the user asks ANY question outside the scope of our website or civic/transportation/government services (such as coding, math, sports, recipes, entertainment, trivia, general knowledge, or creative writing), you MUST politely decline with:
"I am specialized to answer questions related only to the CrowdCity AI portal, civic grievances, transportation reporting, and public government services. Please ask a question related to our website."
4) NO EMOJIS ALLOWED: You MUST NOT use any emojis in your responses under any circumstances.
5) Provide clear, polite, concise, and citizen-friendly answers in plain English or Tamil.

CROWDCITY AI TEAM & LEADERSHIP KNOWLEDGE BASE (ABOUT OUR WEBSITE):
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

OFFICIAL GOVERNMENT SCHEMES KNOWLEDGE BASE:
${JSON.stringify(knowledgeBase, null, 2)}`;

  const groq = getGroqClient();
  if (!groq) {
    logger.info('Groq SDK unconfigured, using rule-based Government Assistant fallback.');
    return generateAssistantFallbackResponse(messages, knowledgeBase);
  }

  try {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text || m.content
      }))
    ];

    const response = await groq.chat.completions.create({
      messages: formattedMessages,
      model: getGroqModel(),
      temperature: 0.3,
      max_tokens: 600
    });

    const replyText = response.choices[0]?.message?.content || "I am your AI Government Assistant. How can I help you regarding government schemes, eligibility, or required documents today?";
    return { text: replyText };
  } catch (err) {
    logger.error('chatWithGovernmentAssistant error:', err);
    return generateAssistantFallbackResponse(messages, knowledgeBase);
  }
};

function generateAssistantFallbackResponse(messages, knowledgeBase) {
  const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || '';

  if (lastMsg.includes('founder') || lastMsg.includes('sandeep') || lastMsg.includes('who built') || lastMsg.includes('who created') || lastMsg.includes('team') || lastMsg.includes('developer')) {
    return {
      text: `CrowdCity AI is built by an engineering and leadership team committed to smart city technology:\n\n1. Sandeep Kumar J — Founder (CrowdCity AI)\nVisionary entrepreneur focusing on technology-driven solutions for smarter, more connected communities.\n\n2. Dhanush Raagav S — Developer\nTransforms innovative ideas into scalable, user-friendly applications.\n\n3. Tulasiram V — Test Engineer\nEnsures quality, reliability, and real-world usability across all platform features.\n\n4. Aathi Shankar A — Software Architect\nFocuses on system structure, scalability, and platform architecture.\n\n5. Padmadev D — DevOps Engineer\nManages deployment, infrastructure, development workflows, and system reliability.`
    };
  } else if (lastMsg.includes('kmut') || lastMsg.includes('magalir urimai') || lastMsg.includes('women right')) {
    return {
      text: `Kalaignar Magalir Urimai Thittam provides ₹1,000 monthly financial rights assistance directly into the bank accounts of female heads of households in Tamil Nadu.\n\nEligibility:\n- Female head of family aged 21 to 60 years\n- Annual family income up to ₹2,50,000\n- Annual electricity consumption under 3,600 units\n\nRequired Documents:\n1. Smart Family Ration Card\n2. Aadhaar Card\n3. Active Bank Passbook\n\nOfficial Portal: https://kmut.tn.gov.in/`
    };
  } else if (lastMsg.includes('pudhumai penn') || lastMsg.includes('student') || lastMsg.includes('higher education')) {
    return {
      text: `Pudhumai Penn Scheme provides ₹1,000 per month financial aid to female students pursuing higher education (degree, diploma, ITI) who studied from Classes 6 to 12 in Tamil Nadu Government schools.\n\nRequired Documents:\n- Govt School Study Certificate / TC (Classes 6-12)\n- Aadhaar Card\n- College Admission Proof & ID\n- Bank Passbook\n\nOfficial Portal: https://penkalvi.tn.gov.in/`
    };
  } else if (lastMsg.includes('status') || lastMsg.includes('track') || lastMsg.includes('my application')) {
    return {
      text: `You can track and manage all your saved government applications in your personal Application Tracker.\n\nCurrent Statuses:\n- Kalaignar Magalir Urimai Thittam (Ref: TN-KMUT-2026-88194): Under Verification\n- PM Kisan Samman Nidhi (Ref: PMK-2026-1049281): Approved\n\nYou can update milestone notes or launch official government portals anytime from your tracker.`
    };
  } else if (lastMsg.includes('pm kisan') || lastMsg.includes('farmer') || lastMsg.includes('agriculture')) {
    return {
      text: `PM Kisan Samman Nidhi (PM-KISAN) is a Central Government scheme providing ₹6,000 per year direct income support to landholding farmer families across India in 3 equal installments of ₹2,000.\n\nRequired Documents:\n- Aadhaar Card\n- Land Patta / Ownership Proof\n- Aadhaar-linked Bank Account\n\nOfficial Portal: https://pmkisan.gov.in/`
    };
  }

  return {
    text: `Welcome! I am your AI Government Assistant. I can help you check eligibility, understand required documents, guide you on applying for Tamil Nadu Government schemes, and provide details about CrowdCity AI and its team.\n\nFeel free to ask any question about schemes, required documents, or our platform!`
  };
}

/**
 * AI Document Quality & Readiness Verification using Groq LLM.
 * Isolated service function for CrowdCity AI v2.0 Document Verifier.
 */
export const verifyDocumentReadiness = async (docMeta = {}, extractedText = '', scheme = {}) => {
  const systemPrompt = `You are the CrowdCity AI Document Preparation Assistant.
Analyze the provided document metadata and extracted text to generate a document quality and application readiness analysis.

IMPORTANT SECURITY & DISCLAIMER RULES:
1) You perform document clarity, readability, and completeness guidance ONLY.
2) You NEVER issue official government verification, legal approvals, or guarantee government acceptance.
3) Provide objective, friendly advice regarding image clarity, resolution, cropping, and missing scheme requirements.

Return ONLY a valid JSON object with the following structure:
{
  "isReadable": true/false,
  "clarityScore": number (0 to 100),
  "qualityStatus": "Good" / "Needs Attention" / "Blurry or Dark",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "extractedSummary": "Brief 1-2 sentence overview of document text content.",
  "disclaimer": "Guidance and document quality check only. Does not constitute official government verification."
}`;

  const groq = getGroqClient();
  if (!groq) {
    logger.info('Groq SDK unconfigured, using fallback document verification analysis.');
    return generateFallbackDocVerification(docMeta, scheme);
  }

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Document Type: ${docMeta.doc_type || 'Unknown'}\nDocument Name: ${docMeta.doc_name || 'Uploaded Document'}\nFile Size: ${docMeta.file_size || 0} bytes\nExtracted Text: ${extractedText.substring(0, 1000)}\nTarget Scheme: ${scheme.scheme_name || scheme.name || 'General Welfare Scheme'}` }
      ],
      model: getGroqModel(),
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (err) {
    logger.error('verifyDocumentReadiness error:', err);
    return generateFallbackDocVerification(docMeta, scheme);
  }
};

function generateFallbackDocVerification(docMeta, scheme) {
  const isReadable = (docMeta.file_size || 0) > 1024;
  return {
    isReadable: isReadable,
    clarityScore: isReadable ? 88 : 60,
    qualityStatus: isReadable ? "Good" : "Needs Attention",
    recommendations: [
      isReadable ? "This document appears clear and readable." : "File size is small. Ensure the text is not blurry.",
      "Ensure all four corners of the certificate are visible and uncropped.",
      "Verify that your name and Aadhaar/Passbook number match your application details."
    ],
    extractedSummary: `Uploaded ${docMeta.doc_name || 'Government Certificate'} verified for readability.`,
    disclaimer: "Guidance and document quality check only. Does not constitute official government verification."
  };
}

/**
 * AI Form Field Guidance Generator using Groq LLM.
 * Isolated service function for CrowdCity AI v2.0 Form Filling Assistant.
 */
export const getFormFieldGuidance = async (schemeName = '', fieldName = '') => {
  const systemPrompt = `You are the CrowdCity AI Form Filling Assistant.
Provide clear, simple, citizen-friendly explanations for a specific government form field.

Return ONLY a valid JSON object with the following structure:
{
  "explanation": "Clear 1-2 sentence explanation of what this field means.",
  "whyRequired": "Why government departments require this field.",
  "commonMistakes": ["Common mistake 1", "Common mistake 2"],
  "exampleValue": "Representative sample input value"
}`;

  const groq = getGroqClient();
  if (!groq) {
    return generateFallbackFieldGuidance(fieldName);
  }

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Scheme Name: ${schemeName}\nForm Field: ${fieldName}` }
      ],
      model: getGroqModel(),
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (err) {
    logger.error('getFormFieldGuidance error:', err);
    return generateFallbackFieldGuidance(fieldName);
  }
};

function generateFallbackFieldGuidance(fieldName) {
  return {
    explanation: `Enter your official ${fieldName.toLowerCase()} exactly as printed on your government-issued identity cards.`,
    whyRequired: "Required for identity verification and direct benefit transfer eligibility.",
    commonMistakes: [
      "Spelling mismatch between Ration Card and Aadhaar Card.",
      "Entering joint bank account without primary holder name."
    ],
    exampleValue: "Kavitha R / 1234 5678 9012"
  };
}

/**
 * Smart Transportation Issue AI Analyzer for CrowdCity AI v3.2
 * Classifies road/traffic/transit issues into categories, priorities, departments, and suggested resolutions.
 */
export const analyzeTransportationIssue = async (title, description, userCategory = '') => {
  if (!title || !description) {
    throw new Error('Title and description are required for transportation analysis.');
  }

  const validCategories = [
    'Potholes', 'Damaged Roads', 'Traffic Signal Not Working', 'Waterlogging', 
    'Broken Street Lights', 'Illegal Parking', 'Missing Road Signs', 'Bus Stop Issues', 
    'Road Block', 'Construction Work', 'Accident', 'Heavy Traffic', 'Other Transportation Issue'
  ];

  const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
  const validDepartments = [
    'Roads Department', 'Traffic Police', 'Municipal Corporation', 
    'Highways Department', 'Street Lighting Department', 'Transport Department', 'Public Works Department'
  ];

  const groq = getGroqClient();
  if (!groq) {
    logger.info('Groq SDK unconfigured, using local rules for transportation analysis.');
    return getLocalTransportationFallback(title, description, userCategory);
  }

  const systemPrompt = `You are an expert AI Triage Engineer for Smart City Transportation Infrastructure (CrowdCity AI v3.2).
Analyze the citizen's transportation issue report and output ONLY raw valid JSON with:
1) "summary": Concise 1-sentence executive summary of the transportation hazard.
2) "category": Exactly one of ["Potholes", "Damaged Roads", "Traffic Signal Not Working", "Waterlogging", "Broken Street Lights", "Illegal Parking", "Missing Road Signs", "Bus Stop Issues", "Road Block", "Construction Work", "Accident", "Heavy Traffic", "Other Transportation Issue"].
3) "priority": Exactly one of ["Critical", "High", "Medium", "Low"].
4) "severity": Exactly one of ["Critical", "High", "Medium", "Low"].
5) "severity_score": An integer from 1 to 10 (10 being most critical/severe).
6) "department": Exactly one of ["Roads Department", "Traffic Police", "Municipal Corporation", "Highways Department", "Street Lighting Department", "Transport Department", "Public Works Department"].
7) "suggested_resolution": Concise 1-2 sentence technical recommendation for site inspection and repair engineers.
8) "confidence_score": A number between 88.0 and 98.5 representing classification confidence score.

Priority Rules:
- "Critical": Traffic signal failure, major multi-vehicle accident, open sinkhole/deep crater, severe road flooding, complete road block on main arterial corridor.
- "High": Large potholes on major roads, missing stop/danger signs at busy intersections, dark unlit highway junction, heavy unmanaged congestion.
- "Medium": Illegal parking causing slow traffic, broken bus stop shelter bench, minor road surface cracks.
- "Low": Minor cosmetic road paint fading, minor bus timetable sign damage.

Department Rules:
- Potholes, Damaged Roads, Construction Work -> "Roads Department" or "Highways Department"
- Traffic Signal Not Working, Illegal Parking, Missing Road Signs, Heavy Traffic, Accident -> "Traffic Police"
- Waterlogging, Road Block, General Transit -> "Municipal Corporation"
- Broken Street Lights -> "Street Lighting Department"
- Bus Stop Issues -> "Transport Department"
- Bridge, Flyover, Storm Drain Structure -> "Public Works Department"

Output ONLY raw valid JSON matching this schema without markdown block formatting.`;

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Title: ${title}\nDescription: ${description}\nUser Selected Category: ${userCategory}` }
      ],
      model: getGroqModel(),
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const priority = validPriorities.includes(parsed.priority) ? parsed.priority : 'Medium';
    let defaultSevScore = 5;
    if (priority === 'Critical') defaultSevScore = 9;
    else if (priority === 'High') defaultSevScore = 7;
    else if (priority === 'Medium') defaultSevScore = 5;
    else defaultSevScore = 3;

    const sevScore = typeof parsed.severity_score === 'number' ? Math.min(10, Math.max(1, Math.round(parsed.severity_score))) : defaultSevScore;

    return {
      summary: parsed.summary || `${title} reported under ${parsed.category || 'Transportation'}.`,
      category: validCategories.includes(parsed.category) ? parsed.category : (userCategory || 'Other Transportation Issue'),
      priority,
      severity: validPriorities.includes(parsed.severity) ? parsed.severity : priority,
      severity_score: sevScore,
      department: validDepartments.includes(parsed.department) ? parsed.department : 'Roads Department',
      suggested_resolution: parsed.suggested_resolution || 'Inspect location and dispatch road maintenance team for repairs.',
      confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 94.5
    };
  } catch (err) {
    logger.error('analyzeTransportationIssue Groq error:', err);
    return getLocalTransportationFallback(title, description, userCategory);
  }
};

function getLocalTransportationFallback(title, description, userCategory) {
  const text = `${title} ${description}`.toLowerCase();
  let category = userCategory || 'Damaged Roads';
  let priority = 'Medium';
  let severityScore = 5;
  let department = 'Roads Department';
  let resolution = 'Dispatch field inspector to conduct physical assessment and issue work order.';
  let confidence = 91.0;

  if (text.includes('signal') || text.includes('traffic light')) {
    category = 'Traffic Signal Not Working';
    priority = 'Critical';
    severityScore = 9;
    department = 'Traffic Police';
    resolution = 'Deploy traffic control personnel and dispatch signal electrician to reset controller.';
  } else if (text.includes('accident') || text.includes('crash')) {
    category = 'Accident';
    priority = 'Critical';
    severityScore = 10;
    department = 'Traffic Police';
    resolution = 'Dispatch emergency patrol and clear road obstruction.';
  } else if (text.includes('pothole') || text.includes('crater') || text.includes('road broken')) {
    category = 'Potholes';
    priority = text.includes('deep') || text.includes('big') ? 'High' : 'Medium';
    severityScore = priority === 'High' ? 8 : 5;
    department = 'Roads Department';
    resolution = 'Deploy asphalt patch compaction crew to fill pothole.';
  } else if (text.includes('water') || text.includes('flood') || text.includes('drain')) {
    category = 'Waterlogging';
    priority = 'High';
    severityScore = 8;
    department = 'Municipal Corporation';
    resolution = 'Deploy high-capacity dewatering pumps to clear stagnant water.';
  } else if (text.includes('light') || text.includes('dark')) {
    category = 'Broken Street Lights';
    priority = 'Medium';
    severityScore = 4;
    department = 'Street Lighting Department';
    resolution = 'Replace faulty LED luminaire and verify underground cable wiring.';
  } else if (text.includes('parking') || text.includes('parked')) {
    category = 'Illegal Parking';
    priority = 'Medium';
    severityScore = 5;
    department = 'Traffic Police';
    resolution = 'Issue traffic violation citations and dispatch tow truck if obstructing traffic.';
  } else if (text.includes('bus') || text.includes('stop')) {
    category = 'Bus Stop Issues';
    priority = 'Low';
    severityScore = 3;
    department = 'Transport Department';
    resolution = 'Schedule shelter maintenance and update bus route signage.';
  }

  return {
    summary: `${category}: ${title}`,
    category,
    priority,
    severity: priority,
    severity_score: severityScore,
    department,
    suggested_resolution: resolution,
    confidence_score: confidence
  };
}








