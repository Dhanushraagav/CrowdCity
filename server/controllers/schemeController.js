import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// Canonical schemes dataset aligned with supabase/v2_government_schemes_seed.sql and client/js/services.js
export const CANONICAL_GOVERNMENT_SCHEMES = [
  {
    id: '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
    scheme_code: 'TN-KMUT-001',
    slug: 'tn-kmut',
    scheme_name: 'Kalaignar Magalir Urimai Thittam',
    scheme_name_ta: 'கலைஞர் மகளிர் உரிமைத் திட்டம்',
    department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'social',
    short_description: 'Monthly financial rights assistance of ₹1,000 for female heads of eligible households in Tamil Nadu.',
    benefits_summary: '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
    official_portal_url: 'https://kmut.tn.gov.in/',
    required_documents: ['Smart Family Card (Ration Card)', 'Aadhaar Card', 'Active Bank Passbook'],
    is_active: true
  },
  {
    id: '6edf49dc-795f-4369-b5ab-f72c24eddef8',
    scheme_code: 'TN-PUDHUMAI-002',
    slug: 'tn-pudhumai',
    scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
    scheme_name_ta: 'புதுமைப் பெண் திட்டம்',
    department_name: 'Higher Education Department, Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'education',
    short_description: 'Monthly financial assistance of ₹1,000 for girl students pursuing degree/diploma education after studying in TN Govt schools.',
    benefits_summary: '₹1,000 per month till completion of undergraduate degree, diploma, or ITI course.',
    official_portal_url: 'https://penkalvi.tn.gov.in/',
    required_documents: ['Govt School Study Certificate (Classes 6-12)', 'Aadhaar Card', 'College Admission Proof & ID', 'Student Bank Passbook'],
    is_active: true
  },
  {
    id: 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
    scheme_code: 'TN-NM-003',
    slug: 'tn-naanmudhalvan',
    scheme_name: 'Naan Mudhalvan Skill Development Scheme',
    scheme_name_ta: 'நான் முதல்வன் திறன் மேம்பாட்டுத் திட்டம்',
    department_name: 'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'skill',
    short_description: 'Statewide upskilling, technical mentoring, industry certifications, and campus placement drives.',
    benefits_summary: 'Free industry-aligned training courses, coding & AI modules, and direct corporate recruitment.',
    official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/',
    required_documents: ['College ID or Degree Marksheet', 'Aadhaar Card'],
    is_active: true
  },
  {
    id: '43e8ff6a-d3f3-4277-88f2-98c46491584e',
    scheme_code: 'TN-CMCHIS-004',
    slug: 'tn-cmchis',
    scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
    scheme_name_ta: 'முதலமைச்சரின் விரிவான மருத்துவக் காப்பீட்டுத் திட்டம்',
    department_name: 'Health & Family Welfare Department, Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'health',
    short_description: 'Cashless hospital treatment & surgical cover up to ₹5,00,000 per family per year in empanelled hospitals.',
    benefits_summary: 'Up to ₹5,00,000 cashless annual medical coverage for listed medical and surgical procedures.',
    official_portal_url: 'https://cmchistn.com/',
    required_documents: ['Smart Family Ration Card', 'Income Certificate (Income < ₹1,20,000)', 'Aadhaar Cards of Family Members'],
    is_active: true
  },
  {
    id: '43c6f25f-384b-4410-98ac-e747f0edeef7',
    scheme_code: 'TN-KKI-005',
    slug: 'tn-kanavuillam',
    scheme_name: 'Kalaignar Kanavu Illam Housing Scheme',
    scheme_name_ta: 'கலைஞர் கனவு இல்லம் திட்டம்',
    department_name: 'Rural Development & Panchayat Raj Department, Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'housing',
    short_description: 'Financial assistance of ₹3,50,000 to construct permanent concrete houses replacing thatched/hut dwellings.',
    benefits_summary: '₹3,50,000 unit assistance for constructing a minimum 360 sq.ft permanent pucca house.',
    official_portal_url: 'https://tnrd.tn.gov.in/',
    required_documents: ['House Site Patta / Title Deed', 'Smart Family Ration Card', 'Aadhaar Card', 'Bank Passbook'],
    is_active: true
  },
  {
    id: 'f0478621-f9c1-47c0-8306-af37d7ed5721',
    scheme_code: 'TN-UZHAVAR-006',
    slug: 'tn-uzhavar',
    scheme_name: 'TN Uzhavar Protection Scheme',
    scheme_name_ta: 'உழவர் பாதுகாப்புத் திட்டம்',
    department_name: 'Revenue & Disaster Management Department, Govt of Tamil Nadu',
    state_or_central: 'state',
    category: 'agriculture',
    short_description: 'Social security and accident insurance for farmers, agricultural laborers, and their dependent families.',
    benefits_summary: 'Accident relief up to ₹1,00,000, educational assistance for children, and pension for senior farmers.',
    official_portal_url: 'https://www.tn.gov.in/',
    required_documents: ['Uzhavar Board Membership Card', 'Aadhaar Card', 'Land/Adangal Documents or Labor Certificate'],
    is_active: true
  },
  {
    id: 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
    scheme_code: 'CENTRAL-PMKISAN-007',
    slug: 'central-pmkisan',
    scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
    scheme_name_ta: 'பிரதான் மந்திரி கிசான் சம்மான் நிதி',
    department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
    state_or_central: 'central',
    category: 'agriculture',
    short_description: 'Direct income support of ₹6,000 per year paid in 3 equal installments of ₹2,000 to landholding farmers.',
    benefits_summary: '₹6,000 annual direct bank transfer in three 4-monthly installments of ₹2,000 each.',
    official_portal_url: 'https://pmkisan.gov.in/',
    required_documents: ['Land Ownership Document (Patta / Chitta)', 'Aadhaar Card', 'Aadhaar-Linked Bank Account'],
    is_active: true
  },
  {
    id: 'd22faa80-2446-454f-8532-17429dcef2e6',
    scheme_code: 'CENTRAL-PMJAY-008',
    slug: 'central-pmjay',
    scheme_name: 'Ayushman Bharat PM-JAY',
    scheme_name_ta: 'ஆயுஷ்மான் பாரத் பிரதம மந்திரி ஜன் ஆரோக்கிய திட்டம்',
    department_name: 'National Health Authority (NHA), Ministry of Health, Govt of India',
    state_or_central: 'central',
    category: 'health',
    short_description: 'Health cover of ₹5,00,000 per family per year for secondary and tertiary care hospitalization across India.',
    benefits_summary: '₹5,00,000 cashless secondary and tertiary hospitalization in empaneled hospitals across India.',
    official_portal_url: 'https://pmjay.gov.in/',
    required_documents: ['Aadhaar Card', 'Ration Card', 'PM-JAY Family Letter or Ayushman Card'],
    is_active: true
  },
  {
    id: '5a00bef6-7053-4170-8604-8ac6b079a707',
    scheme_code: 'CENTRAL-PMMY-009',
    slug: 'central-mudra',
    scheme_name: 'Pradhan Mantri Mudra Yojana (PMMY)',
    scheme_name_ta: 'பிரதான் மந்திரி முத்ரா திட்டம்',
    department_name: 'Department of Financial Services, Ministry of Finance, Govt of India',
    state_or_central: 'central',
    category: 'business',
    short_description: 'Collateral-free micro-enterprise loans up to ₹10 Lakhs across Shishu, Kishor, and Tarun categories.',
    benefits_summary: 'Institutional credit up to ₹10,00,000 without collateral for non-corporate small business enterprises.',
    official_portal_url: 'https://www.mudra.org.in/',
    required_documents: ['Business Registration / MSME Udyam Registration', 'Aadhaar Card & PAN Card', '6-Month Bank Statement'],
    is_active: true
  },
  {
    id: '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
    scheme_code: 'CENTRAL-SSY-010',
    slug: 'central-ssy',
    scheme_name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
    scheme_name_ta: 'சுகன்யா சம்ரித்தி யோஜனா (செல்வமகள் சேமிப்புத் திட்டம்)',
    department_name: 'Department of Posts / Ministry of Finance, Govt of India',
    state_or_central: 'central',
    category: 'savings',
    short_description: 'High-interest tax-exempt savings scheme for girl children below 10 years of age with sovereign backing.',
    benefits_summary: '8.2% annual compounded interest, complete Section 80C tax exemption, and lump sum maturity at 21 years.',
    official_portal_url: 'https://www.indiapost.gov.in/',
    required_documents: ['Girl Child Birth Certificate', 'Parent/Guardian Aadhaar & PAN Card', 'Address Proof'],
    is_active: true
  },
  {
    id: '23914f21-21a9-4695-8784-680a9577879c',
    scheme_code: 'CENTRAL-PMAY-011',
    slug: 'central-pmay',
    scheme_name: 'Pradhan Mantri Awas Yojana (PMAY)',
    scheme_name_ta: 'பிரதான் மந்திரி ஆவாஸ் திட்டம்',
    department_name: 'Ministry of Housing & Urban Affairs / Ministry of Rural Development, Govt of India',
    state_or_central: 'central',
    category: 'housing',
    short_description: 'Credit-linked interest subsidy up to ₹2,67,000 or direct construction grant for affordable pucca housing.',
    benefits_summary: 'Interest subsidy on home loans or direct financial grant for construction of all-weather pucca house.',
    official_portal_url: 'https://pmaymis.gov.in/',
    required_documents: ['Land/House Ownership Documents', 'Income Certificate', 'Aadhaar Card', 'Bank Passbook'],
    is_active: true
  },
  {
    id: '8c887239-49c4-48de-8fee-5c305098b97d',
    scheme_code: 'CENTRAL-VIDYALAKSHMI-012',
    slug: 'central-vidyalakshmi',
    scheme_name: 'PM Vidya Lakshmi Education Loan Scheme',
    scheme_name_ta: 'பிஎம் வித்யா லட்சுமி கல்விக்கடன் திட்டம்',
    department_name: 'Department of Higher Education, Ministry of Education, Govt of India',
    state_or_central: 'central',
    category: 'education',
    short_description: 'Single-window electronic education loan portal offering collateral-free loans up to ₹7.5 Lakhs.',
    benefits_summary: 'Collateral-free higher education loans up to ₹7.5 Lakhs with central interest subsidy for eligible students.',
    official_portal_url: 'https://www.vidyalakshmi.co.in/',
    required_documents: ['Admission Letter with Course Fee Breakdown', '10th/12th/Graduation Marksheets', 'Student & Parent Aadhaar and PAN'],
    is_active: true
  }
];

/**
 * GET /api/schemes
 * Returns the list of active government welfare schemes.
 * Reusable canonical source for Government Schemes page, Form Assistant, and Scheme Checker.
 */
export const getAllSchemes = async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('government_schemes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return res.status(200).json({
          success: true,
          count: data.length,
          schemes: data,
          data: data // Supports both response.schemes and response.data
        });
      }
    }
  } catch (err) {
    logger.warn('Supabase query error in getAllSchemes, using canonical fallback: %s', err.message);
  }

  // Fallback to canonical dataset
  return res.status(200).json({
    success: true,
    count: CANONICAL_GOVERNMENT_SCHEMES.length,
    schemes: CANONICAL_GOVERNMENT_SCHEMES,
    data: CANONICAL_GOVERNMENT_SCHEMES
  });
};

/**
 * GET /api/schemes/:id
 * Returns a single scheme by ID, code, or slug.
 */
export const getSchemeById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Scheme identifier is required.' });
  }

  const clean = id.trim().toLowerCase();

  try {
    if (supabase) {
      // Try lookup by UUID, scheme_code, or slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      let query = supabase.from('government_schemes').select('*');
      if (isUuid) {
        query = query.eq('id', clean);
      } else {
        query = query.or(`scheme_code.ilike.${clean},scheme_name.ilike.%${clean}%`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return res.status(200).json({
          success: true,
          scheme: data[0],
          data: data[0]
        });
      }
    }
  } catch (err) {
    logger.warn('Supabase query error in getSchemeById: %s', err.message);
  }

  // Fallback lookup from canonical list
  const found = CANONICAL_GOVERNMENT_SCHEMES.find(s => 
    s.id.toLowerCase() === clean ||
    s.scheme_code.toLowerCase() === clean ||
    (s.slug && s.slug.toLowerCase() === clean) ||
    s.scheme_name.toLowerCase().includes(clean)
  );

  if (found) {
    return res.status(200).json({
      success: true,
      scheme: found,
      data: found
    });
  }

  return res.status(404).json({
    success: false,
    error: `Government scheme '${id}' not found.`
  });
};
