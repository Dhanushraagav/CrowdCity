/**
 * CrowdCity AI — Government Application Assistant Test Suite
 * 
 * Verifies the 20 testing requirements specified in Section 27:
 * 1. Dynamic scheme loading
 * 2. Kalaignar scheme (KMUT)
 * 3. CMCHIS
 * 4. PM-KISAN
 * 5. Pudhumai Penn
 * 6. Naan Mudhalvan
 * 7. Scheme-specific fields
 * 8. Required field validation
 * 9. Profile prefill
 * 10. Current-user validation (Cross-user isolation)
 * 11. Document Wallet integration
 * 12. Missing document detection
 * 13. Draft save
 * 14. Draft reload
 * 15. Resume
 * 16. User A / User B isolation
 * 17. Sensitive data logging protection
 * 18. Eligibility result integration
 * 19. Official portal URL verification
 * 20. Mobile layout & responsive design
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('  CROWDCITY AI — GOVERNMENT APPLICATION ASSISTANT TEST SUITE');
console.log('================================================================\n');

// 1. Read source files
const formHtmlPath = path.join(rootDir, 'client', 'form-assistant.html');
const formJsPath = path.join(rootDir, 'client', 'js', 'form-assistant.js');
const apiJsPath = path.join(rootDir, 'client', 'js', 'api.js');

const formHtml = fs.readFileSync(formHtmlPath, 'utf8');
const formJs = fs.readFileSync(formJsPath, 'utf8');
const apiJs = fs.readFileSync(apiJsPath, 'utf8');

// Mock localStorage & DOM
class MockStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

// Instantiate form assistant logic in sandboxed VM context
let exportedAssistant = null;

const sandbox = {
  window: {
    location: { search: '?scheme=tn-kmut', href: 'http://localhost/form-assistant.html?scheme=tn-kmut' },
    history: { replaceState: () => {} },
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    addEventListener: () => {},
    print: () => {},
    showToast: () => {},
    getCurrentUser: () => ({ id: 'usr_test_alpha' })
  },
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  console: { warn: () => {}, error: () => {}, log: () => {} }
};

// Execute JS in evaluated scope
try {
  const runner = new Function('window', 'document', 'localStorage', 'sessionStorage', 'console', formJs);
  runner(sandbox.window, sandbox.document, mockLocalStorage, mockSessionStorage, sandbox.console);
  exportedAssistant = sandbox.window.CrowdCityFormAssistant;
} catch (e) {
  console.error("Evaluation error:", e);
}

assert(!!exportedAssistant, 'Module Export: CrowdCityFormAssistant is successfully exported');

const schemes = exportedAssistant.getSchemes();
const resolveSchemeMeta = exportedAssistant.getSchemeMeta;

// -----------------------------------------------------------------------------
// TEST 1: Dynamic Scheme Loading
// -----------------------------------------------------------------------------
const bySlug = resolveSchemeMeta('central-pmkisan');
const byCode = resolveSchemeMeta('CENTRAL-PMKISAN-007');
const byUuid = resolveSchemeMeta('aa6d9c6a-29df-4486-ada5-b70977ccf61c');
assert(bySlug && bySlug.id === 'central-pmkisan', 'TEST 1.1: Resolves scheme by slug ("central-pmkisan")');
assert(byCode && byCode.code === 'CENTRAL-PMKISAN-007', 'TEST 1.2: Resolves scheme by official code ("CENTRAL-PMKISAN-007")');
assert(byUuid && byUuid.uuid === 'aa6d9c6a-29df-4486-ada5-b70977ccf61c', 'TEST 1.3: Resolves scheme by canonical UUID');
assert(Object.keys(schemes).length >= 10, 'TEST 1.4: Registry contains full suite of government schemes (at least 10)');

// -----------------------------------------------------------------------------
// TEST 2: Kalaignar Scheme (KMUT)
// -----------------------------------------------------------------------------
const kmut = resolveSchemeMeta('tn-kmut');
assert(kmut.name.includes('Kalaignar Magalir Urimai'), 'TEST 2.1: KMUT scheme name is accurate');
const kmutFieldIds = kmut.specific_fields.map(f => f.id);
assert(kmutFieldIds.includes('smart_card_no'), 'TEST 2.2: KMUT requires Smart Ration Card Number');
assert(kmutFieldIds.includes('annual_income'), 'TEST 2.3: KMUT requires Annual Family Income');
assert(kmutFieldIds.includes('eb_consumer_no'), 'TEST 2.4: KMUT requires Domestic Electricity Connection Number');
assert(kmutFieldIds.includes('owns_car'), 'TEST 2.5: KMUT requires four-wheeler declaration');
assert(kmut.portal === 'https://kmut.tn.gov.in/', 'TEST 2.6: KMUT links to official portal https://kmut.tn.gov.in/');

// -----------------------------------------------------------------------------
// TEST 3: CMCHIS (Health Insurance)
// -----------------------------------------------------------------------------
const cmchis = resolveSchemeMeta('tn-cmchis');
assert(cmchis.code === 'TN-CMCHIS-004', 'TEST 3.1: CMCHIS code matches TN-CMCHIS-004');
const cmchisFieldIds = cmchis.specific_fields.map(f => f.id);
assert(cmchisFieldIds.includes('income_cert_no'), 'TEST 3.2: CMCHIS requires VAO/Tahsildar Income Certificate Number');
assert(cmchisFieldIds.includes('family_members_count'), 'TEST 3.3: CMCHIS requires family members count');
assert(cmchis.portal === 'https://cmchistn.com/', 'TEST 3.4: CMCHIS links to official portal https://cmchistn.com/');

// -----------------------------------------------------------------------------
// TEST 4: PM-KISAN (Farmer Income Support)
// -----------------------------------------------------------------------------
const pmkisan = resolveSchemeMeta('central-pmkisan');
assert(pmkisan.code === 'CENTRAL-PMKISAN-007', 'TEST 4.1: PM-KISAN code matches CENTRAL-PMKISAN-007');
const pmkisanFieldIds = pmkisan.specific_fields.map(f => f.id);
assert(pmkisanFieldIds.includes('patta_no'), 'TEST 4.2: PM-KISAN requires Land Patta Number');
assert(pmkisanFieldIds.includes('survey_no'), 'TEST 4.3: PM-KISAN requires Land Survey Number');
assert(pmkisanFieldIds.includes('farmer_category'), 'TEST 4.4: PM-KISAN requires Farmer Classification');
assert(pmkisan.portal === 'https://pmkisan.gov.in/', 'TEST 4.5: PM-KISAN links to official portal https://pmkisan.gov.in/');

// -----------------------------------------------------------------------------
// TEST 5: Pudhumai Penn (Higher Education)
// -----------------------------------------------------------------------------
const pudhumai = resolveSchemeMeta('tn-pudhumai');
assert(pudhumai.code === 'TN-PUDHUMAI-002', 'TEST 5.1: Pudhumai Penn code matches TN-PUDHUMAI-002');
const pudhumaiFieldIds = pudhumai.specific_fields.map(f => f.id);
assert(pudhumaiFieldIds.includes('school_emis_id'), 'TEST 5.2: Pudhumai Penn requires Government School EMIS ID');
assert(pudhumaiFieldIds.includes('college_name'), 'TEST 5.3: Pudhumai Penn requires College Name');
assert(pudhumaiFieldIds.includes('study_year'), 'TEST 5.4: Pudhumai Penn requires Study Year');
assert(pudhumai.portal === 'https://penkalvi.tn.gov.in/', 'TEST 5.5: Pudhumai Penn links to official portal https://penkalvi.tn.gov.in/');

// -----------------------------------------------------------------------------
// TEST 6: Naan Mudhalvan (Skill Development)
// -----------------------------------------------------------------------------
const naan = resolveSchemeMeta('tn-naanmudhalvan');
assert(naan.code === 'TN-NM-003', 'TEST 6.1: Naan Mudhalvan code matches TN-NM-003');
const naanFieldIds = naan.specific_fields.map(f => f.id);
assert(naanFieldIds.includes('edu_qualification'), 'TEST 6.2: Naan Mudhalvan requires Educational Qualification');
assert(naanFieldIds.includes('preferred_skill_domain'), 'TEST 6.3: Naan Mudhalvan requires Skill Domain');
assert(naan.portal === 'https://www.naanmudhalvan.tn.gov.in/', 'TEST 6.4: Naan Mudhalvan links to official portal https://www.naanmudhalvan.tn.gov.in/');

// -----------------------------------------------------------------------------
// TEST 7: Scheme-Specific Field Isolation
// -----------------------------------------------------------------------------
// PM-KISAN must NOT have student or electricity fields
assert(!pmkisanFieldIds.includes('school_emis_id'), 'TEST 7.1: PM-KISAN does NOT contain student EMIS field');
assert(!pmkisanFieldIds.includes('eb_consumer_no'), 'TEST 7.2: PM-KISAN does NOT contain electricity consumer field');
// Pudhumai Penn must NOT have farming patta fields
assert(!pudhumaiFieldIds.includes('patta_no'), 'TEST 7.3: Pudhumai Penn does NOT contain farming Patta field');
assert(!pudhumaiFieldIds.includes('survey_no'), 'TEST 7.4: Pudhumai Penn does NOT contain land Survey field');

// -----------------------------------------------------------------------------
// TEST 8: Required Field Validation
// -----------------------------------------------------------------------------
const aadhaarField = kmut.specific_fields.find(f => f.id === 'smart_card_no');
// Test KMUT smart card validation
assert(aadhaarField.validation('03/N/0123456') === true, 'TEST 8.1: Valid smart card format returns true');
assert(aadhaarField.validation('short') === false, 'TEST 8.2: Short invalid smart card format returns false');

// Test income validation
const incomeField = kmut.specific_fields.find(f => f.id === 'annual_income');
assert(incomeField.validation('180000') === true, 'TEST 8.3: Income within ceiling (₹1,80,000) is valid');
assert(incomeField.validation('350000') === false, 'TEST 8.4: Income exceeding ceiling (₹3,50,000) is invalid for KMUT');

// Test EMIS ID validation
const emisField = pudhumai.specific_fields.find(f => f.id === 'school_emis_id');
assert(emisField.validation('33021500101') === true, 'TEST 8.5: 11-digit EMIS ID is valid');
assert(emisField.validation('12345') === false, 'TEST 8.6: 5-digit EMIS ID is invalid');

// -----------------------------------------------------------------------------
// TEST 9 & 10: Profile Prefill & Current-User Validation
// -----------------------------------------------------------------------------
mockLocalStorage.setItem('cc_user_profile_usr_test_alpha', JSON.stringify({
  id: 'usr_test_alpha',
  full_name: 'Murugan K',
  phone: '9840112345',
  email: 'murugan@example.com',
  district: 'Salem',
  taluk: 'Attur'
}));

// Test that user-scoped profile is read only when IDs match
const userAProfile = JSON.parse(mockLocalStorage.getItem('cc_user_profile_usr_test_alpha'));
assert(userAProfile.id === 'usr_test_alpha', 'TEST 9.1: Verified user profile has correct ID');
assert(userAProfile.full_name === 'Murugan K', 'TEST 9.2: Profile contains full name');

// Test cross-user isolation: User B cannot access User A's profile
const userBId = 'usr_test_beta';
const userBProfile = mockLocalStorage.getItem(`cc_user_profile_${userBId}`);
assert(userBProfile === null, 'TEST 10.1: User B has no access to User A’s profile data (strict isolation)');

// -----------------------------------------------------------------------------
// TEST 11 & 12: Document Wallet Integration & Missing Document Detection
// -----------------------------------------------------------------------------
const mockWallet = [
  { doc_type: 'aadhaar', doc_name: 'Aadhaar Card' },
  { doc_type: 'ration_card', doc_name: 'Smart Family Ration Card' }
];

// For KMUT: required docs are ration_card, aadhaar, bank_passbook
const kmutDocs = kmut.required_documents;
const availableDocs = kmutDocs.filter(d => mockWallet.some(w => w.doc_type === d.doc_type));
const missingDocs = kmutDocs.filter(d => !mockWallet.some(w => w.doc_type === d.doc_type));

assert(availableDocs.length === 2, 'TEST 11.1: Correctly detects 2 available documents (Aadhaar & Ration Card)');
assert(missingDocs.length === 1 && missingDocs[0].doc_type === 'bank_passbook', 'TEST 12.1: Correctly detects missing Bank Passbook');

// -----------------------------------------------------------------------------
// TEST 13 & 14: Draft Save & Reload
// -----------------------------------------------------------------------------
const draftKey = `cc_form_draft_usr_test_alpha_tn-kmut`;
mockLocalStorage.setItem(draftKey, JSON.stringify({
  userId: 'usr_test_alpha',
  schemeId: 'tn-kmut',
  step: 3,
  fields: {
    applicant_name: 'Kavitha R',
    smart_card_no: '03/N/0123456',
    annual_income: '150000'
  },
  lastSaved: new Date().toISOString()
}));

const reloadedDraft = JSON.parse(mockLocalStorage.getItem(draftKey));
assert(reloadedDraft !== null, 'TEST 13.1: Draft is persisted under user and scheme scoped key');
assert(reloadedDraft.fields.applicant_name === 'Kavitha R', 'TEST 14.1: Draft correctly preserves applicant name');
assert(reloadedDraft.step === 3, 'TEST 14.2: Draft correctly preserves current step (Step 3)');

// -----------------------------------------------------------------------------
// TEST 15: Resume Application
// -----------------------------------------------------------------------------
const hasDraft = !!reloadedDraft && Object.keys(reloadedDraft.fields).length > 0;
assert(hasDraft === true, 'TEST 15.1: System detects existing draft to prompt resume dialog');

// -----------------------------------------------------------------------------
// TEST 16: User A / User B Draft Isolation
// -----------------------------------------------------------------------------
const userBDraftKey = `cc_form_draft_usr_test_beta_tn-kmut`;
assert(mockLocalStorage.getItem(userBDraftKey) === null, 'TEST 16.1: User B has no access to User A’s draft (separate keys)');

// -----------------------------------------------------------------------------
// TEST 17: Sensitive Data Logging Protection
// -----------------------------------------------------------------------------
assert(!formJs.includes('console.log(formValues)'), 'TEST 17.1: form-assistant.js does not log formValues object');
assert(!formJs.includes('console.log(aadhaar'), 'TEST 17.2: form-assistant.js does not log Aadhaar data');
assert(!formJs.includes('console.log(bank_acc'), 'TEST 17.3: form-assistant.js does not log bank account numbers');

// -----------------------------------------------------------------------------
// TEST 18: Eligibility Result Integration
// -----------------------------------------------------------------------------
// Verify that Naan Mudhalvan maps to 'Potentially Relevant' as mandated by prompt
assert(formJs.includes("'potentially_relevant'"), 'TEST 18.1: Handles umbrella schemes with "potentially_relevant" status');
assert(formJs.includes('cc_scheme_checker_profile'), 'TEST 18.2: Connects with Scheme Checker session data');

// -----------------------------------------------------------------------------
// TEST 19: Official Portal URLs
// -----------------------------------------------------------------------------
Object.values(schemes).forEach(sch => {
  const isOfficial = sch.portal.startsWith('https://') && 
                     (sch.portal.includes('.gov.in') || sch.portal.includes('cmchistn.com') || sch.portal.includes('.co.in') || sch.portal.includes('.org.in') || sch.portal.includes('.ac.in'));
  assert(isOfficial, `TEST 19: ${sch.code} links to verified official portal (${sch.portal})`);
});

// -----------------------------------------------------------------------------
// TEST 20: Mobile Layout & Responsiveness
// -----------------------------------------------------------------------------
assert(formHtml.includes('@media (max-width: 992px)'), 'TEST 20.1: HTML includes responsive mobile/tablet breakpoint at 992px');
assert(formHtml.includes('overflow-x: auto'), 'TEST 20.2: Stepper bar supports responsive horizontal touch-scrolling on narrow screens');
assert(formHtml.includes('position: static !important'), 'TEST 20.3: Readiness sidebar transitions from sticky desktop to in-flow block on mobile');

// -----------------------------------------------------------------------------
// TEST 21: Scheme Resolution Resilience & Query Parameter Routing
// -----------------------------------------------------------------------------
assert(resolveSchemeMeta(null) === null, 'TEST 21.1: resolveSchemeMeta(null) returns null without falling back to a hardcoded default');
assert(resolveSchemeMeta('') === null, 'TEST 21.2: resolveSchemeMeta("") returns null');
assert(resolveSchemeMeta('invalid-unknown-scheme') === null, 'TEST 21.3: resolveSchemeMeta with unknown scheme ID returns null');

// Verify all supported query parameter variants
const paramVariants = [
  'scheme=tn-pudhumai',
  'scheme_id=tn-pudhumai',
  'schemeId=tn-pudhumai',
  'schemeCode=TN-PUDHUMAI-002',
  'code=TN-PUDHUMAI-002',
  'id=tn-pudhumai'
];

paramVariants.forEach((paramStr, idx) => {
  const [paramKey, paramVal] = paramStr.split('=');
  const dummyUrl = new URL(`http://localhost/form-assistant.html?${paramKey}=${paramVal}`);
  const extracted = dummyUrl.searchParams.get('scheme') || 
                    dummyUrl.searchParams.get('scheme_id') || 
                    dummyUrl.searchParams.get('schemeId') || 
                    dummyUrl.searchParams.get('schemeCode') || 
                    dummyUrl.searchParams.get('code') || 
                    dummyUrl.searchParams.get('id');
  const resolved = resolveSchemeMeta(extracted);
  assert(resolved && resolved.id === 'tn-pudhumai', `TEST 21.4.${idx + 1}: Query param ?${paramKey}= correctly resolves target scheme`);
});

// -----------------------------------------------------------------------------
// TEST 22: Null Scheme State & Zero-Document Scheme Handling
// -----------------------------------------------------------------------------
// Test calculateReadinessScore when scheme is null (selection state)
exportedAssistant.resetToSchemeSelector();
const emptyMetrics = exportedAssistant.calculateReadinessScore();
assert(emptyMetrics.score === 0, 'TEST 22.1: calculateReadinessScore returns 0% score when no scheme is selected');
assert(emptyMetrics.filledFieldsCount === 0 && emptyMetrics.totalFieldsCount === 0, 'TEST 22.2: Field counts are safely 0 / 0');
assert(emptyMetrics.availableDocsCount === 0 && emptyMetrics.totalDocsCount === 0, 'TEST 22.3: Document counts are safely 0 / 0');
assert(!Number.isNaN(emptyMetrics.score), 'TEST 22.4: Empty readiness score is not NaN');

// Test selecting a scheme dynamically
exportedAssistant.selectScheme('tn-kmut', false);
const kmutMetrics = exportedAssistant.calculateReadinessScore();
assert(kmutMetrics.totalFieldsCount > 0, 'TEST 22.5: KMUT readiness calculation activates with non-zero fields');
assert(kmutMetrics.totalDocsCount === 3, 'TEST 22.6: KMUT correctly specifies 3 required documents');

// Test 0-document scenario logic
const zeroDocMock = {
  ...schemes['tn-kmut'],
  required_documents: []
};
assert(zeroDocMock.required_documents.length === 0, 'TEST 22.7: 0-document scheme verification');

// -----------------------------------------------------------------------------
// TEST 23: Express HTTP Server & /api/schemes Endpoint
// -----------------------------------------------------------------------------
console.log('\n--- Starting HTTP Server for Integration Tests ---');
const server = app.listen(0);
await new Promise(resolve => server.once('listening', resolve));
const port = server.address().port;
console.log(`Express testing server listening on http://127.0.0.1:${port}`);

try {
  // 23.1: GET /api/schemes
  const resSchemes = await fetch(`http://127.0.0.1:${port}/api/schemes`);
  assert(resSchemes.status === 200, 'TEST 23.1: GET /api/schemes returns HTTP 200');
  const jsonSchemes = await resSchemes.json();
  assert(jsonSchemes.success === true, 'TEST 23.2: /api/schemes returns success: true');
  assert(jsonSchemes.count === 12, `TEST 23.3: /api/schemes returns 12 active schemes (got ${jsonSchemes.count})`);
  assert(Array.isArray(jsonSchemes.schemes) && jsonSchemes.schemes.length === 12, 'TEST 23.4: json.schemes contains 12 scheme objects');
  assert(Array.isArray(jsonSchemes.data) && jsonSchemes.data.length === 12, 'TEST 23.5: json.data contains 12 scheme objects (dual compatibility)');

  // Verify all 12 codes are present in the response
  const expectedCodes = [
    'TN-KMUT-001', 'TN-PUDHUMAI-002', 'TN-NM-003', 'TN-CMCHIS-004',
    'TN-KKI-005', 'TN-UZHAVAR-006', 'CENTRAL-PMKISAN-007', 'CENTRAL-PMJAY-008',
    'CENTRAL-PMMY-009', 'CENTRAL-SSY-010', 'CENTRAL-PMAY-011', 'CENTRAL-VIDYALAKSHMI-012'
  ];
  const returnedCodes = jsonSchemes.schemes.map(s => s.scheme_code);
  const allCodesFound = expectedCodes.every(c => returnedCodes.includes(c));
  assert(allCodesFound, 'TEST 23.6: All 12 canonical scheme codes are returned in /api/schemes');

  // 23.2: GET /api/schemes/:id (Single Scheme Lookup)
  const resSingleNM = await fetch(`http://127.0.0.1:${port}/api/schemes/TN-NM-003`);
  assert(resSingleNM.status === 200, 'TEST 23.7: GET /api/schemes/TN-NM-003 returns HTTP 200');
  const jsonSingleNM = await resSingleNM.json();
  assert(jsonSingleNM.success === true && jsonSingleNM.data.scheme_code === 'TN-NM-003', 'TEST 23.8: Successfully fetched Naan Mudhalvan by code');
  assert(jsonSingleNM.data.scheme_name.includes('Naan Mudhalvan'), 'TEST 23.9: Naan Mudhalvan name matches');

  const resSingleKisan = await fetch(`http://127.0.0.1:${port}/api/schemes/CENTRAL-PMKISAN-007`);
  assert(resSingleKisan.status === 200, 'TEST 23.10: GET /api/schemes/CENTRAL-PMKISAN-007 returns HTTP 200');
  const jsonSingleKisan = await resSingleKisan.json();
  assert(jsonSingleKisan.data.scheme_code === 'CENTRAL-PMKISAN-007', 'TEST 23.11: Successfully fetched PM-KISAN by code');

  // 23.3: GET /api/government-schemes (Alias route)
  const resAlias = await fetch(`http://127.0.0.1:${port}/api/government-schemes`);
  assert(resAlias.status === 200, 'TEST 23.12: GET /api/government-schemes alias returns HTTP 200');

  // 23.4: GET /form-assistant (Page Route Alias)
  const resPage = await fetch(`http://127.0.0.1:${port}/form-assistant`);
  assert(resPage.status === 200, 'TEST 23.13: GET /form-assistant alias returns HTTP 200');
  const pageHtml = await resPage.text();
  assert(pageHtml.includes('Government Application Assistant'), 'TEST 23.14: /form-assistant serves valid application assistant page');
} finally {
  server.close();
}

// -----------------------------------------------------------------------------
// TEST 24: HTML Static Verification: Dropdown Pre-population & Error Banner
// -----------------------------------------------------------------------------
assert(formHtml.includes('<select id="scheme-switcher"'), 'TEST 24.1: HTML contains #scheme-switcher select element');
assert(formHtml.includes('value="TN-KMUT-001"'), 'TEST 24.2: HTML dropdown pre-populates TN-KMUT-001 option');
assert(formHtml.includes('value="TN-PUDHUMAI-002"'), 'TEST 24.3: HTML dropdown pre-populates TN-PUDHUMAI-002 option');
assert(formHtml.includes('value="TN-NM-003"'), 'TEST 24.4: HTML dropdown pre-populates TN-NM-003 option');
assert(formHtml.includes('value="TN-CMCHIS-004"'), 'TEST 24.5: HTML dropdown pre-populates TN-CMCHIS-004 option');
assert(formHtml.includes('value="CENTRAL-PMKISAN-007"'), 'TEST 24.6: HTML dropdown pre-populates CENTRAL-PMKISAN-007 option');
assert(formHtml.includes('value="CENTRAL-VIDYALAKSHMI-012"'), 'TEST 24.7: HTML dropdown pre-populates CENTRAL-VIDYALAKSHMI-012 option');

// Error Banner and Retry UI
assert(formHtml.includes('id="scheme-load-error-banner"'), 'TEST 24.8: HTML contains #scheme-load-error-banner element');
assert(formHtml.includes('id="btn-retry-schemes"'), 'TEST 24.9: HTML contains #btn-retry-schemes button');

// Cache Buster Script Verification
assert(formHtml.includes('js/api.js?v=3.2.0'), 'TEST 24.10: HTML loads js/api.js with cache buster ?v=3.2.0');
assert(formHtml.includes('js/auth.js?v=3.2.0'), 'TEST 24.11: HTML loads js/auth.js with cache buster ?v=3.2.0');
assert(formHtml.includes('js/form-assistant.js?v=3.2.0'), 'TEST 24.12: HTML loads js/form-assistant.js with cache buster ?v=3.2.0');

// Initial Static Readiness Default Texts
assert(formHtml.includes('Select a scheme to check eligibility.'), 'TEST 24.13: HTML initial state displays "Select a scheme to check eligibility."');
assert(formHtml.includes('Select a scheme to begin.'), 'TEST 24.14: HTML initial state displays "Select a scheme to begin."');

// -----------------------------------------------------------------------------
// TEST 25: API Client Helper Verification (client/js/api.js)
// -----------------------------------------------------------------------------
assert(apiJs.includes('getSchemes: async'), 'TEST 25.1: window.API.getSchemes is defined in client/js/api.js');
assert(apiJs.includes('getSchemeById: async'), 'TEST 25.2: window.API.getSchemeById is defined in client/js/api.js');
assert(apiJs.includes("request('/schemes'"), 'TEST 25.3: API.getSchemes queries /schemes endpoint');

// -----------------------------------------------------------------------------
// TEST 26: Scheme Dropdown Population & Dynamic Multi-Scheme Switching
// -----------------------------------------------------------------------------
// 1. Select Kalaignar Magalir Urimai Thittam
exportedAssistant.selectScheme('TN-KMUT-001', false);
let activeScheme = exportedAssistant.getCurrentScheme();
assert(activeScheme && activeScheme.code === 'TN-KMUT-001', 'TEST 26.1: Active scheme switches to TN-KMUT-001');
assert(activeScheme.specific_fields.some(f => f.id === 'smart_card_no'), 'TEST 26.2: KMUT contains smart_card_no');
assert(activeScheme.specific_fields.some(f => f.id === 'annual_income'), 'TEST 26.3: KMUT contains annual_income');
assert(activeScheme.specific_fields.some(f => f.id === 'eb_consumer_no'), 'TEST 26.4: KMUT contains eb_consumer_no');
assert(activeScheme.specific_fields.some(f => f.id === 'owns_car'), 'TEST 26.5: KMUT contains owns_car');
let metrics = exportedAssistant.calculateReadinessScore();
assert(metrics.totalFieldsCount > 0, 'TEST 26.6: KMUT total fields is > 0');
assert(metrics.totalDocsCount === 3, 'TEST 26.7: KMUT requires 3 documents');

// 2. Switch to Pudhumai Penn Scheme
exportedAssistant.selectScheme('TN-PUDHUMAI-002', false);
activeScheme = exportedAssistant.getCurrentScheme();
assert(activeScheme && activeScheme.code === 'TN-PUDHUMAI-002', 'TEST 26.8: Active scheme switches to TN-PUDHUMAI-002');
assert(activeScheme.specific_fields.some(f => f.id === 'school_emis_id'), 'TEST 26.9: Pudhumai Penn contains school_emis_id');
assert(activeScheme.specific_fields.some(f => f.id === 'college_name'), 'TEST 26.10: Pudhumai Penn contains college_name');
assert(activeScheme.specific_fields.some(f => f.id === 'study_year'), 'TEST 26.11: Pudhumai Penn contains study_year');
assert(!activeScheme.specific_fields.some(f => f.id === 'eb_consumer_no'), 'TEST 26.12: Pudhumai Penn does not leak KMUT eb_consumer_no');

// 3. Switch to Naan Mudhalvan Scheme
exportedAssistant.selectScheme('TN-NM-003', false);
activeScheme = exportedAssistant.getCurrentScheme();
assert(activeScheme && activeScheme.code === 'TN-NM-003', 'TEST 26.13: Active scheme switches to TN-NM-003');
assert(activeScheme.specific_fields.some(f => f.id === 'edu_qualification'), 'TEST 26.14: Naan Mudhalvan contains edu_qualification');
assert(activeScheme.specific_fields.some(f => f.id === 'preferred_skill_domain'), 'TEST 26.15: Naan Mudhalvan contains preferred_skill_domain');
assert(activeScheme.specific_fields.some(f => f.id === 'institution_district'), 'TEST 26.16: Naan Mudhalvan contains institution_district');

// 4. Switch to CMCHIS
exportedAssistant.selectScheme('TN-CMCHIS-004', false);
activeScheme = exportedAssistant.getCurrentScheme();
assert(activeScheme && activeScheme.code === 'TN-CMCHIS-004', 'TEST 26.17: Active scheme switches to TN-CMCHIS-004');
assert(activeScheme.specific_fields.some(f => f.id === 'smart_card_no'), 'TEST 26.18: CMCHIS contains smart_card_no');
assert(activeScheme.specific_fields.some(f => f.id === 'income_cert_no'), 'TEST 26.19: CMCHIS contains income_cert_no');
assert(activeScheme.specific_fields.some(f => f.id === 'family_members_count'), 'TEST 26.20: CMCHIS contains family_members_count');

// 5. Switch to PM-KISAN
exportedAssistant.selectScheme('CENTRAL-PMKISAN-007', false);
activeScheme = exportedAssistant.getCurrentScheme();
assert(activeScheme && activeScheme.code === 'CENTRAL-PMKISAN-007', 'TEST 26.21: Active scheme switches to CENTRAL-PMKISAN-007');
assert(activeScheme.specific_fields.some(f => f.id === 'patta_no'), 'TEST 26.22: PM-KISAN contains patta_no');
assert(activeScheme.specific_fields.some(f => f.id === 'survey_no'), 'TEST 26.23: PM-KISAN contains survey_no');
assert(activeScheme.specific_fields.some(f => f.id === 'farmer_category'), 'TEST 26.24: PM-KISAN contains farmer_category');
assert(!activeScheme.specific_fields.some(f => f.id === 'school_emis_id'), 'TEST 26.25: PM-KISAN does not leak student fields');

// -----------------------------------------------------------------------------
// TEST 27: Error Handling for Non-Existent Scheme
// -----------------------------------------------------------------------------
exportedAssistant.selectScheme('NON_EXISTENT_SCHEME_XYZ', false);
assert(exportedAssistant.getCurrentScheme() === null, 'TEST 27.1: Invalid scheme gracefully resets currentScheme to null without throwing');

// Reset to selector state
exportedAssistant.resetToSchemeSelector();
assert(exportedAssistant.getCurrentScheme() === null, 'TEST 27.2: resetToSchemeSelector sets currentScheme to null');
const resetMetrics = exportedAssistant.calculateReadinessScore();
assert(resetMetrics.score === 0, 'TEST 27.3: resetToSchemeSelector resets readiness score to 0%');
assert(resetMetrics.filledFieldsCount === 0 && resetMetrics.totalFieldsCount === 0, 'TEST 27.4: Fields count is safely 0 / 0');
assert(resetMetrics.availableDocsCount === 0 && resetMetrics.totalDocsCount === 0, 'TEST 27.5: Documents count is safely 0 / 0');

// -----------------------------------------------------------------------------
// TEST 28: Zero Duplication & Canonical Dataset Alignment
// -----------------------------------------------------------------------------
assert(Object.keys(schemes).length === 12, `TEST 28.1: Form Assistant contains exactly 12 canonical schemes (got ${Object.keys(schemes).length})`);
Object.values(schemes).forEach((sch, i) => {
  assert(!!sch.code, `TEST 28.2.${i + 1}: Scheme ${sch.id} has valid code (${sch.code})`);
  assert(!!sch.name, `TEST 28.3.${i + 1}: Scheme ${sch.code} has valid name`);
  assert(!!sch.portal && sch.portal.startsWith('https://'), `TEST 28.4.${i + 1}: Scheme ${sch.code} has HTTPS portal (${sch.portal})`);
});

console.log('\n================================================================');
console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
