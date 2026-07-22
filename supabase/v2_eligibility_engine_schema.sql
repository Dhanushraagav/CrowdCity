-- CrowdCity AI v2.2 - Fix Government Scheme Eligibility Engine Migration
-- Updates the default government schemes with highly structured, detailed eligibility criteria.

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 21,
  "max_age": 60,
  "gender": "female",
  "max_annual_income": 250000,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "native_state": "Tamil Nadu",
  "required_certificates": ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"]
}'::jsonb
WHERE scheme_code = 'TN-KMUT-001';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 17,
  "max_age": 25,
  "gender": "female",
  "student_required": true,
  "gov_school_required": true,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "native_state": "Tamil Nadu",
  "required_certificates": ["Govt School Transfer Certificate / Study Proof (6th-12th)", "Aadhaar Card", "College Admission ID / Receipt", "Bank Passbook"]
}'::jsonb
WHERE scheme_code = 'TN-PUDHUMAI-002';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 18,
  "max_age": 35,
  "gender": "all",
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "native_state": "Tamil Nadu",
  "required_certificates": ["College ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate"]
}'::jsonb
WHERE scheme_code = 'TN-NM-003';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": null,
  "max_age": null,
  "gender": "all",
  "max_annual_income": 120000,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "native_state": "Tamil Nadu",
  "required_certificates": ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card"]
}'::jsonb
WHERE scheme_code = 'TN-CMCHIS-004';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": null,
  "max_age": null,
  "gender": "all",
  "max_annual_income": 150000,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "native_state": "Tamil Nadu",
  "required_certificates": ["Land Patta / Chitta Ownership Document", "Aadhaar Card", "Ration Card", "Bank Account Details"]
}'::jsonb
WHERE scheme_code = 'TN-KKI-005';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 18,
  "max_age": null,
  "gender": "all",
  "max_annual_income": null,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": true,
  "native_state": "Tamil Nadu",
  "required_certificates": ["Uzhavar Card / Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"]
}'::jsonb
WHERE scheme_code = 'TN-UZHAVAR-006';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 18,
  "max_age": null,
  "gender": "all",
  "max_annual_income": null,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": true,
  "required_certificates": ["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-PMKISAN-007';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": null,
  "max_age": null,
  "gender": "all",
  "max_annual_income": 200000,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "required_certificates": ["Aadhaar Card", "Ration Card", "Ayushman Golden Card"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-PMJAY-008';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 18,
  "max_age": 65,
  "gender": "all",
  "max_annual_income": null,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "required_certificates": ["Aadhaar Card", "PAN Card", "Business Proof / Udyam MSME Registration", "6-Month Bank Statement"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-PMMY-009';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 0,
  "max_age": 10,
  "gender": "female",
  "max_annual_income": null,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "required_certificates": ["Girl Child Birth Certificate", "Parent / Guardian Aadhaar & PAN Card", "Passport Size Photos"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-SSY-010';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 18,
  "max_age": null,
  "gender": "all",
  "max_annual_income": 600000,
  "student_required": false,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "required_certificates": ["Aadhaar Card", "Income Certificate / Salary Slip", "Affidavit for not owning a pucca house", "Bank Passbook"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-PMAY-011';

UPDATE public.government_schemes
SET eligibility_criteria = '{
  "min_age": 16,
  "max_age": null,
  "gender": "all",
  "max_annual_income": null,
  "student_required": true,
  "gov_school_required": false,
  "gov_college_required": false,
  "disability_required": false,
  "widow_required": false,
  "single_parent_required": false,
  "farmer_required": false,
  "required_certificates": ["10th & 12th Marksheet", "College Admission Offer Letter & Fee Structure", "Parent Income Certificate", "Aadhaar Card"]
}'::jsonb
WHERE scheme_code = 'CENTRAL-VIDYALAKSHMI-012';
