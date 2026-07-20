-- ============================================================================
-- CrowdCity AI v2.0 - Government Schemes Seed Data
-- Module: Government Scheme Eligibility Checker (Modular & Isolated)
-- Contains: Tamil Nadu State & Central Government Welfare Schemes
-- ============================================================================

-- 1. Ensure Scheme Categories exist
INSERT INTO public.scheme_categories (category_name, category_code, description, icon_name)
VALUES
  ('Women Welfare & Financial Support', 'women_welfare', 'Welfare schemes providing financial assistance, pensions, and empowerment for women.', 'fa-person-dress'),
  ('Education & Scholarships', 'education', 'Scholarships, free laptops, higher education incentives, and student aid.', 'fa-graduation-cap'),
  ('Agriculture & Farming', 'agriculture', 'Crop insurance, fertilizer subsidies, machinery grants, and farmer income support.', 'fa-wheat-awn'),
  ('Healthcare & Insurance', 'healthcare', 'Comprehensive health cover, medical assistance, and maternal care.', 'fa-heart-pulse'),
  ('Housing & Infrastructure', 'housing', 'Free house site patta, subsidized housing construction, and rural housing schemes.', 'fa-house-user'),
  ('Employment & Skill Development', 'employment', 'Self-employment loans, skill training programs, and youth entrepreneurship funds.', 'fa-briefcase')
ON CONFLICT (category_code) DO NOTHING;

-- 2. Populate Tamil Nadu & Central Government Schemes
INSERT INTO public.government_schemes (
  category_id,
  scheme_name,
  scheme_code,
  department_name,
  state_or_central,
  short_description,
  detailed_description,
  eligibility_criteria,
  benefits_summary,
  required_documents,
  official_portal_url,
  application_fee,
  is_active
)
VALUES
  -- --------------------------------------------------------------------------
  -- 1. Kalaignar Magalir Urimai Thittam (Tamil Nadu)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'women_welfare' LIMIT 1),
    'Kalaignar Magalir Urimai Thittam',
    'TN-KMUT-001',
    'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
    'state',
    'Monthly financial rights assistance of ₹1,000 for women heads of households in Tamil Nadu.',
    'Kalaignar Magalir Urimai Thittam provides direct monthly financial assistance to eligible female heads of families in Tamil Nadu to improve economic independence and livelihood security.',
    '{
      "min_age": 21,
      "max_age": 60,
      "gender": "female",
      "max_annual_income": 250000,
      "state": "Tamil Nadu",
      "occupation": "Household Head / Self-Employed / Worker",
      "electricity_consumption_max_units_per_year": 3600
    }'::jsonb,
    '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
    '["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"]'::jsonb,
    'https://kmut.tn.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 2. Pudhumai Penn Scheme (Tamil Nadu)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'education' LIMIT 1),
    'Pudhumai Penn Scheme (Higher Education Assurance)',
    'TN-PUDHUMAI-002',
    'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
    'state',
    'Monthly financial support of ₹1,000 for girl students pursuing degree/diploma education.',
    'Under the Pudhumai Penn scheme, female students who completed their schooling from Classes 6 to 12 in Tamil Nadu Government schools receive ₹1,000 per month during their higher education studies.',
    '{
      "min_age": 17,
      "max_age": 25,
      "gender": "female",
      "is_student": true,
      "govt_school_studied_classes": "6 to 12",
      "state": "Tamil Nadu"
    }'::jsonb,
    '₹1,000 monthly financial aid until graduation or completion of diploma course.',
    '["Govt School Transfer Certificate / Study Proof (6th-12th)", "Aadhaar Card", "College Admission ID / Receipt", "Bank Passbook"]'::jsonb,
    'https://penkalvi.tn.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 3. Naan Mudhalvan Skill & Placement Scheme (Tamil Nadu)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'employment' LIMIT 1),
    'Naan Mudhalvan Skill Development Scheme',
    'TN-NM-003',
    'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
    'state',
    'Statewide skill enhancement and career placement platform for college students & youth.',
    'Naan Mudhalvan equips college students and job seekers across Tamil Nadu with industry-relevant technical, coding, engineering, soft skills, and direct campus placement opportunities.',
    '{
      "min_age": 18,
      "max_age": 35,
      "gender": "all",
      "occupation": "Student / Graduate / Job Seeker",
      "state": "Tamil Nadu"
    }'::jsonb,
    'Free high-value industry certification courses, mentorship, AI skill modules, and direct employment drives.',
    '["College ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate", "Resume / Bio-data"]'::jsonb,
    'https://www.naanmudhalvan.tn.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 4. CM Comprehensive Health Insurance Scheme (CMCHIS - Tamil Nadu)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'healthcare' LIMIT 1),
    'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
    'TN-CMCHIS-004',
    'Health & Family Welfare Department, Govt of Tamil Nadu',
    'state',
    'Cashless medical and surgical treatment cover up to ₹5,00,000 per family per year.',
    'CMCHIS delivers comprehensive health coverage for low-income families in Tamil Nadu for listed medical procedures, surgeries, and critical care in government and private empanelled hospitals.',
    '{
      "max_annual_income": 120000,
      "state": "Tamil Nadu",
      "residence": "Tamil Nadu Resident"
    }'::jsonb,
    'Cashless hospital treatment up to ₹5 Lakhs annually per enrolled family across accredited hospitals.',
    '["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card of all family members"]'::jsonb,
    'https://cmchistn.com/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 5. Kalaignar Kanavu Illam Rural Housing Scheme (Tamil Nadu)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'housing' LIMIT 1),
    'Kalaignar Kanavu Illam Housing Scheme',
    'TN-KKI-005',
    'Rural Development & Panchayat Raj Department, Govt of Tamil Nadu',
    'state',
    'Financial subsidy of ₹3.5 Lakhs for converting rural hutments into permanent concrete houses.',
    'Kalaignar Kanavu Illam aims to eradicate thatched hutments in rural Tamil Nadu by providing direct construction subsidy to build safe, durable concrete homes for homeless & low-income families.',
    '{
      "max_annual_income": 150000,
      "state": "Tamil Nadu",
      "residence_type": "Kutcha House / Hutment Owner in Rural Area",
      "own_land_patta": true
    }'::jsonb,
    '₹3,50,000 direct construction assistance disbursed in stage-wise installments.',
    '["Land Patta / Chitta Ownership Document", "Aadhaar Card", "Ration Card", "Bank Account Details"]'::jsonb,
    'https://tnrd.tn.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 6. Tamil Nadu Farmers Welfare & Protection Scheme
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'agriculture' LIMIT 1),
    'TN Uzhavar Protection Scheme',
    'TN-UZHAVAR-006',
    'Revenue & Disaster Management Department, Govt of Tamil Nadu',
    'state',
    'Social security, pension, and accidental insurance for agricultural landholders & laborers.',
    'Uzhavar Protection Scheme offers financial security, old-age pension, marriage assistance, educational grants for children, and death relief for small farmers and farm workers in Tamil Nadu.',
    '{
      "min_age": 18,
      "is_farmer": true,
      "occupation": "Farmer / Agricultural Laborer / Tenant Farmer",
      "state": "Tamil Nadu"
    }'::jsonb,
    'Monthly ₹1,000 old age pension, ₹1,00,000 accidental death cover, and higher education scholarships for children.',
    '["Uzhavar Card / Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"]'::jsonb,
    'https://eblock.tn.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 7. PM Kisan Samman Nidhi (Central Government)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'agriculture' LIMIT 1),
    'PM Kisan Samman Nidhi (PM-KISAN)',
    'CENTRAL-PMKISAN-007',
    'Ministry of Agriculture & Farmers Welfare, Govt of India',
    'central',
    'Annual direct income support of ₹6,000 for landholding farmer families across India.',
    'PM-KISAN provides income support of ₹6,000 per annum to all cultivable landholding farmer families across the country, transferred directly into their Aadhaar-seeded bank accounts in 3 equal installments.',
    '{
      "is_farmer": true,
      "landholding": "Cultivable landholder",
      "state": "All States / UTs"
    }'::jsonb,
    '₹6,000 per year paid in 3 installments of ₹2,000 every 4 months via Direct Benefit Transfer (DBT).',
    '["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account Passbook"]'::jsonb,
    'https://pmkisan.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 8. Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY Central)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'healthcare' LIMIT 1),
    'Ayushman Bharat PM-JAY',
    'CENTRAL-PMJAY-008',
    'National Health Authority (NHA), Ministry of Health, Govt of India',
    'central',
    'National health insurance cover of ₹5 Lakhs per family for secondary & tertiary hospital care.',
    'PM-JAY is the world’s largest health insurance scheme offering cashless hospitalization coverage of up to ₹5,00,000 per family per year to low-income and vulnerable families.',
    '{
      "state": "All States / UTs",
      "secc_criteria": "Identified deprived family under SECC 2011"
    }'::jsonb,
    '₹5,00,000 annual cashless treatment for over 1,900 medical procedures across network hospitals.',
    '["Aadhaar Card", "Ration Card", "Ayushman Golden Card / PM-JAY ID"]'::jsonb,
    'https://pmjay.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 9. Pradhan Mantri Mudra Yojana (PMMY Central)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'employment' LIMIT 1),
    'Pradhan Mantri Mudra Yojana (PMMY)',
    'CENTRAL-PMMY-009',
    'Department of Financial Services, Ministry of Finance, Govt of India',
    'central',
    'Collateral-free business loans up to ₹10 Lakhs for micro and small enterprise owners.',
    'PM Mudra Yojana enables non-corporate, non-farm small/micro enterprises to access affordable business credit up to ₹10 Lakhs under Shishu (up to ₹50k), Kishore (₹50k-₹5L), and Tarun (₹5L-₹10L) categories.',
    '{
      "min_age": 18,
      "max_age": 65,
      "occupation": "Micro Entrepreneur / Shopkeeper / Small Business Owner",
      "state": "All States / UTs"
    }'::jsonb,
    'Collateral-free enterprise credit up to ₹10,00,000 at competitive bank interest rates.',
    '["Aadhaar Card", "PAN Card", "Business Proof / Udyam MSME Registration", "6-Month Bank Statement"]'::jsonb,
    'https://www.mudra.org.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 10. Sukanya Samriddhi Yojana (Central)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'women_welfare' LIMIT 1),
    'Sukanya Samriddhi Yojana (Girl Child Savings)',
    'CENTRAL-SSY-010',
    'Department of Posts / Ministry of Women & Child Development, Govt of India',
    'central',
    'High-interest government savings scheme for girl children with 80C tax exemption.',
    'Sukanya Samriddhi Yojana is a small deposit savings scheme formulated for the girl child to secure her higher education and marriage expenses with high interest rates (8.2% p.a.) and Section 80C tax benefits.',
    '{
      "min_age": 0,
      "max_age": 10,
      "gender": "female",
      "state": "All States / UTs"
    }'::jsonb,
    'High interest rate (8.2% p.a. compounded annually), complete tax exemption, and partial withdrawal allowed for higher education at age 18.',
    '["Girl Child Birth Certificate", "Parent / Guardian Aadhaar & PAN Card", "Passport Size Photos"]'::jsonb,
    'https://www.indiapost.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 11. PM Awas Yojana Urban & Gramin (PMAY Housing Central)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'housing' LIMIT 1),
    'Pradhan Mantri Awas Yojana (PMAY)',
    'CENTRAL-PMAY-011',
    'Ministry of Housing & Urban Affairs / Ministry of Rural Development, Govt of India',
    'central',
    'Interest subsidy and construction assistance for affordable housing for all citizens.',
    'PMAY provides interest subvention on home loans and direct financial grants to Economically Weaker Sections (EWS) and Low-Income Groups (LIG) to build or acquire pucca houses.',
    '{
      "max_annual_income": 600000,
      "state": "All States / UTs",
      "pucca_house_owned": false
    }'::jsonb,
    'Up to ₹2.67 Lakhs interest subsidy on home loan or ₹1.5 Lakhs direct construction grant.',
    '["Aadhaar Card", "Income Certificate / Salary Slip", "Affidavit for not owning a pucca house", "Bank Passbook"]'::jsonb,
    'https://pmaymis.gov.in/',
    0.00,
    true
  ),

  -- --------------------------------------------------------------------------
  -- 12. PM Vidya Lakshmi Education Loan Scheme (Central)
  -- --------------------------------------------------------------------------
  (
    (SELECT id FROM public.scheme_categories WHERE category_code = 'education' LIMIT 1),
    'PM Vidya Lakshmi Education Loan Scheme',
    'CENTRAL-VIDYALAKSHMI-012',
    'Department of Higher Education, Ministry of Education, Govt of India',
    'central',
    'Single-window portal to apply for education loans & central interest subsidy for higher studies.',
    'Vidya Lakshmi portal connects students directly with banks for education loans and interest subsidy schemes (CSIS) to pursue professional & higher education in India and abroad.',
    '{
      "is_student": true,
      "education_level": "Higher Education / Degree / Diploma",
      "state": "All States / UTs"
    }'::jsonb,
    'Access to educational loans up to ₹15 Lakhs without collateral for listed institutions and interest waiver during moratorium period for EWS students.',
    '["10th & 12th Marksheet", "College Admission Offer Letter & Fee Structure", "Parent Income Certificate", "Aadhaar Card"]'::jsonb,
    'https://www.vidyalakshmi.co.in/',
    0.00,
    true
  )
ON CONFLICT (scheme_code) DO UPDATE SET
  scheme_name = EXCLUDED.scheme_name,
  department_name = EXCLUDED.department_name,
  state_or_central = EXCLUDED.state_or_central,
  short_description = EXCLUDED.short_description,
  detailed_description = EXCLUDED.detailed_description,
  eligibility_criteria = EXCLUDED.eligibility_criteria,
  benefits_summary = EXCLUDED.benefits_summary,
  required_documents = EXCLUDED.required_documents,
  official_portal_url = EXCLUDED.official_portal_url,
  application_fee = EXCLUDED.application_fee,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
