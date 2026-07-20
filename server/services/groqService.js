import Groq from 'groq-sdk';
import logger from '../config/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY;
const isGroqConfigured = groqApiKey && 
                         !groqApiKey.includes('your-groq-api-key') && 
                         groqApiKey !== '';

const groq = isGroqConfigured ? new Groq({ apiKey: groqApiKey }) : null;
const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Send complaint data to Groq to classify, summarize and route to department.
 * Falls back to local keyword-based mock analysis if Groq fails or is unconfigured.
 */
export const analyzeComplaint = async (title, description) => {
  if (!title || !description) {
    throw new Error('Title and description are required for Groq analysis.');
  }

  if (!groq) {
    logger.info('Groq SDK client unconfigured, using local rule-based fallback analyzer.');
    return getLocalFallbackAnalysis(title, description);
  }

  const systemPrompt = `You are a municipal hazard triage AI for CrowdCity AI. Analyze the user's civic issue report. You MUST output exactly one JSON object with:
1) "summary": a concise 1-sentence summary of the hazard.
2) "category": exactly one of ["Roads", "Streetlights", "Water Supply", "Drainage", "Garbage", "Traffic", "Public Property", "Parks", "Sanitation", "Safety Hazard", "Environment", "Other"].
3) "priority": exactly one of ["Low", "Medium", "High", "Critical"].
4) "department": exactly one of ["Road Department", "Sanitation Department", "Water Department", "Electrical Department", "General Department"].

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

