// CrowdCity AI v3.5 - Government Application Assistant Engine
// Dynamic multi-scheme form preparation, profile prefill, smart validation,
// AI field guidance, document wallet integration, and application readiness scoring.

(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. COMPREHENSIVE GOVERNMENT SCHEMES REGISTRY (12 SCHEMES)
  // ---------------------------------------------------------------------------
  const SCHEMES_REGISTRY = {
    'tn-kmut': {
      id: 'tn-kmut',
      code: 'TN-KMUT-001',
      uuid: '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
      name: 'Kalaignar Magalir Urimai Thittam',
      name_ta: 'கலைஞர் மகளிர் உரிமைத் திட்டம்',
      dept: 'Social Welfare & Women Empowerment Dept, Govt of Tamil Nadu',
      dept_ta: 'சமூக நலம் மற்றும் மகளிர் உரிமைத் துறை',
      type: 'state',
      portal: 'https://kmut.tn.gov.in/',
      short_desc: 'Monthly financial rights grant of ₹1,000 for female heads of eligible households in Tamil Nadu.',
      required_documents: [
        { doc_type: 'ration_card', name: 'Smart Family Ration Card', name_ta: 'குடும்ப ஸ்மார்ட் கார்டு', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'bank_passbook', name: 'Aadhaar-Linked Bank Passbook', name_ta: 'வங்கி கணக்குப் புத்தகம்', required: true }
      ],
      specific_fields: [
        {
          id: 'smart_card_no',
          label: 'Smart Family Ration Card Number',
          label_ta: 'குடும்ப ஸ்மார்ட் கார்டு எண்',
          type: 'text',
          required: true,
          placeholder: '03/N/0123456',
          hint: '12-digit number or formatted code printed on the top corner of your TN Smart Card.',
          validation: (v) => /^[0-9a-zA-Z\/\-]{8,15}$/.test((v || '').trim()),
          errorMessage: 'Please enter a valid Smart Family Card number.',
          what_is_it: 'The unique smart family card number issued by the TN Civil Supplies and Consumer Protection Department.',
          why_required: 'Establishes household identification and verifies whether the applicant is recognized as the female head of the family.',
          where_to_find: 'Printed clearly on the front/top-right of your Tamil Nadu Smart Ration Card.',
          format_guide: 'Enter digits and slash as printed (e.g. 03/N/0123456).',
          common_mistakes: ['Entering old paper card number', 'Typing letter O instead of number 0'],
          example_value: '03/N/0123456'
        },
        {
          id: 'annual_income',
          label: 'Total Annual Family Income (₹)',
          label_ta: 'ஆண்டு குடும்ப வருமானம் (₹)',
          type: 'number',
          required: true,
          placeholder: 'e.g. 180000',
          hint: 'Combined gross annual income of all adult members in the family (must be ≤ ₹2,50,000).',
          validation: (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 250000; },
          errorMessage: 'Annual income must be a valid amount up to ₹2,50,000 for KMUT eligibility.',
          what_is_it: 'The combined annual earnings of all family members from all sources before tax.',
          why_required: 'KMUT rules stipulate that only families with annual income up to ₹2.5 Lakhs are eligible.',
          where_to_find: 'Refer to your Income Certificate issued by VAO/Revenue Department, or salary slip.',
          format_guide: 'Numeric value only without commas (e.g. 180000).',
          common_mistakes: ['Entering monthly income instead of annual', 'Including commas or ₹ sign'],
          example_value: '180000'
        },
        {
          id: 'eb_consumer_no',
          label: 'Domestic Electricity Consumer Connection Number',
          label_ta: 'மின் இணைப்பு நுகர்வோர் எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. 01-123-456-789',
          hint: 'Domestic service connection number on your TANGEDCO electricity bill/receipt.',
          validation: (v) => (v || '').trim().length >= 6,
          errorMessage: 'Enter a valid domestic electricity consumer number.',
          what_is_it: 'Your 9-to-12 digit domestic electricity service number registered with TANGEDCO.',
          why_required: 'Used to verify whether annual household electricity consumption is within the 3,600 units ceiling.',
          where_to_find: 'Found on your monthly TANGEDCO electricity receipt or SMS.',
          format_guide: 'Enter consumer number as shown on TANGEDCO bill.',
          common_mistakes: ['Entering commercial or agricultural connection number'],
          example_value: '02-045-1289'
        },
        {
          id: 'owns_car',
          label: 'Does any family member own a four-wheeler (car / jeep) for personal use?',
          label_ta: 'குடும்பத்தில் சொந்தமாக நான்கு சக்கர வாகனம் (கார்) உள்ளதா?',
          type: 'select',
          options: [
            { value: 'no', label: 'No — Do not own four-wheeler' },
            { value: 'yes', label: 'Yes — Own personal four-wheeler' }
          ],
          required: true,
          validation: (v) => v === 'no',
          errorMessage: 'Families owning personal four-wheelers are not eligible under KMUT guidelines.',
          what_is_it: 'Declaration regarding ownership of non-commercial light motor vehicles.',
          why_required: 'KMUT criteria exclude families owning personal light motor vehicles (excluding tractors/commercial vehicles).',
          where_to_find: 'Vehicle Registration Certificate (RC Book).',
          format_guide: 'Select No or Yes.',
          common_mistakes: ['Selecting Yes if owning a two-wheeler (scooters/bikes are permitted)'],
          example_value: 'No'
        }
      ]
    },

    'tn-pudhumai': {
      id: 'tn-pudhumai',
      code: 'TN-PUDHUMAI-002',
      uuid: '6edf49dc-795f-4369-b5ab-f72c24eddef8',
      name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
      name_ta: 'புதுமைப் பெண் திட்டம்',
      dept: 'Higher Education & Social Welfare Dept, Govt of Tamil Nadu',
      dept_ta: 'உயர்கல்வித் துறை, தமிழ்நாடு அரசு',
      type: 'state',
      portal: 'https://penkalvi.tn.gov.in/',
      short_desc: 'Monthly financial assistance of ₹1,000 for girl students pursuing degree/diploma education after studying in TN Govt schools.',
      required_documents: [
        { doc_type: 'student_id', name: 'Govt School Study Certificate (Classes 6-12)', name_ta: 'அரசுப் பள்ளி பயின்ற சான்றிதழ்', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'student_id', name: 'College Admission Letter / ID', name_ta: 'கல்லூரி சேர்க்கை சான்று', required: true },
        { doc_type: 'bank_passbook', name: 'Student Direct Bank Passbook', name_ta: 'மாணவி வங்கிக் கணக்குப் புத்தகம்', required: true }
      ],
      specific_fields: [
        {
          id: 'school_emis_id',
          label: 'Government School EMIS Student ID Number',
          label_ta: 'பள்ளி கல்வி மேலாண்மை தகவல் எண் (EMIS ID)',
          type: 'text',
          required: true,
          placeholder: '33021500101',
          hint: '11-digit Education Management Information System (EMIS) ID from your Govt School Transfer Certificate.',
          validation: (v) => /^\d{11}$/.test((v || '').trim()),
          errorMessage: 'EMIS ID must be exactly 11 digits numeric.',
          what_is_it: 'A state education identifier uniquely assigned to every student enrolled in Tamil Nadu government schools.',
          why_required: 'Validates that the applicant completed continuous schooling from Classes 6 to 12 in a TN Government school.',
          where_to_find: 'Printed on your 10th/12th school Transfer Certificate (TC) or marksheet.',
          format_guide: '11 digits without hyphens or spaces.',
          common_mistakes: ['Entering roll number or examination registration number instead of EMIS ID'],
          example_value: '33021500101'
        },
        {
          id: 'college_name',
          label: 'Current College / Polytechnic / University Name',
          label_ta: 'தற்போது பயிலும் கல்லூரி / பாலிடெக்னிக் பெயர்',
          type: 'text',
          required: true,
          placeholder: 'e.g. Queen Marys College, Chennai',
          hint: 'Name of the recognized institution where you are currently studying.',
          validation: (v) => (v || '').trim().length >= 4,
          errorMessage: 'Enter complete institution name.',
          what_is_it: 'The accredited higher education institution where the student is actively enrolled.',
          why_required: 'Confirms active enrollment in an approved undergraduate degree, diploma, or ITI program.',
          where_to_find: 'College Identity Card or official fee admission receipt.',
          format_guide: 'Official full college name.',
          common_mistakes: ['Abbreviating college name so it cannot be matched in college directory'],
          example_value: 'Presidency College, Chennai'
        },
        {
          id: 'course_name',
          label: 'Course of Study (Degree / Diploma / ITI)',
          label_ta: 'பயிலும் படிப்பு (பட்டப்படிப்பு / பட்டயப்படிப்பு)',
          type: 'text',
          required: true,
          placeholder: 'e.g. B.Sc. Computer Science',
          hint: 'Degree course title (e.g. B.A., B.Sc., B.Com., B.E., Diploma in EEE).',
          validation: (v) => (v || '').trim().length >= 2,
          errorMessage: 'Enter course name.',
          what_is_it: 'The specific degree program currently being pursued.',
          why_required: 'Pudhumai Penn supports recognized higher education diploma and degree courses.',
          where_to_find: 'College admission offer letter or semester grade sheet.',
          format_guide: 'Standard course name (e.g. B.Com Corporate Secretaryship).',
          common_mistakes: ['Entering only "degree" without subject specialization'],
          example_value: 'B.Sc. Mathematics'
        },
        {
          id: 'study_year',
          label: 'Current Year of Study',
          label_ta: 'பயிலும் ஆண்டு',
          type: 'select',
          options: [
            { value: '1', label: '1st Year (Fresher)' },
            { value: '2', label: '2nd Year' },
            { value: '3', label: '3rd Year' },
            { value: '4', label: '4th Year (Engineering / Professional)' }
          ],
          required: true,
          validation: (v) => ['1', '2', '3', '4'].includes(v),
          errorMessage: 'Select current study year.',
          what_is_it: 'The academic year currently enrolled in.',
          why_required: 'Determines payment eligibility duration through course graduation.',
          where_to_find: 'Current semester admission slip or college ID.',
          format_guide: 'Select from dropdown.',
          common_mistakes: ['Selecting prospective year before promotion'],
          example_value: '1st Year'
        }
      ]
    },

    'tn-nm': {
      id: 'tn-naanmudhalvan',
      code: 'TN-NM-003',
      uuid: 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
      name: 'Naan Mudhalvan Skill Development Scheme',
      name_ta: 'நான் முதல்வன் திறன் மேம்பாட்டுத் திட்டம்',
      dept: 'Tamil Nadu Skill Development Corporation (TNSDC)',
      dept_ta: 'தமிழ்நாடு திறன் மேம்பாட்டுக் கழகம்',
      type: 'state',
      portal: 'https://www.naanmudhalvan.tn.gov.in/',
      short_desc: 'Statewide skill enhancement, industry certifications, technical mentorship, and campus placement drives.',
      required_documents: [
        { doc_type: 'student_id', name: 'College ID or Degree Marksheet', name_ta: 'கல்லூரி அடையாள அட்டை / மதிப்பெண் பட்டியல்', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'community_cert', name: 'Community Certificate (if applicable)', name_ta: 'சாதிச் சான்றிதழ்', required: false }
      ],
      specific_fields: [
        {
          id: 'edu_qualification',
          label: 'Highest Educational Qualification / Status',
          label_ta: 'கல்வித் தகுதி / நிலை',
          type: 'select',
          options: [
            { value: 'undergrad_enrolled', label: 'Currently Enrolled in UG Degree (Engineering / Arts & Science)' },
            { value: 'diploma_enrolled', label: 'Currently Enrolled in Polytechnic Diploma' },
            { value: 'recent_graduate', label: 'Recent Graduate (Looking for Placement)' },
            { value: 'postgrad_enrolled', label: 'Post-Graduate Student' }
          ],
          required: true,
          validation: (v) => !!v,
          errorMessage: 'Select your educational status.',
          what_is_it: 'Your current academic standing or recently completed degree.',
          why_required: 'Naan Mudhalvan courses and employment drives are grouped by academic qualification.',
          where_to_find: 'Degree marksheet or College student ID card.',
          format_guide: 'Select from options.',
          common_mistakes: ['Selecting graduate before final exam results are declared'],
          example_value: 'Currently Enrolled in UG Degree'
        },
        {
          id: 'preferred_skill_domain',
          label: 'Target Skill Domain of Interest',
          label_ta: 'விருப்பமான திறன் பயிற்சித் துறை',
          type: 'select',
          options: [
            { value: 'ai_data_science', label: 'Artificial Intelligence & Data Analytics' },
            { value: 'cloud_devops', label: 'Cloud Computing & Cyber Security' },
            { value: 'core_engineering', label: 'Core Engineering (EV, Robotics, VLSI, CAD)' },
            { value: 'banking_finance', label: 'FinTech, Banking & Financial Services' },
            { value: 'logistics_supply', label: 'Logistics, Supply Chain & Retail Management' },
            { value: 'competitive_exams', label: 'Civil Services / Banking Exam Preparation' }
          ],
          required: true,
          validation: (v) => !!v,
          errorMessage: 'Select a target skill domain.',
          what_is_it: 'The industry sector course you wish to complete under Naan Mudhalvan portal.',
          why_required: 'Allocates learning track modules and relevant industrial mentors.',
          where_to_find: 'Self-selected career specialization.',
          format_guide: 'Select from available tracks.',
          common_mistakes: ['Enrolling in generic domain without prerequisites'],
          example_value: 'Artificial Intelligence & Data Analytics'
        },
        {
          id: 'institution_district',
          label: 'Institution District',
          label_ta: 'கல்லூரி அமைந்துள்ள மாவட்டம்',
          type: 'text',
          required: true,
          placeholder: 'e.g. Coimbatore',
          hint: 'District in Tamil Nadu where your educational institution is located.',
          validation: (v) => (v || '').trim().length >= 3,
          errorMessage: 'Enter institution district.',
          what_is_it: 'Geographic district of the college campus.',
          why_required: 'Assigns regional hackathons and local corporate placement drives.',
          where_to_find: 'College address.',
          format_guide: 'District name.',
          common_mistakes: ['Entering home district instead of college campus district'],
          example_value: 'Coimbatore'
        }
      ]
    },

    'tn-cmchis': {
      id: 'tn-cmchis',
      code: 'TN-CMCHIS-004',
      uuid: '43e8ff6a-d3f3-4277-88f2-98c46491584e',
      name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
      name_ta: 'முதலமைச்சரின் விரிவான மருத்துவக் காப்பீட்டுத் திட்டம்',
      dept: 'Health & Family Welfare Department, Govt of Tamil Nadu',
      dept_ta: 'மக்கள் நல்வாழ்வுத் துறை, தமிழ்நாடு அரசு',
      type: 'state',
      portal: 'https://cmchistn.com/',
      short_desc: 'Cashless hospital treatment and surgical coverage up to ₹5,00,000 per family per year.',
      required_documents: [
        { doc_type: 'ration_card', name: 'Smart Family Ration Card', name_ta: 'குடும்ப ஸ்மார்ட் கார்டு', required: true },
        { doc_type: 'income_cert', name: 'Income Certificate from VAO / Tahsildar (≤ ₹1.2L)', name_ta: 'வருமானச் சான்றிதழ்', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Cards of All Family Members', name_ta: 'குடும்ப உறுப்பினர்கள் ஆதார்', required: true }
      ],
      specific_fields: [
        {
          id: 'smart_card_no',
          label: 'Smart Family Ration Card Number',
          label_ta: 'குடும்ப ஸ்மார்ட் கார்டு எண்',
          type: 'text',
          required: true,
          placeholder: '03/N/0123456',
          hint: 'Smart ration card number used to identify enrolled family dependents.',
          validation: (v) => /^[0-9a-zA-Z\/\-]{8,15}$/.test((v || '').trim()),
          errorMessage: 'Enter a valid Smart Ration Card number.',
          what_is_it: 'The family ration card identifying all members to be covered under the insurance policy.',
          why_required: 'CMCHIS health cards are issued and verified based on the official Smart Ration Card database.',
          where_to_find: 'Top-right corner of smart ration card.',
          format_guide: 'Alphanumeric with slash as printed.',
          common_mistakes: ['Entering member Aadhaar instead of family card number'],
          example_value: '03/N/0123456'
        },
        {
          id: 'income_cert_no',
          label: 'VAO / Tahsildar Income Certificate Number',
          label_ta: 'வருமானச் சான்றிதழ் எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. REV-INC-2026-10492',
          hint: 'e-Sevai application or certificate number issued by the Revenue Department.',
          validation: (v) => (v || '').trim().length >= 6,
          errorMessage: 'Enter a valid Income Certificate reference number.',
          what_is_it: 'Official reference number of the family income certificate proving income under ₹1,20,000.',
          why_required: 'Proves the applicant family meets the statutory poverty ceiling for fully subsidized government insurance.',
          where_to_find: 'Top bar or barcode area of your digitally signed e-Sevai Income Certificate.',
          format_guide: 'e-Sevai application code (e.g. TN-720240101102).',
          common_mistakes: ['Entering expired certificate (validity is 1 year from issuance)'],
          example_value: 'TN-720260214002'
        },
        {
          id: 'family_members_count',
          label: 'Total Family Members to be Enrolled in Policy',
          label_ta: 'காப்பீட்டில் சேர்க்கப்பட வேண்டிய குடும்ப உறுப்பினர்கள் எண்ணிக்கை',
          type: 'number',
          required: true,
          placeholder: 'e.g. 4',
          hint: 'Number of members listed on your Smart Ration Card (self, spouse, children, dependent parents).',
          validation: (v) => { const n = Number(v); return n >= 1 && n <= 12; },
          errorMessage: 'Enter family members count between 1 and 12.',
          what_is_it: 'Count of dependents who will receive cashless medical cover under this unified family policy.',
          why_required: 'Ensures smart cards and biometric authorization cover all legitimate household members.',
          where_to_find: 'Back side of Smart Ration Card under Family Member details.',
          format_guide: 'Single integer number.',
          common_mistakes: ['Leaving out newborn or minor children'],
          example_value: '4'
        }
      ]
    },

    'central-pmkisan': {
      id: 'central-pmkisan',
      code: 'CENTRAL-PMKISAN-007',
      uuid: 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
      name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      name_ta: 'பிரதான் மந்திரி கிசான் சம்மான் நிதி',
      dept: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
      dept_ta: 'வேளாண்மை மற்றும் உழவர் நல அமைச்சகம்',
      type: 'central',
      portal: 'https://pmkisan.gov.in/',
      short_desc: 'Direct income support of ₹6,000 per year paid in three equal 4-monthly installments of ₹2,000 to landholding farmers.',
      required_documents: [
        { doc_type: 'farmer_cert', name: 'Land Ownership Patta / Chitta Record', name_ta: 'நில உரிமை பட்டா / சிட்டா', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'bank_passbook', name: 'Aadhaar-Linked Bank Account Passbook', name_ta: 'ஆதார் இணைக்கப்பட்ட வங்கிக் கணக்கு', required: true }
      ],
      specific_fields: [
        {
          id: 'patta_no',
          label: 'Agricultural Land Patta / Chitta Number',
          label_ta: 'விவசாய நில பட்டா / சிட்டா எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. Patta No. 1245',
          hint: 'Official revenue land ownership patta reference number.',
          validation: (v) => (v || '').trim().length >= 2,
          errorMessage: 'Enter your valid land Patta reference number.',
          what_is_it: 'Official record of rights issued by Revenue Department establishing agricultural title.',
          why_required: 'PM-KISAN requires institutional or individual land ownership in the applicant farmer’s name.',
          where_to_find: 'On your physical Patta passbook or Tamil Nadu e-Services portal (eservices.tn.gov.in).',
          format_guide: 'Alphanumeric patta code.',
          common_mistakes: ['Entering survey number in place of patta number'],
          example_value: '1245'
        },
        {
          id: 'survey_no',
          label: 'Survey Number & Sub-Division',
          label_ta: 'புல எண் மற்றும் உட்பிரிவு',
          type: 'text',
          required: true,
          placeholder: 'e.g. 142/3B',
          hint: 'Revenue survey and sub-division reference for cultivable land parcel.',
          validation: (v) => (v || '').trim().length >= 2,
          errorMessage: 'Enter land survey number.',
          what_is_it: 'Cadastral land parcel identifier registered in village adangal.',
          why_required: 'Directly cross-verified with Tamil Nadu TamilNilam land records database.',
          where_to_find: 'Listed inside your Patta / Chitta document next to village name.',
          format_guide: 'Number with slash/subdivision (e.g. 214/1A).',
          common_mistakes: ['Omitting sub-division letter'],
          example_value: '142/3B'
        },
        {
          id: 'land_extent_hectares',
          label: 'Cultivable Land Extent (in Acres or Hectares)',
          label_ta: 'நிலப் பரப்பளவு (ஏக்கர் அல்லது ஹெக்டேர்)',
          type: 'text',
          required: true,
          placeholder: 'e.g. 1.5 Acres',
          hint: 'Total cultivable area owned by farmer.',
          validation: (v) => (v || '').trim().length >= 1,
          errorMessage: 'Enter land extent area.',
          what_is_it: 'Total surface area of cultivable agricultural land holding.',
          why_required: 'Categorizes farmer holding size (Small, Marginal, or Large).',
          where_to_find: 'Listed under Extent column in Revenue Patta.',
          format_guide: 'Area with unit (e.g. 1.25 Acres or 0.5 Hectares).',
          common_mistakes: ['Entering house plot square feet instead of agricultural land area'],
          example_value: '2.0 Acres'
        },
        {
          id: 'farmer_category',
          label: 'Farmer Classification',
          label_ta: 'விவசாயி வகைப்பாடு',
          type: 'select',
          options: [
            { value: 'small_marginal', label: 'Small / Marginal Farmer (Up to 2 Hectares / 5 Acres)' },
            { value: 'other', label: 'Other Landholding Farmer' }
          ],
          required: true,
          validation: (v) => !!v,
          errorMessage: 'Select farmer classification.',
          what_is_it: 'Classification defined by agricultural census holding size.',
          why_required: 'Verifies statutory non-exclusion criteria under Ministry guidelines.',
          where_to_find: 'Based on total land area.',
          format_guide: 'Select from dropdown.',
          common_mistakes: ['Choosing institutional holding (institutional land is excluded)'],
          example_value: 'Small / Marginal Farmer'
        }
      ]
    },

    'central-pmjay': {
      id: 'central-pmjay',
      code: 'CENTRAL-PMJAY-008',
      uuid: 'd22faa80-2446-454f-8532-17429dcef2e6',
      name: 'Ayushman Bharat PM-JAY',
      name_ta: 'ஆயுஷ்மான் பாரத் பிரதம மந்திரி ஜன் ஆரோக்கிய திட்டம்',
      dept: 'National Health Authority (NHA), Govt of India',
      dept_ta: 'தேசிய சுகாதார ஆணையம்',
      type: 'central',
      portal: 'https://pmjay.gov.in/',
      short_desc: 'Health cover of ₹5,00,000 per family per year for secondary and tertiary care hospitalization across India.',
      required_documents: [
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'ration_card', name: 'Ration Card / PM-JAY Letter', name_ta: 'குடும்ப அட்டை / பிஎம்-ஜே கடிதம்', required: true }
      ],
      specific_fields: [
        {
          id: 'pmjay_ration_no',
          label: 'Ration Card / PM-JAY Family Identifier',
          label_ta: 'குடும்ப அட்டை / பிஎம்-ஜே அடையாள எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. 03/N/0123456',
          hint: 'Smart Family Ration card number or PM-JAY family letter code.',
          validation: (v) => (v || '').trim().length >= 6,
          errorMessage: 'Enter valid family identifier.',
          what_is_it: 'Unique identifier for SECC 2011 beneficiary family or state ration card.',
          why_required: 'Enables empanelled hospital kiosks to verify cashless admission coverage.',
          where_to_find: 'Smart Ration Card or Ayushman Golden Card.',
          format_guide: 'Ration card code.',
          common_mistakes: ['Entering personal mobile number in place of family identifier'],
          example_value: '03/N/0123456'
        }
      ]
    },

    'central-mudra': {
      id: 'central-mudra',
      code: 'CENTRAL-PMMY-009',
      uuid: '5a00bef6-7053-4170-8604-8ac6b079a707',
      name: 'Pradhan Mantri Mudra Yojana (PMMY)',
      name_ta: 'பிரதான் மந்திரி முத்ரா திட்டம்',
      dept: 'Ministry of Finance, Govt of India',
      dept_ta: 'நிதி அமைச்சகம், இந்திய அரசு',
      type: 'central',
      portal: 'https://www.mudra.org.in/',
      short_desc: 'Collateral-free micro-business loans up to ₹10 Lakhs for micro-enterprises and small entrepreneurs.',
      required_documents: [
        { doc_type: 'aadhaar', name: 'Identity Proof (Aadhaar / Voter ID)', name_ta: 'அடையாளச் சான்று', required: true },
        { doc_type: 'bank_passbook', name: 'Bank Statement / Passbook (Last 6 Months)', name_ta: 'வங்கி கணக்குப் புத்தகம்', required: true },
        { doc_type: 'other', name: 'Business Registration / Proof of Enterprise', name_ta: 'வணிக உரிமம் / ஆதாரம்', required: false }
      ],
      specific_fields: [
        {
          id: 'business_name',
          label: 'Enterprise / Micro-Business Name',
          label_ta: 'வணிக நிறுவனத்தின் பெயர்',
          type: 'text',
          required: true,
          placeholder: 'e.g. Sri Murugan Stores',
          hint: 'Name under which you operate or plan to establish your trade/manufacturing.',
          validation: (v) => (v || '').trim().length >= 3,
          errorMessage: 'Enter complete business name.',
          what_is_it: 'Trade name of the enterprise requesting working capital or asset purchase assistance.',
          why_required: 'Banks issue Mudra facilities to identified trading, manufacturing, or service businesses.',
          where_to_find: 'Shop licence, GST registration, or self-declared firm name.',
          format_guide: 'Full enterprise name.',
          common_mistakes: ['Entering applicant name when business operates under separate trade name'],
          example_value: 'Sri Murugan Stores'
        },
        {
          id: 'mudra_loan_category',
          label: 'Requested Mudra Loan Category',
          label_ta: 'முத்ரா கடன் பிரிவு',
          type: 'select',
          options: [
            { value: 'shishu', label: 'Shishu (Loans up to ₹50,000 for early startup)' },
            { value: 'kishore', label: 'Kishore (Loans ₹50,001 to ₹5,00,000 for established unit)' },
            { value: 'tarun', label: 'Tarun (Loans ₹5,00,001 to ₹10,00,000 for business expansion)' }
          ],
          required: true,
          validation: (v) => !!v,
          errorMessage: 'Select loan category.',
          what_is_it: 'Statutory slab under Mudra scheme matching capital requirement.',
          why_required: 'Determines documentation depth, appraisal model, and repayment schedule.',
          where_to_find: 'Based on your equipment/working capital requirement.',
          format_guide: 'Select Shishu, Kishore, or Tarun.',
          common_mistakes: ['Applying for Tarun without prior bank repayment record'],
          example_value: 'Shishu'
        }
      ]
    },

    'central-ssy': {
      id: 'central-ssy',
      code: 'CENTRAL-SSY-010',
      uuid: '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
      name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
      name_ta: 'செல்வமகள் சேமிப்புத் திட்டம்',
      dept: 'Ministry of Finance & Department of Posts',
      dept_ta: 'நிதி அமைச்சகம் மற்றும் அஞ்சல் துறை',
      type: 'central',
      portal: 'https://www.indiapost.gov.in/',
      short_desc: 'High-interest tax-exempt government savings scheme for girl children up to 10 years of age.',
      required_documents: [
        { doc_type: 'student_id', name: 'Girl Child Birth Certificate', name_ta: 'குழந்தையின் பிறப்புச் சான்றிதழ்', required: true },
        { doc_type: 'aadhaar', name: 'Parent / Guardian Aadhaar Card', name_ta: 'பெற்றோர் ஆதார் அட்டை', required: true }
      ],
      specific_fields: [
        {
          id: 'child_name',
          label: 'Girl Child Full Name',
          label_ta: 'பெண் குழந்தையின் முழுப் பெயர்',
          type: 'text',
          required: true,
          placeholder: 'e.g. Ananya S',
          hint: 'Name exactly as registered on Birth Certificate.',
          validation: (v) => (v || '').trim().length >= 2,
          errorMessage: 'Enter child name.',
          what_is_it: 'Name of the minor girl child in whose name the account is maintained.',
          why_required: 'SSY is an individual account dedicated exclusively to the beneficiary girl child.',
          where_to_find: 'Corporation / Municipality Birth Certificate.',
          format_guide: 'Full name.',
          common_mistakes: ['Entering pet names or spelling differently than birth certificate'],
          example_value: 'Ananya S'
        },
        {
          id: 'child_dob',
          label: 'Girl Child Date of Birth',
          label_ta: 'குழந்தையின் பிறந்த தேதி',
          type: 'date',
          required: true,
          hint: 'Child must be 10 years of age or younger on application date.',
          validation: (v) => {
            if (!v) return false;
            const diff = (Date.now() - new Date(v).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            return diff >= 0 && diff <= 10.5;
          },
          errorMessage: 'Child must be 10 years of age or younger for SSY.',
          what_is_it: 'Birth date establishing eligibility window for opening the account.',
          why_required: 'Statutory age limit allows opening only before the girl child reaches 10 years.',
          where_to_find: 'Official Birth Certificate.',
          format_guide: 'YYYY-MM-DD.',
          common_mistakes: ['Entering date after the child completed 10 years'],
          example_value: '2019-06-15'
        }
      ]
    },

    'central-pmay': {
      id: 'central-pmay',
      code: 'CENTRAL-PMAY-011',
      uuid: '23914f21-21a9-4695-8784-680a9577879c',
      name: 'Pradhan Mantri Awas Yojana (PMAY Housing)',
      name_ta: 'பிரதான் மந்திரி ஆவாஸ் திட்டம்',
      dept: 'Ministry of Housing and Urban Affairs, Govt of India',
      dept_ta: 'வீட்டுவசதி மற்றும் நகர்ப்புற விவகாரங்கள் அமைச்சகம்',
      type: 'central',
      portal: 'https://pmaymis.gov.in/',
      short_desc: 'Credit-linked interest subsidy and direct housing grant up to ₹2.67 Lakhs for first-time home buyers.',
      required_documents: [
        { doc_type: 'aadhaar', name: 'Aadhaar Card of Family Head', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'income_cert', name: 'Income Certificate', name_ta: 'வருமானச் சான்றிதழ்', required: true },
        { doc_type: 'farmer_cert', name: 'Land Patta / Site Document', name_ta: 'மனை பட்டா சான்று', required: true }
      ],
      specific_fields: [
        {
          id: 'owns_pucca_house',
          label: 'Do you or any family member own a permanent (pucca) concrete house anywhere in India?',
          label_ta: 'இந்தியாவில் எங்கும் சொந்தமாக கான்கிரீட் வீடு உள்ளதா?',
          type: 'select',
          options: [
            { value: 'no', label: 'No — Do not own pucca house (Eligible)' },
            { value: 'yes', label: 'Yes — Already own pucca house' }
          ],
          required: true,
          validation: (v) => v === 'no',
          errorMessage: 'PMAY is strictly reserved for families without existing pucca houses.',
          what_is_it: 'Statutory declaration of homelessness or kutcha house residence.',
          why_required: 'Ensures public funds provide housing security to genuinely unhoused citizens.',
          where_to_find: 'Self-declaration.',
          format_guide: 'Select No.',
          common_mistakes: ['Selecting Yes when living in thatch/tiled kutcha home'],
          example_value: 'No'
        }
      ]
    },

    'central-vidyalakshmi': {
      id: 'central-vidyalakshmi',
      code: 'CENTRAL-VIDYALAKSHMI-012',
      uuid: '8c887239-49c4-48de-8fee-5c305098b97d',
      name: 'PM Vidya Lakshmi Education Loan Scheme',
      name_ta: 'பிஎம் வித்யா லக்ஷ்மி கல்விக் கடன் திட்டம்',
      dept: 'Department of Higher Education, Govt of India',
      dept_ta: 'உயர்கல்வித் துறை, இந்திய அரசு',
      type: 'central',
      portal: 'https://www.vidyalakshmi.co.in/',
      short_desc: 'Single-window unified platform for education loans and interest subsidy schemes from public banks.',
      required_documents: [
        { doc_type: 'student_id', name: 'College Admission Offer Letter & Fee Structure', name_ta: 'சேர்க்கைக் கடிதம் & கட்டண விவரம்', required: true },
        { doc_type: 'income_cert', name: 'Parent Income Certificate', name_ta: 'பெற்றோர் வருமானச் சான்றிதழ்', required: true },
        { doc_type: 'aadhaar', name: 'Student & Co-Applicant Aadhaar Card', name_ta: 'மாணவர் மற்றும் பெற்றோர் ஆதார்', required: true }
      ],
      specific_fields: [
        {
          id: 'admission_course_name',
          label: 'Approved Course & Degree Title',
          label_ta: 'சேர்க்கை பெற்ற படிப்பு மற்றும் பட்டம்',
          type: 'text',
          required: true,
          placeholder: 'e.g. B.Tech Mechanical Engineering',
          hint: 'Full course name as written on institution admission letter.',
          validation: (v) => (v || '').trim().length >= 3,
          errorMessage: 'Enter approved course name.',
          what_is_it: 'Degree or postgraduate program at AICTE/UGC approved university.',
          why_required: 'Banks approve credit based on recognized educational credentials.',
          where_to_find: 'Official Admission allotment order.',
          format_guide: 'Course title.',
          common_mistakes: ['Entering generic "engineering" without branch'],
          example_value: 'B.Tech Information Technology'
        },
        {
          id: 'loan_amount_requested',
          label: 'Total Loan Amount Requested (₹)',
          label_ta: 'கோரப்படும் கடன் தொகை (₹)',
          type: 'number',
          required: true,
          placeholder: 'e.g. 450000',
          hint: 'Combined tuition, hostel, and book expenses over the complete course.',
          validation: (v) => Number(v) > 0,
          errorMessage: 'Enter a valid loan amount in rupees.',
          what_is_it: 'The financial sum requested to meet educational fees.',
          why_required: 'Enables bank comparison across interest subsidy and repayment brackets.',
          where_to_find: 'College official institutional fee structure breakdown.',
          format_guide: 'Numeric value without commas.',
          common_mistakes: ['Requesting only single semester fee instead of complete degree course'],
          example_value: '400000'
        }
      ]
    },

    'tn-kanavuillam': {
      id: 'tn-kanavuillam',
      code: 'TN-KKI-005',
      uuid: '43c6f25f-384b-4410-98ac-e747f0edeef7',
      name: 'Kalaignar Kanavu Illam Housing Scheme',
      name_ta: 'கலைஞர் கனவு இல்லம் திட்டம்',
      dept: 'Rural Development & Panchayat Raj Dept, Govt of Tamil Nadu',
      dept_ta: 'ஊரக வளர்ச்சி மற்றும் ஊராட்சித் துறை',
      type: 'state',
      portal: 'https://tnrd.tn.gov.in/',
      short_desc: 'Financial grant of ₹3.5 Lakhs to replace rural huts with resilient concrete houses.',
      required_documents: [
        { doc_type: 'farmer_cert', name: 'Land Patta Document', name_ta: 'நிலப் பட்டா சான்று', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'ration_card', name: 'Smart Ration Card', name_ta: 'ஸ்மார்ட் குடும்ப அட்டை', required: true },
        { doc_type: 'bank_passbook', name: 'Active Bank Passbook', name_ta: 'வங்கி கணக்குப் புத்தகம்', required: true }
      ],
      specific_fields: [
        {
          id: 'house_site_patta',
          label: 'House Site Patta Document Reference Number',
          label_ta: 'மனை பட்டா எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. 245/T/10',
          hint: 'Revenue patta establishing ownership of plot where house is to be built.',
          validation: (v) => (v || '').trim().length >= 2,
          errorMessage: 'Enter valid house site patta number.',
          what_is_it: 'Title deed proving legal ownership of house site in the village.',
          why_required: 'Housing assistance is disbursed in stages to construct on legally owned land.',
          where_to_find: 'Village Administrative Officer (VAO) or Taluk Revenue Office.',
          format_guide: 'Patta code.',
          common_mistakes: ['Entering encroached or disputed land references'],
          example_value: '245/T/10'
        }
      ]
    },

    'tn-uzhavar': {
      id: 'tn-uzhavar',
      code: 'TN-UZHAVAR-006',
      uuid: 'f0478621-f9c1-47c0-8306-af37d7ed5721',
      name: 'TN Uzhavar Protection Scheme',
      name_ta: 'உழவர் பாதுகாப்புத் திட்டம்',
      dept: 'Agriculture & Farmers Welfare Dept, Govt of Tamil Nadu',
      dept_ta: 'வேளாண்மை மற்றும் உழவர் நலத்துறை',
      type: 'state',
      portal: 'https://agritech.tnau.ac.in/',
      short_desc: 'Comprehensive social security, accidental cover, pension, and education scholarships for farmers and agricultural laborers.',
      required_documents: [
        { doc_type: 'farmer_cert', name: 'Uzhavar Card / Membership Passbook', name_ta: 'உழவர் அட்டை', required: true },
        { doc_type: 'aadhaar', name: 'Aadhaar Card', name_ta: 'ஆதார் அட்டை', required: true },
        { doc_type: 'bank_passbook', name: 'Bank Passbook', name_ta: 'வங்கி கணக்குப் புத்தகம்', required: true }
      ],
      specific_fields: [
        {
          id: 'uzhavar_card_no',
          label: 'Uzhavar Card / Farmers Security Board Registration Number',
          label_ta: 'உழவர் நல வாரிய பதிவு எண்',
          type: 'text',
          required: true,
          placeholder: 'e.g. UZB-2024-8902',
          hint: 'Registration number in the Farmers Social Security Welfare Board.',
          validation: (v) => (v || '').trim().length >= 4,
          errorMessage: 'Enter Uzhavar Board registration number.',
          what_is_it: 'Registration identity card issued by District Agricultural Welfare Board.',
          why_required: 'Validates active membership in the state agricultural security scheme.',
          where_to_find: 'Uzhavar membership card issued by Tahsildar.',
          format_guide: 'Registration code.',
          common_mistakes: ['Entering PM-KISAN registration code instead of TN Board card'],
          example_value: 'TN-UZB-84912'
        }
      ]
    }
  };

  // Canonical Code / Slug Lookup
  function resolveSchemeMeta(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toLowerCase();

    // 1. Direct key match
    if (SCHEMES_REGISTRY[clean]) return SCHEMES_REGISTRY[clean];

    // 2. Code match (e.g. CENTRAL-PMKISAN-007, TN-NM-003, TN-KMUT-001)
    for (const key of Object.keys(SCHEMES_REGISTRY)) {
      const sch = SCHEMES_REGISTRY[key];
      if (sch.code.toLowerCase() === clean || sch.code === identifier) {
        return sch;
      }
      if (sch.code.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')) {
        return sch;
      }
      if (sch.uuid && sch.uuid.toLowerCase() === clean) {
        return sch;
      }
    }

    // 3. Normalized slug matching
    const slugMap = {
      'kmut': 'tn-kmut',
      'magalir': 'tn-kmut',
      'urimai': 'tn-kmut',
      'pudhumai': 'tn-pudhumai',
      'penkalvi': 'tn-pudhumai',
      'penn': 'tn-pudhumai',
      'naanmudhalvan': 'tn-nm',
      'naan-mudhalvan': 'tn-nm',
      'mudhalvan': 'tn-nm',
      'cmchis': 'tn-cmchis',
      'health': 'tn-cmchis',
      'pmkisan': 'central-pmkisan',
      'pm-kisan': 'central-pmkisan',
      'kisan': 'central-pmkisan',
      'pmjay': 'central-pmjay',
      'ayushman': 'central-pmjay',
      'mudra': 'central-mudra',
      'ssy': 'central-ssy',
      'sukanya': 'central-ssy',
      'pmay': 'central-pmay',
      'awas': 'central-pmay',
      'vidyalakshmi': 'central-vidyalakshmi',
      'vidya-lakshmi': 'central-vidyalakshmi',
      'kanavuillam': 'tn-kanavuillam',
      'kanavu-illam': 'tn-kanavuillam',
      'uzhavar': 'tn-uzhavar'
    };

    for (const [s, targetKey] of Object.entries(slugMap)) {
      if (clean.includes(s)) {
        return SCHEMES_REGISTRY[targetKey];
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // 2. STATE ENGINE
  // ---------------------------------------------------------------------------
  let currentScheme = null;
  let currentStep = 1;
  let formValues = {};
  let userWalletDocs = [];
  let currentUserId = null;
  let autoSaveTimeout = null;
  let eligibilityStatus = 'not_checked'; // 'eligible' | 'potentially_relevant' | 'not_eligible' | 'not_checked'
  let isAadhaarMasked = true;

  // Standard Step 1 (Applicant) & Step 2 (Demographics) & Step 4 (Bank DBT) fields
  const STANDARD_STEP_FIELDS = {
    step1: [
      {
        id: 'applicant_name',
        label: 'Full Legal Name of Applicant',
        label_ta: 'விண்ணப்பதாரரின் முழுப் பெயர்',
        type: 'text',
        required: true,
        placeholder: 'e.g. Kavitha R',
        hint: 'Enter your name exactly as printed on your Aadhaar Card and Official ID.',
        validation: (v) => (v || '').trim().length >= 3,
        errorMessage: 'Please enter a valid applicant name (at least 3 characters).',
        what_is_it: 'The official full name of the citizen applying for the government scheme.',
        why_required: 'Matched against government identity registries (Aadhaar/Ration Card) to prevent duplicate applications.',
        where_to_find: 'Front face of Aadhaar Card, Voter ID, or Smart Ration Card.',
        format_guide: 'Name followed by initial or surname as shown on Aadhaar.',
        common_mistakes: ['Entering initials first when document has them last', 'Using nickname or abbreviation'],
        example_value: 'Kavitha R'
      },
      {
        id: 'dob',
        label: 'Date of Birth',
        label_ta: 'பிறந்த தேதி',
        type: 'date',
        required: true,
        hint: 'Your official date of birth as recorded on government documents.',
        validation: (v) => {
          if (!v) return false;
          const d = new Date(v);
          return !isNaN(d.getTime()) && d < new Date();
        },
        errorMessage: 'Enter a valid date of birth.',
        what_is_it: 'The day, month, and year of the applicant’s birth.',
        why_required: 'Determines age eligibility according to statutory scheme rules.',
        where_to_find: 'Aadhaar Card, Birth Certificate, or 10th Marksheet.',
        format_guide: 'Select from calendar picker (YYYY-MM-DD).',
        common_mistakes: ['Entering current date by accident'],
        example_value: '1992-05-14'
      },
      {
        id: 'gender',
        label: 'Gender',
        label_ta: 'பாலினம்',
        type: 'select',
        options: [
          { value: 'female', label: 'Female' },
          { value: 'male', label: 'Male' },
          { value: 'transgender', label: 'Transgender' }
        ],
        required: true,
        validation: (v) => !!v,
        errorMessage: 'Please select gender.',
        what_is_it: 'Gender of the applicant as recognized in official documentation.',
        why_required: 'Schemes like KMUT and Pudhumai Penn specifically support female citizens.',
        where_to_find: 'Aadhaar Card or Smart Family Card.',
        format_guide: 'Select from dropdown.',
        common_mistakes: ['Leaving unselected'],
        example_value: 'Female'
      },
      {
        id: 'mobile',
        label: 'Aadhaar-Linked Mobile Number',
        label_ta: 'ஆதாருடன் இணைக்கப்பட்ட கைபேசி எண்',
        type: 'text',
        required: true,
        placeholder: '9876543210',
        hint: 'Active 10-digit Indian mobile number to receive official OTP and application updates.',
        validation: (v) => /^[6-9]\d{9}$/.test((v || '').trim()),
        errorMessage: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
        what_is_it: 'Your active mobile phone number linked with Aadhaar and bank DBT.',
        why_required: 'Government departments send e-KYC one-time passwords (OTP) and subsidy SMS notifications here.',
        where_to_find: 'The SIM card in your phone that receives Aadhaar OTPs.',
        format_guide: '10 digits without +91 or country code.',
        common_mistakes: ['Entering landline number', 'Typing 91 prefix causing 12 digits'],
        example_value: '9840112345'
      },
      {
        id: 'email',
        label: 'Email Address',
        label_ta: 'மின்னஞ்சல் முகவரி',
        type: 'text',
        required: false,
        placeholder: 'citizen@example.com',
        hint: 'Optional email address for digital acknowledgment receipt.',
        validation: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
        errorMessage: 'Please enter a valid email address or leave blank.',
        what_is_it: 'Digital electronic mail inbox address.',
        why_required: 'Allows portals to deliver official PDF application copies.',
        where_to_find: 'Your personal Gmail/Outlook email account.',
        format_guide: 'username@domain.com',
        common_mistakes: ['Typing .con instead of .com'],
        example_value: 'kavitha.r@gmail.com'
      },
      {
        id: 'aadhaar_no',
        label: '12-Digit Aadhaar Card Number',
        label_ta: '12 இலக்க ஆதார் எண்',
        type: 'masked',
        required: true,
        placeholder: '1234 5678 9012',
        hint: '12-digit Unique Identification Number. Masked for your privacy.',
        validation: (v) => /^\d{12}$/.test((v || '').replace(/\s+/g, '')),
        errorMessage: 'Enter a valid 12-digit numeric Aadhaar number.',
        what_is_it: 'The 12-digit individual identification number issued by the UIDAI.',
        why_required: 'Primary identification and DBT bank routing requirement for government welfare.',
        where_to_find: 'Printed on the front face of your physical Aadhaar card or e-Aadhaar PDF.',
        format_guide: '12 digits numeric without letters.',
        common_mistakes: ['Typing Enrolment ID (28 digits) instead of Aadhaar Number', 'Entering spaces/hyphens in strict fields'],
        example_value: '1234 5678 9012',
        sensitive: true
      }
    ],

    step2: [
      {
        id: 'district',
        label: 'District',
        label_ta: 'மாவட்டம்',
        type: 'select',
        options: [
          'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
          'Erode', 'Vellore', 'Thanjavur', 'Dindigul', 'Kanchipuram', 'Cuddalore',
          'Dharmapuri', 'Karur', 'Nagapattinam', 'Namakkal', 'Perambalur', 'Pudukkottai',
          'Ramanathapuram', 'Sivaganga', 'Theni', 'Thiruvallur', 'Thiruvarur', 'Thoothukudi',
          'Tiruppur', 'Tiruvannamalai', 'The Nilgiris', 'Villupuram', 'Virudhunagar',
          'Ariyalur', 'Krishnagiri', 'Tenkasi', 'Tirupathur', 'Ranipet', 'Chengalpattu',
          'Kallakurichi', 'Mayiladuthurai'
        ].map(d => ({ value: d, label: d })),
        required: true,
        validation: (v) => !!v,
        errorMessage: 'Please select your residential district.',
        what_is_it: 'Administrative revenue district where your permanent residence is situated.',
        why_required: 'Assigns your application to the appropriate District Collectorate, Tahsildar, or BDO.',
        where_to_find: 'Address line on Smart Ration Card or Aadhaar Card.',
        format_guide: 'Select from dropdown.',
        common_mistakes: ['Selecting current workplace district instead of residential native district'],
        example_value: 'Madurai'
      },
      {
        id: 'taluk',
        label: 'Taluk / Block',
        label_ta: 'வட்டம் / ஊராட்சி ஒன்றியம்',
        type: 'text',
        required: true,
        placeholder: 'e.g. Madurai South',
        hint: 'Revenue taluk or municipal block under your district.',
        validation: (v) => (v || '').trim().length >= 3,
        errorMessage: 'Enter taluk name.',
        what_is_it: 'The sub-district administrative division encompassing your village/town.',
        why_required: 'Determines local VAO inspection and camp verification venue.',
        where_to_find: 'Listed on Smart Family Card address.',
        format_guide: 'Taluk name.',
        common_mistakes: ['Entering village name instead of taluk'],
        example_value: 'Madurai South'
      },
      {
        id: 'residential_address',
        label: 'Permanent Residential Address',
        label_ta: 'நிரந்தர முகவரி',
        type: 'text',
        required: true,
        placeholder: 'Door No, Street Name, Village/Town',
        hint: 'Complete street and door number address.',
        validation: (v) => (v || '').trim().length >= 6,
        errorMessage: 'Enter complete residential address.',
        what_is_it: 'Physical residence location of the applicant.',
        why_required: 'Enables physical field verification and postal delivery of scheme cards.',
        where_to_find: 'Ration card address.',
        format_guide: 'Door number, street, locality.',
        common_mistakes: ['Omitting door number or street name'],
        example_value: '12, West Car Street, Alanganallur'
      },
      {
        id: 'pincode',
        label: 'Postal Pincode',
        label_ta: 'அஞ்சல் குறியீட்டு எண்',
        type: 'text',
        required: true,
        placeholder: '625501',
        hint: '6-digit Indian postal code.',
        validation: (v) => /^[1-9]\d{5}$/.test((v || '').trim()),
        errorMessage: 'Enter valid 6-digit Indian pincode.',
        what_is_it: 'Six-digit postal index number.',
        why_required: 'Directs communication and village post office DBT payouts.',
        where_to_find: 'Postal letters or back of Aadhaar.',
        format_guide: '6 digits without spaces.',
        common_mistakes: ['Entering 5 digits by mistake'],
        example_value: '625501'
      },
      {
        id: 'community',
        label: 'Social Community Category',
        label_ta: 'சமூகப் பிரிவு',
        type: 'select',
        options: [
          { value: 'BC', label: 'BC — Backward Class' },
          { value: 'MBC', label: 'MBC / DNC — Most Backward Class' },
          { value: 'SC', label: 'SC — Scheduled Caste' },
          { value: 'ST', label: 'ST — Scheduled Tribe' },
          { value: 'OC', label: 'OC / General' }
        ],
        required: true,
        validation: (v) => !!v,
        errorMessage: 'Select your community classification.',
        what_is_it: 'Recognized social category under Government of Tamil Nadu / GoI.',
        why_required: 'Certain government schemes offer dedicated grants, relaxation, or priority quotas.',
        where_to_find: 'Community Certificate issued by Revenue Tahsildar.',
        format_guide: 'Select from dropdown.',
        common_mistakes: ['Selecting general category if holding a verified BC/MBC certificate'],
        example_value: 'BC'
      }
    ],

    step4: [
      {
        id: 'bank_name',
        label: 'Bank Name',
        label_ta: 'வங்கியின் பெயர்',
        type: 'text',
        required: true,
        placeholder: 'e.g. State Bank of India / Indian Bank',
        hint: 'Name of the commercial or public sector bank holding your active savings account.',
        validation: (v) => (v || '').trim().length >= 3,
        errorMessage: 'Enter bank name.',
        what_is_it: 'Financial institution where your personal account is opened.',
        why_required: 'Identifies clearing bank for Direct Benefit Transfer (DBT) credit.',
        where_to_find: 'Front cover of bank passbook.',
        format_guide: 'Official bank name.',
        common_mistakes: ['Entering branch name without bank name'],
        example_value: 'Indian Bank'
      },
      {
        id: 'acc_holder_name',
        label: 'Account Holder Name in Bank',
        label_ta: 'வங்கி கணக்குப் புத்தகத்தில் உள்ள பெயர்',
        type: 'text',
        required: true,
        placeholder: 'e.g. Kavitha R',
        hint: 'Name exactly as printed on your bank passbook / cheque book.',
        validation: (v) => (v || '').trim().length >= 3,
        errorMessage: 'Enter account holder name.',
        what_is_it: 'Name registered in bank core banking records.',
        why_required: 'NPCI Aadhaar Payment Bridge validates that account name matches applicant.',
        where_to_find: 'Printed on passbook first page.',
        format_guide: 'Exact passbook spelling.',
        common_mistakes: ['Spelling discrepancies between bank passbook and Aadhaar'],
        example_value: 'Kavitha R'
      },
      {
        id: 'bank_acc_no',
        label: 'Savings Bank Account Number',
        label_ta: 'வங்கி கணக்கு எண்',
        type: 'text',
        required: true,
        placeholder: 'e.g. 50123456789',
        hint: '9 to 18 digit account number. DBT payments will be credited directly here.',
        validation: (v) => /^\d{9,18}$/.test((v || '').trim()),
        errorMessage: 'Enter a valid bank account number (9 to 18 numeric digits).',
        what_is_it: 'Unique bank account identifier for electronic financial transfers.',
        why_required: 'Direct Benefit Transfer (DBT) funds are deposited directly to this account.',
        where_to_find: 'First page of your bank passbook or mobile banking app.',
        format_guide: 'Numeric digits only without spaces or hyphens.',
        common_mistakes: ['Entering debit card number instead of bank account number', 'Missing leading zeros in account number'],
        example_value: '50123456789',
        sensitive: true
      },
      {
        id: 'ifsc_code',
        label: 'Bank Branch IFSC Code',
        label_ta: 'வங்கி கிளை ஐ.எஃப்.எஸ்.சி (IFSC) குறியீடு',
        type: 'text',
        required: true,
        placeholder: 'e.g. IDIB000M012',
        hint: '11-character alpha-numeric code printed on bank passbook.',
        validation: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test((v || '').trim()),
        errorMessage: 'Enter valid 11-character IFSC code (e.g. SBIN0001234).',
        what_is_it: 'Indian Financial System Code uniquely identifying your specific bank branch.',
        why_required: 'Ensures electronic funds routing reaches the exact branch where your account resides.',
        where_to_find: 'Top of passbook first page or on a cheque leaf.',
        format_guide: '11 characters: 4 letters, 5th character is zero "0", followed by 6 alphanumeric digits.',
        common_mistakes: ['Confusing letter "O" with number "0" (the 5th character is ALWAYS zero 0)'],
        example_value: 'IDIB000M012'
      },
      {
        id: 'aadhaar_dbt_linked',
        label: 'Is this bank account linked to your Aadhaar for Direct Benefit Transfer (DBT)?',
        label_ta: 'இந்த வங்கிக் கணக்கு ஆதாருடன் நேரடி பலன் பரிமாற்றத்திற்காக (DBT) இணைக்கப்பட்டுள்ளதா?',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes — Account is Aadhaar-Seeded & DBT Active' },
          { value: 'no', label: 'No / Not Sure — Need to visit bank branch to enable DBT' }
        ],
        required: true,
        validation: (v) => !!v,
        errorMessage: 'Please specify Aadhaar DBT status.',
        what_is_it: 'Verification of NPCI Aadhaar mapper linkage.',
        why_required: 'Government subsidies are disbursed via NPCI Aadhaar Payment Bridge System (APBS).',
        where_to_find: 'Can be checked via UIDAI resident portal or bank branch inquiry.',
        format_guide: 'Select from dropdown.',
        common_mistakes: ['Assuming having an ATM card means DBT is active (DBT requires separate Aadhaar consent at bank)'],
        example_value: 'Yes'
      }
    ]
  };

  // ---------------------------------------------------------------------------
  // 3. INITIALIZATION & USER CONTEXT
  // ---------------------------------------------------------------------------
  function getActiveUserId() {
    try {
      if (typeof window.getCurrentUser === 'function') {
        const u = window.getCurrentUser();
        if (u?.id) return u.id;
      }
      const raw = localStorage.getItem('cc_session') || sessionStorage.getItem('cc_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.id) return parsed.user.id;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const val = localStorage.getItem(k);
          if (val) {
            const p = JSON.parse(val);
            if (p?.user?.id) return p.user.id;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function getSchemeIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get('scheme') || 
                  params.get('scheme_id') || 
                  params.get('schemeId') || 
                  params.get('schemeCode') || 
                  params.get('code') || 
                  params.get('id');
      if (val && val.trim()) return val.trim();
    } catch (e) {}
    return null;
  }

  // Load uploaded documents from Supabase / localStorage for wallet matching
  async function loadUserWalletDocs() {
    userWalletDocs = [];
    currentUserId = getActiveUserId();

    // 1. Try local storage cache
    try {
      const local = localStorage.getItem('cc_user_uploaded_docs');
      if (local) {
        const arr = JSON.parse(local);
        if (Array.isArray(arr)) userWalletDocs = arr;
      }
    } catch (e) {}

    // 2. Query Supabase user_document_wallet in background if available
    try {
      if (typeof window.getOrInitSupabaseClient === 'function' && currentUserId) {
        const clientPromise = window.getOrInitSupabaseClient();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
        const client = await Promise.race([clientPromise, timeoutPromise]).catch(() => null);

        if (client) {
          const { data, error } = await client
            .from('user_document_wallet')
            .select('id, user_id, doc_type, doc_name, file_size, file_format, created_at')
            .eq('user_id', currentUserId);

          if (!error && Array.isArray(data) && data.length > 0) {
            userWalletDocs = data;
            try {
              localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(data));
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[FormAssistant] Wallet load notice:', e.message || e);
    }
  }

  // Check connected eligibility assessment
  function checkConnectedEligibility() {
    if (!currentScheme) {
      eligibilityStatus = 'not_checked';
      return;
    }
    try {
      // 1. Check scheme checker results in session
      const storedResults = sessionStorage.getItem('cc_scheme_results_data');
      if (storedResults) {
        const results = JSON.parse(storedResults);
        if (Array.isArray(results)) {
          const found = results.find(r => 
            (r.id && r.id === currentScheme.id) || 
            (r.scheme_code && r.scheme_code === currentScheme.code) || 
            (r.id && r.id === currentScheme.code) ||
            (r.id && currentScheme.uuid && r.id === currentScheme.uuid)
          );
          if (found) {
            if (currentScheme.id === 'tn-nm' || currentScheme.id === 'tn-naanmudhalvan' || currentScheme.code === 'TN-NM-003') {
              eligibilityStatus = 'potentially_relevant';
              return;
            }
            eligibilityStatus = found.eligible ? 'eligible' : 'not_eligible';
            return;
          }
        }
      }

      // 2. Check profile in session
      const profile = sessionStorage.getItem('cc_scheme_checker_profile');
      if (profile) {
        if (currentScheme.id === 'tn-nm' || currentScheme.id === 'tn-naanmudhalvan' || currentScheme.code === 'TN-NM-003') {
          eligibilityStatus = 'potentially_relevant';
          return;
        }
        eligibilityStatus = 'eligible';
        return;
      }
    } catch (e) {}

    eligibilityStatus = 'not_checked';
  }

  // ---------------------------------------------------------------------------
  // 4. DRAFT ENGINE (USER-ISOLATED, AUTOSAVING, RESUME)
  // ---------------------------------------------------------------------------
  function getDraftStorageKey(schemeId) {
    const uid = currentUserId || 'guest';
    return `cc_form_draft_${uid}_${schemeId}`;
  }

  function hasSavedDraft(schemeId) {
    try {
      const key = getDraftStorageKey(schemeId);
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      // Ensure draft contains entered values and belongs to current user
      if (parsed && parsed.fields && Object.keys(parsed.fields).length > 0) {
        if (!parsed.userId || parsed.userId === currentUserId || !currentUserId) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  }

  function loadDraft(schemeId) {
    const draft = hasSavedDraft(schemeId);
    if (draft) {
      formValues = { ...(draft.fields || {}) };
      if (draft.step && draft.step >= 1 && draft.step <= 6) {
        currentStep = draft.step;
      }
      return true;
    }
    formValues = {};
    currentStep = 1;
    return false;
  }

  function saveDraft(isManual = false) {
    try {
      const key = getDraftStorageKey(currentScheme.id);
      const payload = {
        userId: currentUserId,
        schemeId: currentScheme.id,
        schemeCode: currentScheme.code,
        step: currentStep,
        fields: formValues,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(payload));

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const indicator = document.getElementById('autosave-indicator');
      if (indicator) {
        indicator.textContent = `Draft saved at ${timeStr}`;
      }

      if (isManual && window.showToast) {
        window.showToast("Application draft progress saved successfully!", "info");
      }
    } catch (e) {
      console.warn('[FormAssistant] Save draft error:', e);
    }
  }

  function discardDraft(schemeId) {
    try {
      const key = getDraftStorageKey(schemeId);
      localStorage.removeItem(key);
      formValues = {};
      currentStep = 1;
    } catch (e) {}
  }

  function triggerAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      saveDraft(false);
    }, 1200);
  }

  // ---------------------------------------------------------------------------
  // 5. PROFILE PREFILL (CROSS-USER SECURITY VERIFIED)
  // ---------------------------------------------------------------------------
  function prefillFromUserProfile() {
    currentUserId = getActiveUserId();
    if (!currentUserId) {
      if (window.showToast) window.showToast("Please sign in to auto-prefill from your verified profile.", "info");
      return;
    }

    let profile = null;

    // Check user-scoped profile key
    try {
      const raw = localStorage.getItem(`cc_user_profile_${currentUserId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
          profile = parsed;
        }
      }
    } catch (e) {}

    // Fallback: check general profile only if ID strictly matches
    if (!profile) {
      try {
        const general = localStorage.getItem('cc_user_profile');
        if (general) {
          const parsed = JSON.parse(general);
          if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
            profile = parsed;
          }
        }
      } catch (e) {}
    }

    // Secondary source: session scheme checker profile
    let checkerProfile = {};
    try {
      checkerProfile = JSON.parse(sessionStorage.getItem('cc_scheme_checker_profile') || '{}');
    } catch (e) {}

    let prefilledCount = 0;

    const setFieldVal = (id, val) => {
      if (val && (!formValues[id] || formValues[id].trim() === '')) {
        formValues[id] = String(val).trim();
        prefilledCount++;
      }
    };

    if (profile) {
      setFieldVal('applicant_name', profile.full_name || profile.name);
      setFieldVal('mobile', profile.phone || profile.mobile);
      setFieldVal('email', profile.email);
      setFieldVal('district', profile.district);
      setFieldVal('taluk', profile.taluk);
      setFieldVal('residential_address', profile.address);
      setFieldVal('pincode', profile.pincode);
      setFieldVal('gender', profile.gender ? profile.gender.toLowerCase() : '');
      setFieldVal('dob', profile.dob || profile.date_of_birth);
      setFieldVal('community', profile.community || profile.caste);
    }

    if (checkerProfile) {
      if (checkerProfile.gender) setFieldVal('gender', checkerProfile.gender.toLowerCase());
      if (checkerProfile.district) setFieldVal('district', checkerProfile.district);
      if (checkerProfile.annual_income || checkerProfile.annualIncome) {
        setFieldVal('annual_income', checkerProfile.annual_income || checkerProfile.annualIncome);
      }
    }

    saveDraft(false);
    renderActiveStep();
    updateReadinessDashboard();

    if (prefilledCount > 0) {
      if (window.showToast) window.showToast(`Auto-prefilled ${prefilledCount} fields from your verified profile!`, "success");
    } else {
      if (window.showToast) window.showToast("Profile details already up-to-date in this form.", "info");
    }
  }

  // ---------------------------------------------------------------------------
  // 6. SCHEME SWITCHER & URL SYNC
  // ---------------------------------------------------------------------------
  function populateSchemeSwitcher(selectedSchemeId = null) {
    const switcher = document.getElementById('scheme-switcher');
    if (!switcher) return;

    const currentVal = selectedSchemeId || currentScheme?.code || currentScheme?.id || '';
    const resolvedCurrent = currentVal ? resolveSchemeMeta(currentVal) : null;

    let html = `<option value="" ${!resolvedCurrent ? 'selected' : ''}>-- Choose a Government Scheme --</option>`;

    // Map unique schemes by code to avoid duplicate entries
    const uniqueSchemes = [];
    const seenCodes = new Set();
    Object.values(SCHEMES_REGISTRY).forEach(sch => {
      if (sch && sch.code && !seenCodes.has(sch.code)) {
        seenCodes.add(sch.code);
        uniqueSchemes.push(sch);
      }
    });

    html += uniqueSchemes.map(sch => {
      const isSelected = resolvedCurrent && (
        resolvedCurrent.code === sch.code || 
        resolvedCurrent.id === sch.id ||
        resolvedCurrent.uuid === sch.uuid
      );
      return `<option value="${sch.code}" ${isSelected ? 'selected' : ''}>${sch.code} — ${sch.name}</option>`;
    }).join('');

    switcher.innerHTML = html;

    switcher.onchange = (e) => {
      const chosen = e.target.value;
      if (chosen) {
        selectScheme(chosen);
      } else {
        renderSchemeSelectionState();
      }
    };
  }

  function selectScheme(schemeIdentifier, updateHistory = true) {
    const newScheme = resolveSchemeMeta(schemeIdentifier);
    if (!newScheme) {
      renderSchemeLoadError(schemeIdentifier);
      return;
    }

    currentScheme = newScheme;

    // Update URL query parameter without page reload
    if (updateHistory) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('scheme', currentScheme.code);
        window.history.pushState({ schemeId: currentScheme.code }, '', url.toString());
      } catch (e) {}
    }

    // Sync dropdown value (robust match by code, id, or uuid)
    const switcher = document.getElementById('scheme-switcher');
    if (switcher) {
      const match = Array.from(switcher.options).find(opt => 
        opt.value === currentScheme.code || 
        opt.value === currentScheme.id || 
        opt.value === currentScheme.uuid ||
        (opt.value && opt.value.toLowerCase() === currentScheme.code.toLowerCase())
      );
      if (match) {
        switcher.value = match.value;
      }
    }

    // Update Header
    updateHeaderUI();

    // Check if saved draft exists for this scheme
    const existingDraft = hasSavedDraft(currentScheme.id) || hasSavedDraft(currentScheme.code);
    const resumeAlert = document.getElementById('resume-draft-alert');

    if (existingDraft) {
      if (resumeAlert) {
        const titleElem = document.getElementById('resume-alert-title');
        const descElem = document.getElementById('resume-alert-desc');
        const formattedDate = existingDraft.lastSaved 
          ? new Date(existingDraft.lastSaved).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : 'recently';
        const fieldsCount = Object.keys(existingDraft.fields || {}).length;

        if (titleElem) titleElem.textContent = `Resume Draft for ${currentScheme.name}`;
        if (descElem) descElem.textContent = `You have an in-progress draft saved on ${formattedDate} (${fieldsCount} fields prepared).`;
        resumeAlert.style.display = 'flex';
      }
      loadDraft(currentScheme.id);
    } else {
      if (resumeAlert) resumeAlert.style.display = 'none';
      formValues = {};
      currentStep = 1;
    }

    checkConnectedEligibility();
    renderStepper(false);
    renderActiveStep();
    updateReadinessDashboard();
  }

  function renderSchemeSelectionState() {
    currentScheme = null;
    formValues = {};
    currentStep = 1;

    // Clean URL query param
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('scheme');
      url.searchParams.delete('id');
      url.searchParams.delete('code');
      url.searchParams.delete('scheme_id');
      url.searchParams.delete('schemeCode');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    } catch (e) {}

    // Header UI
    const nameElem = document.getElementById('current-scheme-name');
    const deptElem = document.getElementById('current-scheme-dept');
    const typeElem = document.getElementById('current-scheme-type');
    const portalBtn = document.getElementById('btn-portal-submit');

    if (nameElem) {
      nameElem.textContent = 'Select a government scheme to begin';
      nameElem.style.color = '';
    }
    if (deptElem) deptElem.innerHTML = `<i class="fa-solid fa-landmark"></i> Tamil Nadu & Central Welfare Schemes`;
    if (typeElem) typeElem.textContent = 'Citizen Assistant';
    if (portalBtn) {
      portalBtn.href = '#';
      portalBtn.style.pointerEvents = 'none';
      portalBtn.style.opacity = '0.5';
      portalBtn.innerHTML = `<span>Select Scheme to Continue</span> <i class="fa-solid fa-arrow-right"></i>`;
    }

    // Hide draft alert
    const resumeAlert = document.getElementById('resume-draft-alert');
    if (resumeAlert) resumeAlert.style.display = 'none';

    // Update switcher dropdown selection to empty
    const switcher = document.getElementById('scheme-switcher');
    if (switcher) switcher.value = '';

    // Render stepper in inactive state
    renderStepper(true);

    // Render scheme cards grid in #active-step-content
    const container = document.getElementById('active-step-content');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; max-width: 650px; margin: 0 auto 2rem auto;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, rgba(13, 148, 136, 0.15), rgba(99, 102, 241, 0.15)); display: inline-flex; align-items: center; justify-content: center; font-size: 1.6rem; color: var(--primary); margin-bottom: 1rem;">
            <i class="fa-solid fa-list-check"></i>
          </div>
          <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">
            Select a Government Scheme to Begin
          </h2>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
            CrowdCity AI assists you in preparing and validating your welfare application details, checking required documents from your Document Wallet, and offering intelligent field-by-field guidance.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${Object.values(SCHEMES_REGISTRY).map(sch => `
            <div class="scheme-select-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease, box-shadow 0.15s ease; cursor: pointer;" onclick="CrowdCityFormAssistant.selectScheme('${sch.id}')">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; gap: 0.5rem;">
                  <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); background: rgba(13, 148, 136, 0.1); padding: 0.15rem 0.5rem; border-radius: 6px;">
                    ${sch.code}
                  </span>
                  <span style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                    ${sch.type === 'state' ? 'Tamil Nadu' : 'Central'}
                  </span>
                </div>
                <h4 style="font-size: 0.98rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.4rem 0; line-height: 1.35;">
                  ${sch.name}
                </h4>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.65rem; line-height: 1.4;">
                  <i class="fa-solid fa-landmark" style="font-size: 0.7rem;"></i> ${sch.dept}
                </div>
                <p style="font-size: 0.8rem; color: var(--text-main); opacity: 0.85; margin: 0 0 1rem 0; line-height: 1.45;">
                  ${sch.short_desc}
                </p>
              </div>
              <button type="button" class="btn btn-primary" style="width: 100%; padding: 0.55rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;" onclick="event.stopPropagation(); CrowdCityFormAssistant.selectScheme('${sch.id}')">
                <span>Start Application</span> <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    updateReadinessDashboard(true);
  }

  function renderSchemeLoadError(identifier) {
    currentScheme = null;
    formValues = {};

    const nameElem = document.getElementById('current-scheme-name');
    const deptElem = document.getElementById('current-scheme-dept');
    const typeElem = document.getElementById('current-scheme-type');
    const portalBtn = document.getElementById('btn-portal-submit');

    if (nameElem) {
      nameElem.textContent = 'Selected government scheme could not be found.';
      nameElem.style.color = '#ef4444';
    }
    if (deptElem) deptElem.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Scheme "${identifier || 'Unknown'}" not found`;
    if (typeElem) typeElem.textContent = 'Not Found';
    if (portalBtn) {
      portalBtn.href = '#';
      portalBtn.style.pointerEvents = 'none';
      portalBtn.style.opacity = '0.5';
    }

    const container = document.getElementById('active-step-content');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; max-width: 500px; margin: 0 auto;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; color: #ef4444; margin-bottom: 1.25rem;">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
          <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">
            Selected government scheme could not be found.
          </h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin: 0 0 1.75rem 0;">
            The requested scheme identifier <code>${identifier || ''}</code> was not found or is currently unavailable. Please pick a scheme from the directory.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" style="padding: 0.65rem 1.35rem; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;" onclick="CrowdCityFormAssistant.resetToSchemeSelector()">
              <i class="fa-solid fa-list"></i> Choose Another Scheme
            </button>
            <button type="button" class="btn btn-secondary" style="padding: 0.65rem 1.2rem; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;" onclick="location.reload()">
              <i class="fa-solid fa-rotate-right"></i> Retry
            </button>
          </div>
        </div>
      `;
    }

    updateReadinessDashboard(true);
  }

  function updateHeaderUI() {
    if (!currentScheme) return;
    const nameElem = document.getElementById('current-scheme-name');
    const deptElem = document.getElementById('current-scheme-dept');
    const typeElem = document.getElementById('current-scheme-type');
    const portalBtn = document.getElementById('btn-portal-submit');

    const isTamil = (window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'ta');

    if (nameElem) {
      nameElem.textContent = isTamil ? (currentScheme.name_ta || currentScheme.name) : currentScheme.name;
      nameElem.style.color = '';
    }
    if (deptElem) {
      deptElem.innerHTML = `<i class="fa-solid fa-landmark"></i> ${isTamil ? (currentScheme.dept_ta || currentScheme.dept) : currentScheme.dept}`;
    }
    if (typeElem) {
      typeElem.textContent = currentScheme.type === 'state' ? 'Tamil Nadu State Scheme' : 'Government of India Scheme';
    }
    if (portalBtn) {
      portalBtn.href = currentScheme.portal;
      portalBtn.style.pointerEvents = 'auto';
      portalBtn.style.opacity = '1';
      portalBtn.innerHTML = `<span>Continue on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>`;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. STEPPER RENDERING & NAVIGATION
  // ---------------------------------------------------------------------------
  const STEPS_CONFIG = [
    { num: 1, title: 'Applicant', sub: 'Personal ID', icon: 'fa-user' },
    { num: 2, title: 'Demographics', sub: 'Address & Taluk', icon: 'fa-location-dot' },
    { num: 3, title: 'Scheme Details', sub: 'Specific Rules', icon: 'fa-file-lines' },
    { num: 4, title: 'Bank / DBT', sub: 'Payment Routing', icon: 'fa-building-columns' },
    { num: 5, title: 'Documents', sub: 'Wallet Check', icon: 'fa-folder-open' },
    { num: 6, title: 'Readiness', sub: 'Review & Apply', icon: 'fa-clipboard-check' }
  ];

  function renderStepper(isInactive = false) {
    const stepperContainer = document.getElementById('assistant-stepper');
    if (!stepperContainer) return;

    stepperContainer.innerHTML = STEPS_CONFIG.map((step, idx) => {
      const isCompleted = !isInactive && step.num < currentStep;
      const isActive = !isInactive && step.num === currentStep;
      const stateClass = isActive ? 'active' : (isCompleted ? 'completed' : '');

      let circleContent = step.num;
      if (isCompleted) circleContent = '<i class="fa-solid fa-check"></i>';

      const connector = idx < STEPS_CONFIG.length - 1
        ? `<div class="step-connector-line ${isCompleted ? 'completed' : ''}"></div>`
        : '';

      return `
        <div class="step-item ${stateClass}" data-step="${step.num}" style="${isInactive ? 'cursor: default; opacity: 0.65;' : ''}">
          <div class="step-num-circle">${circleContent}</div>
          <div class="step-text-wrap">
            <span class="step-title-text">${step.title}</span>
            <span class="step-sub-text">${step.sub}</span>
          </div>
        </div>
        ${connector}
      `;
    }).join('');

    if (!isInactive) {
      stepperContainer.querySelectorAll('.step-item').forEach(item => {
        item.addEventListener('click', () => {
          const targetStep = parseInt(item.dataset.step, 10);
          goToStep(targetStep);
        });
      });
    }
  }

  function goToStep(stepNum) {
    if (!currentScheme) return;
    if (stepNum < 1 || stepNum > 6) return;
    currentStep = stepNum;
    renderStepper(false);
    renderActiveStep();
    saveDraft(false);

    // Smooth scroll into form view
    const contentArea = document.getElementById('active-step-content');
    if (contentArea) {
      contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. STEP FORM RENDERING
  // ---------------------------------------------------------------------------
  function getActiveFieldsForCurrentStep() {
    if (currentStep === 1) return STANDARD_STEP_FIELDS.step1;
    if (currentStep === 2) return STANDARD_STEP_FIELDS.step2;
    if (currentStep === 3) return currentScheme?.specific_fields || [];
    if (currentStep === 4) return STANDARD_STEP_FIELDS.step4;
    return [];
  }

  function renderActiveStep() {
    const container = document.getElementById('active-step-content');
    if (!container) return;

    if (!currentScheme) {
      renderSchemeSelectionState();
      return;
    }

    if (currentScheme.isGeneric || (!currentScheme.specific_fields && currentScheme.required_documents?.length === 0)) {
      renderGenericSchemeHandoff(container);
      return;
    }

    if (currentStep >= 1 && currentStep <= 4) {
      renderStandardStepFields(container);
    } else if (currentStep === 5) {
      renderDocumentsStep(container);
    } else if (currentStep === 6) {
      renderReviewStep(container);
    }
  }

  function renderGenericSchemeHandoff(container) {
    container.innerHTML = `
      <div style="padding: 2.5rem 1.5rem; text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(99, 102, 241, 0.15); display: inline-flex; align-items: center; justify-content: center; font-size: 1.6rem; color: #6366f1; margin-bottom: 1.25rem;">
          <i class="fa-solid fa-file-invoice"></i>
        </div>
        <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">
          ${currentScheme.name}
        </h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; max-width: 550px; margin: 0 auto 1.5rem auto;">
          This scheme does not yet have a customized preparation form. You can still review the scheme requirements and continue directly to the official government portal.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <a href="${currentScheme.portal}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.75rem 1.6rem; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;">
            <span>Continue on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
          <button type="button" class="btn btn-secondary" style="padding: 0.75rem 1.4rem; font-weight: 700; border-radius: 10px;" onclick="CrowdCityFormAssistant.resetToSchemeSelector()">
            Choose Another Scheme
          </button>
        </div>
      </div>
    `;
  }

  function renderStandardStepFields(container) {
    const fields = getActiveFieldsForCurrentStep();
    const stepMeta = STEPS_CONFIG.find(s => s.num === currentStep);

    container.innerHTML = `
      <div class="step-header-intro">
        <div>
          <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--primary);">STEP ${currentStep} OF 6</span>
          <h2 class="step-heading-main">
            <i class="fa-solid ${stepMeta?.icon || 'fa-pen'}"></i> ${stepMeta?.title || 'Form Fields'}
          </h2>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ${fields.length} Field${fields.length > 1 ? 's' : ''} in this step
        </div>
      </div>

      <div class="step-fields-list">
        ${fields.map(field => renderSingleFieldHtml(field)).join('')}
      </div>

      <div class="step-actions-footer">
        <button type="button" class="btn btn-secondary btn-step-prev" ${currentStep === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
          <i class="fa-solid fa-arrow-left"></i> Previous Step
        </button>
        <button type="button" class="btn btn-primary btn-step-next">
          Next Step <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;

    attachFieldEventListeners(container, fields);
  }

  function renderSingleFieldHtml(field) {
    const val = formValues[field.id] || '';
    const isSensitive = field.sensitive || field.id === 'aadhaar_no';

    let inputHtml = '';

    if (field.type === 'select') {
      inputHtml = `
        <select id="field_${field.id}" class="field-input-item" data-field-id="${field.id}">
          <option value="">-- Select --</option>
          ${(field.options || []).map(opt => {
            const optVal = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            const selected = String(val) === String(optVal) ? 'selected' : '';
            return `<option value="${optVal}" ${selected}>${optLabel}</option>`;
          }).join('')}
        </select>
      `;
    } else if (field.type === 'masked') {
      inputHtml = `
        <div class="input-wrap-with-action">
          <input 
            id="field_${field.id}" 
            type="${isAadhaarMasked ? 'password' : 'text'}" 
            class="field-input-item" 
            data-field-id="${field.id}" 
            value="${val}" 
            placeholder="${field.placeholder || ''}" 
            maxlength="14"
          />
          <button type="button" class="field-input-toggle-btn btn-toggle-mask" data-field-id="${field.id}" title="Toggle Masking">
            <i class="fa-solid ${isAadhaarMasked ? 'fa-eye' : 'fa-eye-slash'}"></i>
          </button>
        </div>
      `;
    } else {
      inputHtml = `
        <input 
          id="field_${field.id}" 
          type="${field.type || 'text'}" 
          class="field-input-item" 
          data-field-id="${field.id}" 
          value="${val}" 
          placeholder="${field.placeholder || ''}" 
        />
      `;
    }

    return `
      <div class="form-field-card" id="field_card_${field.id}">
        <div class="form-field-header">
          <label for="field_${field.id}" class="form-field-label">
            ${field.label} ${field.required ? '<span style="color:#ef4444;">*</span>' : '<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(Optional)</span>'}
          </label>
          <button type="button" class="btn-field-ai-help" data-field-id="${field.id}">
            <i class="fa-solid fa-brain"></i> AI Guidance
          </button>
        </div>
        <p class="form-field-hint">${field.hint || ''}</p>
        ${inputHtml}
        <div class="field-inline-error" id="error_${field.id}">
          <i class="fa-solid fa-triangle-exclamation"></i> <span class="error-text">${field.errorMessage || 'Invalid input'}</span>
        </div>
      </div>
    `;
  }

  function attachFieldEventListeners(container, fields) {
    // Inputs listener
    fields.forEach(field => {
      const input = container.querySelector(`#field_${field.id}`);
      if (!input) return;

      input.addEventListener('input', () => {
        formValues[field.id] = input.value;
        validateField(field, input);
        triggerAutoSave();
        updateReadinessDashboard();
      });

      input.addEventListener('blur', () => {
        validateField(field, input);
      });
    });

    // Aadhaar mask toggle
    container.querySelectorAll('.btn-toggle-mask').forEach(btn => {
      btn.addEventListener('click', () => {
        isAadhaarMasked = !isAadhaarMasked;
        const targetId = btn.dataset.fieldId;
        const targetInput = container.querySelector(`#field_${targetId}`);
        if (targetInput) {
          targetInput.type = isAadhaarMasked ? 'password' : 'text';
          btn.innerHTML = `<i class="fa-solid ${isAadhaarMasked ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
        }
      });
    });

    // AI Guidance buttons
    container.querySelectorAll('.btn-field-ai-help').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fieldId = btn.dataset.fieldId;
        const foundField = fields.find(f => f.id === fieldId);
        if (foundField) {
          await openAiGuidanceModal(foundField);
        }
      });
    });

    // Step Nav
    const prevBtn = container.querySelector('.btn-step-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToStep(currentStep - 1));
    }
    const nextBtn = container.querySelector('.btn-step-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        // Validate current step
        let allValid = true;
        fields.forEach(f => {
          const inp = container.querySelector(`#field_${f.id}`);
          if (inp && !validateField(f, inp)) {
            allValid = false;
          }
        });
        goToStep(currentStep + 1);
      });
    }
  }

  function validateField(field, inputElem) {
    const errorElem = document.getElementById(`error_${field.id}`);
    const val = inputElem ? inputElem.value : (formValues[field.id] || '');

    let isValid = true;
    if (field.required && (!val || val.trim() === '')) {
      isValid = false;
    } else if (val && field.validation && typeof field.validation === 'function') {
      isValid = field.validation(val);
    }

    if (!isValid) {
      if (inputElem) inputElem.classList.add('has-error');
      if (errorElem) errorElem.style.display = 'flex';
    } else {
      if (inputElem) inputElem.classList.remove('has-error');
      if (errorElem) errorElem.style.display = 'none';
    }

    return isValid;
  }

  // ---------------------------------------------------------------------------
  // 9. STEP 5: REQUIRED DOCUMENTS & WALLET INTEGRATION
  // ---------------------------------------------------------------------------
  function renderDocumentsStep(container) {
    const reqDocs = currentScheme.required_documents || [];

    const documentCardsHtml = reqDocs.map(doc => {
      // Find matching document in user's wallet
      const matched = userWalletDocs.find(d => 
        (d.doc_type && d.doc_type.toLowerCase() === doc.doc_type.toLowerCase()) ||
        (d.doc_name && d.doc_name.toLowerCase().includes(doc.name.toLowerCase())) ||
        (doc.name.toLowerCase().includes(d.doc_name ? d.doc_name.toLowerCase() : ''))
      );

      const isAvailable = !!matched;

      return `
        <div class="doc-check-card" id="doc_card_${doc.doc_type}">
          <div class="doc-check-left">
            <div class="doc-check-icon ${isAvailable ? 'available' : 'missing'}">
              <i class="fa-solid ${isAvailable ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            </div>
            <div>
              <strong style="font-size: 0.92rem; color: var(--text-main); display: block;">
                ${doc.name} ${doc.required ? '<span style="color:#ef4444;">*</span>' : '<span style="font-size:0.75rem; color:var(--text-muted);">(Optional)</span>'}
              </strong>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">
                ${isAvailable 
                  ? `<span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-check"></i> Available in Document Wallet (${matched.doc_name || matched.file_format || 'PDF'})</span> • <span style="color:var(--text-muted);">Readiness: Ready</span>`
                  : `<span style="color:#f59e0b; font-weight:700;"><i class="fa-solid fa-clock"></i> Missing in Document Wallet</span>`}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${isAvailable ? `
              <button type="button" class="btn btn-secondary btn-view-doc" data-doc-name="${matched.doc_name || doc.name}" data-doc-type="${doc.doc_type}" style="padding: 0.4rem 0.8rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px;">
                <i class="fa-solid fa-eye"></i> View
              </button>
            ` : `
              <a href="my-documents.html?upload=${doc.doc_type}" class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none;">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload
              </a>
            `}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="step-header-intro">
        <div>
          <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--primary);">STEP 5 OF 6</span>
          <h2 class="step-heading-main">
            <i class="fa-solid fa-folder-open"></i> Required Documents & Wallet Integration
          </h2>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Cross-referenced with your CrowdCity Document Wallet
        </div>
      </div>

      <div style="background: rgba(13, 148, 136, 0.08); border: 1px solid rgba(13, 148, 136, 0.2); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--text-main); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <i class="fa-solid fa-shield-halved" style="color: var(--primary); margin-right: 0.35rem;"></i>
          <strong>Document Readiness Check:</strong> Verifies that all statutory application certificates are available before continuing to the official portal.
        </div>
        <a href="doc-verifier.html" style="font-size: 0.76rem; font-weight: 700; color: var(--primary); text-decoration: underline;">
          Open Document Verifier →
        </a>
      </div>

      <div class="documents-checklist-group">
        ${documentCardsHtml}
      </div>

      <div class="step-actions-footer">
        <button type="button" class="btn btn-secondary btn-step-prev">
          <i class="fa-solid fa-arrow-left"></i> Previous Step
        </button>
        <button type="button" class="btn btn-primary btn-step-next">
          Next Step (Review & Summary) <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;

    // Listeners
    container.querySelector('.btn-step-prev').addEventListener('click', () => goToStep(4));
    container.querySelector('.btn-step-next').addEventListener('click', () => goToStep(6));

    container.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docName = btn.dataset.docName;
        const docType = btn.dataset.docType;
        openDocPreviewModal(docName, docType);
      });
    });
  }

  function openDocPreviewModal(docName, docType) {
    const modal = document.getElementById('doc-preview-modal');
    const title = document.getElementById('doc-preview-title');
    const body = document.getElementById('doc-preview-body');

    if (title) title.textContent = `Document Preview: ${docName}`;
    if (body) {
      body.innerHTML = `
        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 2.5rem 1.5rem; text-align: center;">
          <i class="fa-solid fa-file-pdf" style="font-size: 3.5rem; color: #ef4444; margin-bottom: 1rem;"></i>
          <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">${docName}</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem auto;">
            This verified document is securely stored in your personal CrowdCity Document Wallet ready for official portal upload.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center;">
            <a href="my-documents.html" class="btn btn-secondary" style="padding: 0.5rem 1.25rem; font-weight: 700; border-radius: 8px; text-decoration: none;">
              Open in Document Wallet
            </a>
            <button type="button" id="btn-modal-close-preview" class="btn btn-primary" style="padding: 0.5rem 1.25rem; font-weight: 700; border-radius: 8px;">
              Done
            </button>
          </div>
        </div>
      `;
    }

    if (modal) modal.style.display = 'flex';

    const closeBtn = document.getElementById('btn-close-preview-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    const modalDone = document.getElementById('btn-modal-close-preview');
    if (modalDone) modalDone.onclick = () => modal.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // 10. STEP 6: APPLICATION SUMMARY & OFFICIAL PORTAL HANDOFF
  // ---------------------------------------------------------------------------
  function renderReviewStep(container) {
    const applicantName = formValues['applicant_name'] || 'Not provided';
    const mobile = formValues['mobile'] || 'Not provided';
    const district = formValues['district'] || 'Not provided';
    const smartCard = formValues['smart_card_no'] || formValues['patta_no'] || formValues['school_emis_id'] || 'N/A';

    const readinessScore = calculateReadinessScore();
    const reqDocs = currentScheme.required_documents || [];
    const availableDocsCount = reqDocs.filter(doc => 
      userWalletDocs.some(d => (d.doc_type && d.doc_type.toLowerCase() === doc.doc_type.toLowerCase()))
    ).length;

    container.innerHTML = `
      <div class="step-header-intro">
        <div>
          <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--primary);">STEP 6 OF 6</span>
          <h2 class="step-heading-main">
            <i class="fa-solid fa-clipboard-check"></i> Review & Application Summary
          </h2>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Comprehensive Preparation Summary
        </div>
      </div>

      <!-- Readiness Banner -->
      <div style="background: ${readinessScore.score >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${readinessScore.score >= 80 ? '#10b981' : '#f59e0b'}; border-radius: 14px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="font-size: 2rem; color: ${readinessScore.score >= 80 ? '#10b981' : '#f59e0b'};">
            <i class="fa-solid ${readinessScore.score >= 80 ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
          </div>
          <div>
            <strong style="font-size: 1.05rem; color: var(--text-main); display: block;">
              ${readinessScore.score}% Prepared — ${readinessScore.label}
            </strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">
              ${readinessScore.missingCount === 0 
                ? 'All mandatory fields and required certificates are prepared.' 
                : `${readinessScore.missingCount} item(s) require attention before official portal submission.`}
            </span>
          </div>
        </div>
        <button type="button" id="btn-recheck-readiness-step6" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px;">
          <i class="fa-solid fa-arrows-rotate"></i> Re-scan
        </button>
      </div>

      <!-- Application Summary Grid -->
      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 0.04em;">
          Application Summary
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">Applicant Name</span>
            <strong style="font-size: 0.92rem; color: var(--text-main);">${applicantName}</strong>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">Selected Scheme</span>
            <strong style="font-size: 0.92rem; color: var(--primary);">${currentScheme.name}</strong>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">Department</span>
            <strong style="font-size: 0.85rem; color: var(--text-main);">${currentScheme.dept}</strong>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">District / Taluk</span>
            <strong style="font-size: 0.85rem; color: var(--text-main);">${district}</strong>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">Key Identifier</span>
            <strong style="font-size: 0.85rem; color: var(--text-main); font-family: monospace;">${smartCard}</strong>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700; text-transform: uppercase;">Required Documents Available</span>
            <strong style="font-size: 0.85rem; color: #10b981;">${availableDocsCount} of ${reqDocs.length} Ready</strong>
          </div>
        </div>
      </div>

      <!-- Final Official Portal CTA -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">
          Ready to Apply on Official Government Portal
        </h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 520px; margin: 0 auto 1.25rem auto; line-height: 1.5;">
          All necessary details, eligibility criteria, and documents have been organized. Click below to open the official departmental portal and complete your application.
        </p>

        <a href="${currentScheme.portal}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.85rem 2rem; font-size: 0.95rem; font-weight: 800; border-radius: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(13, 148, 136, 0.3);">
          <span>Open ${currentScheme.code} Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>

      <div class="step-actions-footer">
        <button type="button" class="btn btn-secondary btn-step-prev">
          <i class="fa-solid fa-arrow-left"></i> Previous Step
        </button>
        <button type="button" class="btn btn-secondary" onclick="window.print()" style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-print"></i> Print Preparation Checklist
        </button>
      </div>
    `;

    container.querySelector('.btn-step-prev').addEventListener('click', () => goToStep(5));
    const recheckBtn = container.querySelector('#btn-recheck-readiness-step6');
    if (recheckBtn) {
      recheckBtn.addEventListener('click', () => {
        updateReadinessDashboard();
        renderReviewStep(container);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 11. READINESS DASHBOARD & MISSING INFORMATION CALCULATION
  // ---------------------------------------------------------------------------
  function calculateReadinessScore() {
    if (!currentScheme) {
      return {
        score: 0,
        label: 'Select Scheme',
        filledFieldsCount: 0,
        totalFieldsCount: 0,
        availableDocsCount: 0,
        totalDocsCount: 0,
        missingCount: 0,
        missingItems: []
      };
    }

    // 1. Gather all required fields across all 4 steps
    const allReqFields = [
      ...STANDARD_STEP_FIELDS.step1.filter(f => f.required),
      ...STANDARD_STEP_FIELDS.step2.filter(f => f.required),
      ...(currentScheme.specific_fields || []).filter(f => f.required),
      ...STANDARD_STEP_FIELDS.step4.filter(f => f.required)
    ];

    let filledFieldsCount = 0;
    const missingFieldsList = [];

    allReqFields.forEach(f => {
      const v = formValues[f.id];
      let valid = !!(v && String(v).trim().length > 0);
      if (valid && f.validation && typeof f.validation === 'function') {
        valid = f.validation(v);
      }
      if (valid) {
        filledFieldsCount++;
      } else {
        missingFieldsList.push({
          type: 'field',
          id: f.id,
          label: f.label,
          step: getStepNumberForField(f.id)
        });
      }
    });

    const fieldScoreRatio = allReqFields.length > 0 ? (filledFieldsCount / allReqFields.length) : 1;

    // 2. Gather required documents
    const reqDocs = currentScheme.required_documents || [];
    let availableDocsCount = 0;
    const missingDocsList = [];

    reqDocs.forEach(d => {
      const isAvailable = userWalletDocs.some(doc => 
        (doc.doc_type && doc.doc_type.toLowerCase() === d.doc_type.toLowerCase()) ||
        (doc.doc_name && doc.doc_name.toLowerCase().includes(d.name.toLowerCase()))
      );
      if (isAvailable) {
        availableDocsCount++;
      } else if (d.required) {
        missingDocsList.push({
          type: 'doc',
          doc_type: d.doc_type,
          label: `Upload ${d.name}`,
          step: 5
        });
      }
    });

    const docScoreRatio = reqDocs.length > 0 ? (availableDocsCount / reqDocs.length) : 1;

    // 3. Eligibility connection score
    let eligScore = 0;
    if (eligibilityStatus === 'eligible') eligScore = 15;
    else if (eligibilityStatus === 'potentially_relevant') eligScore = 12;

    // Composite: 50% fields + 35% documents + 15% eligibility
    const totalScore = Math.min(100, Math.round((fieldScoreRatio * 50) + (docScoreRatio * 35) + eligScore));

    let label = 'Initial Setup';
    if (totalScore >= 95) label = 'Ready to Apply';
    else if (totalScore >= 75) label = 'Action Needed';
    else if (totalScore >= 40) label = 'In Progress';

    return {
      score: totalScore,
      label,
      filledFieldsCount,
      totalFieldsCount: allReqFields.length,
      availableDocsCount,
      totalDocsCount: reqDocs.length,
      missingCount: missingFieldsList.length + missingDocsList.length,
      missingItems: [...missingFieldsList, ...missingDocsList]
    };
  }

  function getStepNumberForField(fieldId) {
    if (STANDARD_STEP_FIELDS.step1.some(f => f.id === fieldId)) return 1;
    if (STANDARD_STEP_FIELDS.step2.some(f => f.id === fieldId)) return 2;
    if ((currentScheme?.specific_fields || []).some(f => f.id === fieldId)) return 3;
    if (STANDARD_STEP_FIELDS.step4.some(f => f.id === fieldId)) return 4;
    return 1;
  }

  function updateReadinessDashboard(isEmpty = false) {
    const scoreNum = document.getElementById('readiness-score-number');
    const scoreBar = document.getElementById('readiness-score-bar');
    const badgePill = document.getElementById('readiness-badge-pill');
    const fieldsCountElem = document.getElementById('metric-fields-count');
    const docsCountElem = document.getElementById('metric-docs-count');
    const eligTextElem = document.getElementById('metric-eligibility-text');
    const missingBadge = document.getElementById('missing-count-badge');
    const missingList = document.getElementById('missing-items-list');

    if (isEmpty || !currentScheme) {
      if (scoreNum) scoreNum.textContent = '0%';
      if (scoreBar) {
        scoreBar.style.width = '0%';
        scoreBar.style.background = 'var(--primary)';
      }
      if (badgePill) {
        badgePill.textContent = 'Select Scheme';
        badgePill.style.background = 'rgba(13, 148, 136, 0.1)';
        badgePill.style.color = 'var(--primary)';
      }
      if (fieldsCountElem) fieldsCountElem.textContent = '0 / 0';
      if (docsCountElem) docsCountElem.textContent = '0 / 0';
      if (eligTextElem) eligTextElem.innerHTML = `<span style="color:var(--text-muted);">Select a scheme to check eligibility.</span>`;
      if (missingBadge) missingBadge.textContent = '0 items';
      if (missingList) {
        missingList.innerHTML = `
          <li style="font-size:0.78rem; color:var(--text-muted); padding:0.4rem 0;">
            Select a scheme to begin.
          </li>
        `;
      }
      return;
    }

    const metrics = calculateReadinessScore();

    // 1. Score display
    if (scoreNum) scoreNum.textContent = `${metrics.score}%`;
    if (scoreBar) {
      scoreBar.style.width = `${metrics.score}%`;
      if (metrics.score >= 80) scoreBar.style.background = '#10b981';
      else if (metrics.score >= 40) scoreBar.style.background = 'var(--primary)';
      else scoreBar.style.background = '#f59e0b';
    }
    if (badgePill) {
      badgePill.textContent = metrics.label;
      if (metrics.score >= 80) {
        badgePill.style.background = 'rgba(16, 185, 129, 0.15)';
        badgePill.style.color = '#10b981';
      } else {
        badgePill.style.background = 'rgba(13, 148, 136, 0.1)';
        badgePill.style.color = 'var(--primary)';
      }
    }

    // 2. Metrics counts
    if (fieldsCountElem) fieldsCountElem.textContent = `${metrics.filledFieldsCount} / ${metrics.totalFieldsCount}`;
    if (docsCountElem) {
      if (metrics.totalDocsCount === 0) {
        docsCountElem.textContent = 'Documents Not Required';
      } else {
        docsCountElem.textContent = `${metrics.availableDocsCount} / ${metrics.totalDocsCount}`;
      }
    }

    // 3. Eligibility text
    if (eligTextElem) {
      if (eligibilityStatus === 'eligible') {
        eligTextElem.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> Eligible</span>`;
      } else if (eligibilityStatus === 'potentially_relevant') {
        eligTextElem.innerHTML = `<span style="color:#0d9488;"><i class="fa-solid fa-circle-info"></i> Potentially Relevant</span>`;
      } else if (eligibilityStatus === 'not_eligible') {
        eligTextElem.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Additional Info Needed</span>`;
      } else {
        eligTextElem.innerHTML = `<span style="color:var(--text-muted);">Not Assessed</span>`;
      }
    }

    // 4. Missing items list
    if (missingBadge) missingBadge.textContent = `${metrics.missingCount} item${metrics.missingCount === 1 ? '' : 's'}`;
    if (missingList) {
      if (metrics.missingItems.length === 0) {
        missingList.innerHTML = `
          <li style="font-size:0.78rem; color:#10b981; padding:0.4rem 0;">
            <i class="fa-solid fa-circle-check"></i> All required information prepared!
          </li>
        `;
      } else {
        missingList.innerHTML = metrics.missingItems.map(item => `
          <li class="missing-item-row" data-target-step="${item.step}" data-field-id="${item.id || ''}">
            <i class="fa-solid fa-chevron-right" style="font-size:0.65rem; color:var(--text-muted);"></i>
            <span>${item.label}</span>
          </li>
        `).join('');

        // Clicking missing item jumps to step and focuses input
        missingList.querySelectorAll('.missing-item-row').forEach(row => {
          row.addEventListener('click', () => {
            const stepNum = parseInt(row.dataset.targetStep, 10);
            const targetFieldId = row.dataset.fieldId;
            goToStep(stepNum);
            setTimeout(() => {
              if (targetFieldId) {
                const targetInput = document.getElementById(`field-${targetFieldId}`);
                if (targetInput) {
                  targetInput.focus();
                  targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  targetInput.style.outline = '2px solid #6366f1';
                  setTimeout(() => { targetInput.style.outline = ''; }, 1600);
                }
              }
            }, 120);
          });
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 12. AI FIELD GUIDANCE MODAL
  // ---------------------------------------------------------------------------
  async function openAiGuidanceModal(field) {
    const modal = document.getElementById('ai-guidance-modal');
    const content = document.getElementById('ai-guidance-content');

    if (modal) modal.style.display = 'flex';
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 0.75rem;"></i>
          <p style="font-size: 0.9rem; color: var(--text-muted);">Retrieving official guidance for '${field.label}'...</p>
        </div>
      `;
    }

    let liveGuidance = null;
    try {
      const res = await fetch('/api/ai/form-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeName: currentScheme.name, fieldName: field.label })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.guidance) {
          liveGuidance = data.guidance;
        }
      }
    } catch (e) {}

    const explanation = liveGuidance?.explanation || field.what_is_it || `Official entry for ${field.label}.`;
    const whyRequired = liveGuidance?.whyRequired || field.why_required || 'Mandatory government requirement for identity verification.';
    const whereToFind = field.where_to_find || 'Refer to your official government identification card.';
    const formatGuide = field.format_guide || 'Enter digits and letters as printed on the document.';
    const commonMistakes = liveGuidance?.commonMistakes || field.common_mistakes || ['Spelling mismatch with identity card'];
    const exampleValue = liveGuidance?.exampleValue || field.example_value || 'Sample Entry';

    if (content) {
      content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1rem;">
          <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(13, 148, 136, 0.12); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.1rem;">
            <i class="fa-solid fa-brain"></i>
          </div>
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">
              ${field.label}
            </h3>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${currentScheme.name}</span>
          </div>
        </div>

        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1rem;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">What is this field?</div>
          <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0.25rem 0 0 0;">${explanation}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem;">
            <div style="font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase;">Why It's Required</div>
            <div style="font-size: 0.8rem; color: var(--text-main); margin-top: 0.2rem; line-height: 1.4;">${whyRequired}</div>
          </div>
          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem;">
            <div style="font-size: 0.7rem; font-weight: 800; color: #6366f1; text-transform: uppercase;">Where to Find It</div>
            <div style="font-size: 0.8rem; color: var(--text-main); margin-top: 0.2rem; line-height: 1.4;">${whereToFind}</div>
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.35rem;">Format Instructions</div>
          <div style="font-size: 0.82rem; color: var(--text-main);">${formatGuide}</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="font-size: 0.72rem; font-weight: 800; color: #ef4444; text-transform: uppercase; margin-bottom: 0.35rem;">Common Mistakes to Avoid</div>
          <ul style="padding-left: 1.2rem; margin: 0; font-size: 0.82rem; color: var(--text-main);">
            ${commonMistakes.map(m => `<li style="margin-bottom: 0.25rem;">${m}</li>`).join('')}
          </ul>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted);">
          <strong>Example Input:</strong> <code style="background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700; color: var(--text-main);">${exampleValue}</code>
        </div>
      `;
    }

    const closeBtn = document.getElementById('btn-close-guidance-modal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (modal) modal.style.display = 'none';
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 13. APPLICATION READINESS CHECK ASSESSMENT POPUP
  // ---------------------------------------------------------------------------
  function openReadinessAssessmentModal() {
    const modal = document.getElementById('readiness-assessment-modal');
    const content = document.getElementById('readiness-assessment-content');
    if (!modal || !content) return;

    const metrics = calculateReadinessScore();

    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: ${metrics.score >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; display: inline-flex; align-items: center; justify-content: center; font-size: 1.6rem; color: ${metrics.score >= 80 ? '#10b981' : '#f59e0b'}; margin-bottom: 0.75rem;">
          <i class="fa-solid ${metrics.score >= 80 ? 'fa-shield-check' : 'fa-list-check'}"></i>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.35rem 0;">
          Application Readiness Scan
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
          ${currentScheme.name} (${currentScheme.code})
        </p>
      </div>

      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Preparedness Score</span>
          <span style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">${metrics.score}%</span>
        </div>
        <div style="height: 6px; border-radius: 999px; background: var(--border-color); overflow: hidden;">
          <div style="height: 100%; width: ${metrics.score}%; background: ${metrics.score >= 80 ? '#10b981' : 'var(--primary)'};"></div>
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">
          Verification Audit
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84rem;">
          <div style="display: flex; justify-content: space-between;">
            <span>Required Form Fields:</span>
            <strong>${metrics.filledFieldsCount} / ${metrics.totalFieldsCount} Completed</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Required Documents:</span>
            <strong>${metrics.availableDocsCount} / ${metrics.totalDocsCount} Available in Wallet</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Eligibility Status:</span>
            <strong style="color:var(--primary);">${eligibilityStatus === 'eligible' ? 'Eligible' : (eligibilityStatus === 'potentially_relevant' ? 'Potentially Relevant' : 'Not Checked')}</strong>
          </div>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.05)); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 0.75rem 0.85rem; font-size: 0.74rem; color: var(--text-main); line-height: 1.45;">
        <i class="fa-solid fa-circle-info" style="color: #d97706; margin-right: 0.25rem;"></i>
        CrowdCity AI is an informational assistant. This readiness check validates completeness for self-application; final eligibility is verified exclusively by the concerned Government Authority.
      </div>
    `;

    modal.style.display = 'flex';

    const closeBtn = document.getElementById('btn-close-readiness-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    const proceedBtn = document.getElementById('btn-readiness-proceed-action');
    if (proceedBtn) {
      proceedBtn.onclick = () => {
        modal.style.display = 'none';
        goToStep(6);
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 14. SECONDARY ASYNC DATA (NON-BLOCKING)
  // ---------------------------------------------------------------------------
  async function loadSecondaryAsyncData() {
    // 1. Sync wallet docs from localStorage first
    try {
      const local = localStorage.getItem('cc_user_uploaded_docs');
      if (local) {
        const arr = JSON.parse(local);
        if (Array.isArray(arr)) userWalletDocs = arr;
      }
    } catch (e) {}

    // 2. Sync eligibility check from session storage
    checkConnectedEligibility();

    // 3. Immediate readiness update if scheme is selected
    if (currentScheme) {
      updateReadinessDashboard();
    }

    // 4. Background query to Supabase user_document_wallet with timeout race
    if (currentUserId && typeof window.getOrInitSupabaseClient === 'function') {
      try {
        const clientPromise = window.getOrInitSupabaseClient();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
        const client = await Promise.race([clientPromise, timeoutPromise]).catch(() => null);

        if (client) {
          const { data, error } = await client
            .from('user_document_wallet')
            .select('id, user_id, doc_type, doc_name, file_size, file_format, created_at')
            .eq('user_id', currentUserId);

          if (!error && Array.isArray(data) && data.length > 0) {
            userWalletDocs = data;
            try {
              localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(data));
            } catch (e) {}
            if (currentScheme) {
              updateReadinessDashboard();
            }
          }
        }
      } catch (err) {
        console.warn('[FormAssistant] Background wallet sync notice:', err.message || err);
      }
    }

    // 5. Query authoritative government schemes via unified API and Supabase
    await fetchAuthoritativeSchemes();
  }

  // ---------------------------------------------------------------------------
  // 14B. AUTHORITATIVE SCHEMES SYNC & RETRY
  // ---------------------------------------------------------------------------
  async function fetchAuthoritativeSchemes() {
    let fetched = null;
    let fetchError = null;

    // 1. Try unified window.API.getSchemes()
    try {
      if (window.API && typeof window.API.getSchemes === 'function') {
        const res = await window.API.getSchemes();
        if (res) {
          if (Array.isArray(res.schemes) && res.schemes.length > 0) fetched = res.schemes;
          else if (Array.isArray(res.data) && res.data.length > 0) fetched = res.data;
          else if (Array.isArray(res) && res.length > 0) fetched = res;
          else if (res.error) fetchError = res.error;
        }
      }
    } catch (e) {
      fetchError = e.message || String(e);
      console.warn('[FormAssistant] API getSchemes notice:', e.message || e);
    }

    // 2. Try Supabase direct client if not yet fetched
    if (!fetched && typeof window.getOrInitSupabaseClient === 'function') {
      try {
        const clientPromise = window.getOrInitSupabaseClient();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
        const client = await Promise.race([clientPromise, timeoutPromise]).catch(() => null);

        if (client) {
          const { data, error } = await client
            .from('government_schemes')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            fetched = data;
          } else if (error) {
            fetchError = error.message || String(error);
          }
        }
      } catch (e) {
        fetchError = e.message || String(e);
        console.warn('[FormAssistant] Supabase schemes fetch notice:', e.message || e);
      }
    }

    // 3. Sync fetched records into SCHEMES_REGISTRY
    if (Array.isArray(fetched) && fetched.length > 0) {
      fetched.forEach(dbSch => {
        const code = dbSch.scheme_code || dbSch.id;
        if (code) {
          const existing = resolveSchemeMeta(code);
          if (existing) {
            if (dbSch.id) existing.uuid = dbSch.id;
            if (dbSch.official_portal_url) existing.portal = dbSch.official_portal_url;
            if (dbSch.scheme_name) existing.name = dbSch.scheme_name;
            if (dbSch.department_name) existing.dept = dbSch.department_name;
          }
        }
      });

      // Hide error banner on success
      const errBanner = document.getElementById('scheme-load-error-banner');
      if (errBanner) errBanner.style.display = 'none';

      // Re-populate switcher with any synced updates without losing active selection
      populateSchemeSwitcher(currentScheme?.code || currentScheme?.id);
    } else if (fetchError && Object.keys(SCHEMES_REGISTRY).length === 0) {
      // If no schemes exist at all and fetch failed, show visible error banner with retry
      const errBanner = document.getElementById('scheme-load-error-banner');
      const errMsg = document.getElementById('scheme-load-error-message');
      if (errBanner) {
        if (errMsg) errMsg.textContent = 'Unable to load government schemes. Please check your connection and retry.';
        errBanner.style.display = 'flex';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 15. ATTACH GLOBAL LISTENERS
  // ---------------------------------------------------------------------------
  function attachGlobalListeners() {
    const prefillBtn = document.getElementById('btn-auto-prefill');
    if (prefillBtn) prefillBtn.onclick = prefillFromUserProfile;

    const saveDraftBtn = document.getElementById('btn-save-draft');
    if (saveDraftBtn) saveDraftBtn.onclick = () => saveDraft(true);

    const retrySchemesBtn = document.getElementById('btn-retry-schemes');
    if (retrySchemesBtn) retrySchemesBtn.onclick = () => fetchAuthoritativeSchemes();

    const checkReadinessBtn = document.getElementById('btn-check-readiness');
    if (checkReadinessBtn) checkReadinessBtn.onclick = openReadinessAssessmentModal;

    // Resume banner actions
    const resumeBtn = document.getElementById('btn-resume-draft-action');
    if (resumeBtn) {
      resumeBtn.onclick = () => {
        if (!currentScheme) return;
        loadDraft(currentScheme.id);
        const resumeAlert = document.getElementById('resume-draft-alert');
        if (resumeAlert) resumeAlert.style.display = 'none';
        renderActiveStep();
        updateReadinessDashboard();
        if (window.showToast) window.showToast("Application draft resumed!", "success");
      };
    }

    const discardBtn = document.getElementById('btn-discard-draft-action');
    if (discardBtn) {
      discardBtn.onclick = () => {
        if (!currentScheme) return;
        discardDraft(currentScheme.id);
        const resumeAlert = document.getElementById('resume-draft-alert');
        if (resumeAlert) resumeAlert.style.display = 'none';
        renderActiveStep();
        updateReadinessDashboard();
        if (window.showToast) window.showToast("Draft cleared. Starting fresh application.", "info");
      };
    }

    // Modal background click closing
    window.onclick = (e) => {
      const guidanceModal = document.getElementById('ai-guidance-modal');
      if (e.target === guidanceModal) guidanceModal.style.display = 'none';

      const previewModal = document.getElementById('doc-preview-modal');
      if (e.target === previewModal) previewModal.style.display = 'none';

      const readinessModal = document.getElementById('readiness-assessment-modal');
      if (e.target === readinessModal) readinessModal.style.display = 'none';
    };

    // Language change listener
    window.addEventListener('language-change', () => {
      updateHeaderUI();
      renderStepper(!currentScheme);
      renderActiveStep();
      updateReadinessDashboard();
    });

    // Browser back/forward navigation support
    window.addEventListener('popstate', () => {
      const schemeId = getSchemeIdFromUrl();
      if (schemeId) {
        const meta = resolveSchemeMeta(schemeId);
        if (meta && (!currentScheme || currentScheme.id !== meta.id)) {
          selectScheme(meta.id, false);
        }
      } else {
        if (currentScheme) {
          renderSchemeSelectionState();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 16. SYNCHRONOUS 0MS INITIALIZATION
  // ---------------------------------------------------------------------------
  function initFormAssistant() {
    try {
      currentUserId = getActiveUserId();
      const initialSchemeId = getSchemeIdFromUrl();

      // 1. Populate switcher dropdown synchronously (0ms)
      populateSchemeSwitcher(initialSchemeId);

      // 2. Select initial scheme or show selection state synchronously (0ms)
      if (initialSchemeId) {
        const meta = resolveSchemeMeta(initialSchemeId);
        if (meta) {
          selectScheme(meta.id, false);
        } else {
          renderSchemeLoadError(initialSchemeId);
        }
      } else {
        renderSchemeSelectionState();
      }

      // 3. Attach all global button handlers
      attachGlobalListeners();

      // 4. Secondary async operations in background (non-blocking!)
      loadSecondaryAsyncData();
    } catch (err) {
      console.error('[FormAssistant] Initialization error:', err);
      renderSchemeLoadError('init-error');
    }
  }

  // Safe DOM ready execution (supports already-loaded DOM and DOMContentLoaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormAssistant);
  } else {
    initFormAssistant();
  }

  // Export module globally for testing and integrations
  window.CrowdCityFormAssistant = {
    getSchemes: () => SCHEMES_REGISTRY,
    getSchemeMeta: resolveSchemeMeta,
    getCurrentScheme: () => currentScheme,
    getCurrentStep: () => currentStep,
    getFormValues: () => ({ ...formValues }),
    setFormValue: (k, v) => { formValues[k] = v; },
    calculateReadinessScore,
    saveDraft,
    loadDraft,
    hasSavedDraft,
    discardDraft,
    goToStep,
    selectScheme,
    resetToSchemeSelector: renderSchemeSelectionState,
    init: initFormAssistant
  };

})();
