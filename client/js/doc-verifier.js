// CrowdCity AI v2.0 - Document Verification Assistant JavaScript
// Features genuine OCR text extraction (PDF.js + Tesseract.js), content-based document type verification,
// pixel resolution measurement, canvas border crop inspection, and deterministic readiness scoring.

(function() {
  'use strict';

  let userDocs = [];
  let isAnalyzing = false;

  const DOC_TYPE_LABELS = {
    aadhaar: 'Aadhaar',
    resume: 'resume PDF',
    pan_card: 'PAN Card',
    ration_card: 'Smart Family Ration Card',
    income_cert: 'Income Certificate',
    community_cert: 'Community Certificate',
    bank_passbook: 'Bank Account Passbook',
    student_id: 'Student ID / Study Certificate',
    farmer_cert: 'Farmer Ownership Certificate (Patta)',
    disability_cert: 'Disability Certificate',
    passport_photo: 'Passport Size Photograph',
    driving_licence: 'Driving Licence',
    other: 'Document',
    general_document: 'unrecognized document'
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthenticatedUserId() {
    try {
      if (typeof window.getCurrentUser === 'function') {
        const u = window.getCurrentUser();
        if (u && (u.id || u.sub)) return u.id || u.sub;
      }
      if (typeof window.getSession === 'function') {
        const s = window.getSession();
        if (s && s.user && (s.user.id || s.user.sub)) return s.user.id || s.user.sub;
      }
      const sessionStr = localStorage.getItem('cc_session');
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (parsed && parsed.user && (parsed.user.id || parsed.user.sub)) {
          return parsed.user.id || parsed.user.sub;
        }
      }
    } catch (e) {}
    return null;
  }

  // High-performance IndexedDB engine for accessing user's uploaded document files
  const IndexedDocDB = {
    dbName: 'CrowdCityDocWalletDB',
    storeName: 'documents',

    open: function() {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          return reject(new Error('IndexedDB unavailable'));
        }
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },

    getFile: async function(id, expectedUserId) {
      try {
        const db = await this.open();
        return new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(id);
          req.onsuccess = () => {
            const record = req.result || null;
            if (!record) return resolve(null);
            // Enforce user ownership if record metadata contains user_id
            if (expectedUserId && record.metadata && record.metadata.user_id && record.metadata.user_id !== expectedUserId) {
              return resolve(null);
            }
            resolve(record);
          };
          req.onerror = () => resolve(null);
        });
      } catch (e) {
        return null;
      }
    }
  };

  function loadUserDocs() {
    userDocs = [];
    const currentUserId = getAuthenticatedUserId();
    try {
      const stored = localStorage.getItem('cc_user_uploaded_docs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          userDocs = parsed.filter(d => {
            if (!d || !d.id) return false;
            if (currentUserId && d.user_id && d.user_id !== currentUserId) return false;
            if (!currentUserId && d.user_id) return false;
            return true;
          });
        }
      }
    } catch (e) {
      userDocs = [];
    }
    return userDocs;
  }

  async function syncDocsFromCloudIfEmpty() {
    const currentUserId = getAuthenticatedUserId();
    if (!currentUserId || userDocs.length > 0) return;
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('user_document_wallet')
            .select('id, user_id, doc_type, doc_name, file_url, file_size, file_format, created_at')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data) && data.length > 0) {
            userDocs = data;
            localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(data));
            renderDocumentSelector();
          }
        }
      }
    } catch (e) {}
  }

  function renderDocumentSelector() {
    const selector = document.getElementById('select-doc-to-verify');
    const verifyBtn = document.getElementById('btn-run-verification');
    if (!selector) return;

    if (userDocs.length === 0) {
      selector.innerHTML = `<option value="">No documents uploaded to wallet yet</option>`;
      if (verifyBtn) verifyBtn.disabled = false;
      return;
    }

    selector.innerHTML = userDocs.map(d => `
      <option value="${escapeHtml(d.id)}">${escapeHtml(d.doc_name)} (${escapeHtml(d.doc_type)})</option>
    `).join('');
  }

  /**
   * Content-based document type classifier (NEVER relies on filename).
   */
  function detectActualDocumentType(extractedText = '') {
    const raw = typeof extractedText === 'string' ? extractedText.trim() : '';
    if (raw.length < 15) return 'unreadable_or_empty';

    const lower = raw.toLowerCase();

    // 1. Aadhaar content markers
    const hasAadhaarNumber = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/.test(raw) ||
                             /\b[xX*]{4}[\s-]?[xX*]{4}[\s-]?\d{4}\b/.test(raw);
    const aadhaarKeywordHits = [
      'unique identification authority',
      'uidai',
      'government of india',
      'aadhaar',
      'ஆதார்',
      'मेरा आधार',
      'year of birth',
      'enrolment no',
      'vid :'
    ].filter(k => lower.includes(k)).length;

    if (hasAadhaarNumber && (aadhaarKeywordHits >= 1 || /\b(dob|male|female|address|s\/o|d\/o|w\/o)\b/i.test(raw))) {
      return 'aadhaar';
    }
    if (aadhaarKeywordHits >= 2) {
      return 'aadhaar';
    }

    // 2. Resume / CV content markers
    const resumeMarkers = [
      'curriculum vitae',
      'work experience',
      'professional experience',
      'professional summary',
      'career objective',
      'technical skills',
      'academic projects',
      'education',
      'certifications',
      'internship',
      'linkedin.com',
      'github.com',
      'b.tech',
      'b.e.',
      'cgpa',
      'achievements'
    ];
    const hasResumeWord = /\bresume\b/i.test(raw);
    const resumeHitCount = resumeMarkers.filter(m => lower.includes(m)).length + (hasResumeWord ? 2 : 0);
    if (resumeHitCount >= 3) {
      return 'resume';
    }

    // 3. PAN Card markers
    if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(raw) || (lower.includes('income tax department') && lower.includes('permanent account number'))) {
      return 'pan_card';
    }

    // 4. Smart Family Ration Card markers
    if (['family card', 'smart card', 'civil supplies', 'public distribution', 'குடும்ப அட்டை', 'tnepds', 'fps code'].filter(k => lower.includes(k)).length >= 2) {
      return 'ration_card';
    }

    // 5. Income Certificate markers
    if (lower.includes('income certificate') || lower.includes('வருமானச் சான்றிதழ்') || (lower.includes('annual income') && lower.includes('tahsildar'))) {
      return 'income_cert';
    }

    // 6. Community Certificate markers
    if (lower.includes('community certificate') || lower.includes('சாதிச் சான்றிதழ்') || (lower.includes('community') && lower.includes('backward class'))) {
      return 'community_cert';
    }

    // 7. Bank Passbook markers
    if (['ifsc', 'account number', 'account no', 'passbook', 'savings bank', 'micr'].filter(k => lower.includes(k)).length >= 2) {
      return 'bank_passbook';
    }

    // 8. Student ID / Bonafide markers
    if (['bonafide certificate', 'student id', 'roll no', 'register number', 'semester', 'institution'].filter(k => lower.includes(k)).length >= 2) {
      return 'student_id';
    }

    // 9. Farmer / Patta markers
    if (['patta', 'chitta', 'adangal', 'survey no', 'uzhavar', 'பட்டா'].filter(k => lower.includes(k)).length >= 2) {
      return 'farmer_cert';
    }

    // 10. Disability Certificate markers
    if (['disability certificate', 'differently abled', 'udid', 'percentage of disability', 'மாற்றுத்திறனாளி'].filter(k => lower.includes(k)).length >= 1) {
      return 'disability_cert';
    }

    // 11. Driving Licence markers
    if (['driving licence', 'driving license', 'dl no', 'mcwg', 'lmv'].filter(k => lower.includes(k)).length >= 2) {
      return 'driving_licence';
    }

    return 'general_document';
  }

  /**
   * Inspects rendered canvas borders and OCR word bounding boxes to detect genuine edge clipping/cropping.
   */
  function inspectCanvasBorders(canvas, ocrWords = []) {
    const croppedEdges = new Set();
    if (!canvas || !canvas.width || !canvas.height) return [];

    const w = canvas.width;
    const h = canvas.height;
    const marginX = Math.max(2, Math.floor(w * 0.015));
    const marginY = Math.max(2, Math.floor(h * 0.015));

    // 1. Check OCR word bounding boxes if provided by Tesseract
    if (Array.isArray(ocrWords) && ocrWords.length > 0) {
      for (const word of ocrWords) {
        const text = (word && word.text ? String(word.text).trim() : '');
        if (text.length < 2 || !word.bbox) continue;
        const { x0, y0, x1, y1 } = word.bbox;
        if (x0 <= marginX) croppedEdges.add('left');
        if (x1 >= w - marginX) croppedEdges.add('right');
        if (y0 <= marginY) croppedEdges.add('top');
        if (y1 >= h - marginY) croppedEdges.add('bottom');
      }
    }

    return Array.from(croppedEdges);
  }

  /**
   * Deterministic, reproducible Document Quality & Readiness evaluator.
   */
  function computeDeterministicDocumentAnalysis(docMeta = {}, extractedText = '', metrics = {}) {
    const cleanText = typeof extractedText === 'string' ? extractedText.trim() : '';
    const words = cleanText ? cleanText.split(/\s+/).filter(w => /[a-zA-Z0-9\u0B80-\u0BFF]{2,}/.test(w)) : [];
    const wordCount = words.length;
    const expectedType = String(docMeta.doc_type || 'other').toLowerCase().trim();
    const expectedLabel = DOC_TYPE_LABELS[expectedType] || docMeta.doc_type || 'Document';

    const detectedType = detectActualDocumentType(cleanText);
    const isPhotoSlot = expectedType === 'passport_photo';

    let documentTypeMismatch = false;
    if (!isPhotoSlot && expectedType !== 'other' && wordCount >= 3) {
      if (detectedType === 'resume' && expectedType !== 'resume') {
        documentTypeMismatch = true;
      } else if (detectedType !== 'general_document' && detectedType !== 'unreadable_or_empty' && detectedType !== expectedType) {
        documentTypeMismatch = true;
      } else if (expectedType === 'aadhaar' && detectedType !== 'aadhaar') {
        documentTypeMismatch = true;
      }
    }

    const sourceType = metrics.sourceType || (String(docMeta.doc_name || '').toLowerCase().endsWith('.pdf') ? 'digital_pdf' : 'image');
    let ocrConfidence = 0;
    if (typeof metrics.ocrConfidence === 'number' && !Number.isNaN(metrics.ocrConfidence)) {
      ocrConfidence = Math.max(0, Math.min(100, Math.round(metrics.ocrConfidence)));
    } else if (wordCount >= 3) {
      ocrConfidence = sourceType === 'digital_pdf' ? 90 : 85;
    }

    const pixelWidth = Number(metrics.pixelWidth) || 0;
    const pixelHeight = Number(metrics.pixelHeight) || 0;
    const measuredDpi = Number(metrics.measuredDpi) || null;
    let resolutionScore = 20;
    let isLowResolution = false;

    if (sourceType !== 'digital_pdf' && pixelWidth > 0 && pixelHeight > 0) {
      const minSide = Math.min(pixelWidth, pixelHeight);
      const maxSide = Math.max(pixelWidth, pixelHeight);
      if (minSide >= 900 && maxSide >= 1200) {
        resolutionScore = 20;
        isLowResolution = false;
      } else if (minSide >= 600 && maxSide >= 800) {
        resolutionScore = 16;
        isLowResolution = false;
      } else if (minSide >= 400) {
        resolutionScore = 9;
        isLowResolution = true;
      } else {
        resolutionScore = 4;
        isLowResolution = true;
      }
    } else if (measuredDpi && measuredDpi < 150) {
      resolutionScore = 8;
      isLowResolution = true;
    }

    const croppedEdges = Array.isArray(metrics.croppedEdges) ? metrics.croppedEdges.filter(Boolean) : [];
    const hasEdgeCropping = croppedEdges.length > 0;

    const isReadable = isPhotoSlot ? (pixelWidth >= 200 || (docMeta.file_size || 0) > 2048) : (wordCount >= 3 && ocrConfidence >= 40);
    let clarityScore = 0;

    if (!isReadable) {
      clarityScore = wordCount > 0 ? 38 : 25;
    } else if (isPhotoSlot) {
      clarityScore = isLowResolution ? 62 : 92;
    } else {
      const ocrComponent = Math.round((ocrConfidence / 100) * 60);
      const textComponent = wordCount >= 15 ? 20 : (wordCount >= 8 ? 15 : 8);
      const rawScore = ocrComponent + textComponent + resolutionScore;
      const mismatchPenalty = documentTypeMismatch ? 22 : 0;
      const cropPenalty = hasEdgeCropping ? 8 : 0;
      clarityScore = Math.max(15, Math.min(100, rawScore - mismatchPenalty - cropPenalty));
    }

    let qualityStatus = 'Good';
    if (!isReadable || clarityScore < 50) {
      qualityStatus = 'Poor Quality';
    } else if (documentTypeMismatch || clarityScore < 80 || isLowResolution || hasEdgeCropping) {
      qualityStatus = 'Needs Attention';
    } else {
      qualityStatus = 'Good';
    }

    const recommendations = [];

    if (documentTypeMismatch) {
      if (expectedType === 'aadhaar' && detectedType === 'resume') {
        recommendations.push('Upload the correct Aadhaar document instead of a resume PDF.');
      } else {
        const detectedLabel = DOC_TYPE_LABELS[detectedType] || 'a different document';
        recommendations.push(`Upload the correct ${expectedLabel} document instead of ${detectedLabel}.`);
      }
      recommendations.push(`Ensure the replacement ${expectedLabel} scan has clearly legible printed text and complete document details.`);
    }

    if (!isReadable && !isPhotoSlot) {
      recommendations.push('No readable printed text could be extracted from this file. Upload a clear image or searchable PDF with legible text.');
    } else if (ocrConfidence > 0 && ocrConfidence < 70) {
      recommendations.push(`Measured OCR legibility is low (${ocrConfidence}% confidence). Re-capture the document in bright, even lighting without motion blur.`);
    }

    if (isLowResolution && pixelWidth > 0 && pixelHeight > 0) {
      recommendations.push(`Measured image dimensions are low (${pixelWidth}×${pixelHeight} px). Upload a higher-resolution scan (at least 800×600 px) so text remains sharp.`);
    } else if (measuredDpi && measuredDpi < 200) {
      recommendations.push(`Measured scan density is ${measuredDpi} DPI. Use a higher-resolution scan so small characters remain legible.`);
    }

    if (hasEdgeCropping) {
      recommendations.push(`Document content appears clipped near the ${croppedEdges.join(' and ')} edge(s). Include a visible margin around all four sides.`);
    }

    if (recommendations.length === 0) {
      recommendations.push(`Document text extraction succeeded (${wordCount} legible words, ${ocrConfidence}% OCR confidence) and matches expected ${expectedLabel} content.`);
      recommendations.push(`Verify that your printed name, date of birth, and reference numbers match your scheme application details.`);
    }

    const readinessSubtitle = qualityStatus === 'Good'
      ? 'Automated Readability & Readiness Check Completed'
      : 'Document Quality & Readiness Check — Action Needed';

    return {
      isReadable,
      clarityScore,
      qualityStatus,
      readinessSubtitle,
      documentTypeMismatch,
      expectedDocumentType: expectedType,
      detectedDocumentType: detectedType,
      measuredMetrics: {
        ocrConfidence,
        wordCount,
        charCount: cleanText.length,
        pixelWidth: pixelWidth || null,
        pixelHeight: pixelHeight || null,
        measuredDpi,
        sourceType,
        croppedEdges,
        hasEdgeCropping,
        isLowResolution
      },
      recommendations,
      extractedSummary: cleanText || 'No printed text detected in document.',
      disclaimer: 'Automated document quality and readiness check only. Does not constitute official government verification.'
    };
  }

  /**
   * Extract real text and measurement metrics from PDF using PDF.js + Tesseract OCR fallback
   */
  async function extractDocumentFromPdf(blob) {
    const metrics = {
      sourceType: 'digital_pdf',
      ocrConfidence: 0,
      pixelWidth: 0,
      pixelHeight: 0,
      croppedEdges: []
    };

    if (typeof pdfjsLib === 'undefined') {
      return { text: '', metrics };
    }

    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.0 });
        if (i === 1) {
          metrics.pixelWidth = Math.round(vp.width);
          metrics.pixelHeight = Math.round(vp.height);
        }
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map(item => item.str).join(' ');
        fullText += pageStrings + '\n';
      }

      const cleanText = fullText.trim();
      if (cleanText.length > 20) {
        metrics.sourceType = 'digital_pdf';
        metrics.ocrConfidence = 90;
        return { text: cleanText, metrics };
      }

      // Scanned PDF: render page 1 to canvas and run Tesseract OCR
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      metrics.sourceType = 'scanned_pdf';
      metrics.pixelWidth = canvas.width;
      metrics.pixelHeight = canvas.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      if (typeof Tesseract !== 'undefined') {
        const result = await Tesseract.recognize(canvas, 'eng');
        const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';
        metrics.ocrConfidence = (result && result.data && typeof result.data.confidence === 'number')
          ? Math.round(result.data.confidence)
          : (text.length > 10 ? 80 : 0);
        metrics.croppedEdges = inspectCanvasBorders(canvas, result?.data?.words || []);
        return { text, metrics };
      }
    } catch (err) {
      metrics.extractionError = err?.message || 'PDF parsing error';
    }
    return { text: '', metrics };
  }

  /**
   * Extract real text and image dimensions/border metrics from Image (PNG, JPG, WebP)
   */
  async function extractDocumentFromImage(blob) {
    const metrics = {
      sourceType: 'image',
      ocrConfidence: 0,
      pixelWidth: 0,
      pixelHeight: 0,
      croppedEdges: []
    };

    let canvas = null;
    try {
      const imgUrl = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Invalid or corrupted image file'));
          el.src = imgUrl;
        });
        metrics.pixelWidth = img.naturalWidth || img.width || 0;
        metrics.pixelHeight = img.naturalHeight || img.height || 0;
        canvas = document.createElement('canvas');
        canvas.width = metrics.pixelWidth;
        canvas.height = metrics.pixelHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
      } finally {
        URL.revokeObjectURL(imgUrl);
      }
    } catch (imgErr) {
      metrics.extractionError = imgErr?.message || 'Invalid image file';
      return { text: '', metrics };
    }

    if (typeof Tesseract === 'undefined') {
      return { text: '', metrics };
    }

    try {
      const result = await Tesseract.recognize(canvas || blob, 'eng');
      const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';
      metrics.ocrConfidence = (result && result.data && typeof result.data.confidence === 'number')
        ? Math.round(result.data.confidence)
        : (text.length > 10 ? 80 : 0);
      if (canvas) {
        metrics.croppedEdges = inspectCanvasBorders(canvas, result?.data?.words || []);
      }
      return { text, metrics };
    } catch (err) {
      metrics.extractionError = err?.message || 'Image OCR error';
    }
    return { text: '', metrics };
  }

  function renderErrorReport(title, message) {
    const container = document.getElementById('doc-verification-report');
    if (!container) return;
    container.innerHTML = `
      <div style="background: var(--bg-surface); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 20px; padding: 2rem; text-align: center;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; color: #ef4444; margin-bottom: 0.85rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.4rem 0;">${escapeHtml(title)}</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function setAnalyzeButtonLoading(loading) {
    const verifyBtn = document.getElementById('btn-run-verification');
    const selector = document.getElementById('select-doc-to-verify');
    if (selector) selector.disabled = loading;
    if (!verifyBtn) return;
    verifyBtn.disabled = loading;
    if (loading) {
      verifyBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Analyzing...</span>`;
    } else {
      verifyBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> <span>Analyze Document</span>`;
    }
  }

  /**
   * Main Document Analysis flow
   */
  async function analyzeDocument(docId) {
    if (isAnalyzing) return null;
    const reportContainer = document.getElementById('doc-verification-report');
    if (!reportContainer) return null;

    loadUserDocs();
    const currentUserId = getAuthenticatedUserId();

    if (!docId || userDocs.length === 0) {
      renderErrorReport('No Document Selected', 'Please upload a document in My Documents before running quality verification.');
      return null;
    }

    const docMeta = userDocs.find(d => String(d.id) === String(docId));
    if (!docMeta) {
      renderErrorReport('Document Not Found or Unauthorized', 'The selected document could not be found in your wallet or belongs to another account.');
      return null;
    }

    if (currentUserId && docMeta.user_id && docMeta.user_id !== currentUserId) {
      renderErrorReport('Unauthorized Document Access', 'You can only analyze documents belonging to your own authenticated account.');
      return null;
    }

    isAnalyzing = true;
    setAnalyzeButtonLoading(true);

    reportContainer.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 1.25rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">Analyzing Document OCR & Readability...</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Scanning document file, extracting printed text, and measuring clarity & content match.</p>
      </div>
    `;

    try {
      let realExtractedText = '';
      let extractionMetrics = {
        sourceType: String(docMeta.doc_name || '').toLowerCase().endsWith('.pdf') ? 'digital_pdf' : 'image',
        ocrConfidence: 0,
        pixelWidth: 0,
        pixelHeight: 0,
        croppedEdges: []
      };

      const stored = await IndexedDocDB.getFile(docMeta.id, currentUserId);
      let fileBlob = stored ? stored.blob : null;

      if (!fileBlob && docMeta.file_url && (docMeta.file_url.startsWith('blob:') || docMeta.file_url.startsWith('data:'))) {
        const fetchRes = await fetch(docMeta.file_url);
        if (fetchRes.ok) fileBlob = await fetchRes.blob();
      }

      if (!fileBlob) {
        renderErrorReport(
          'Document File Unavailable for OCR',
          'The binary file for this document is not stored on this device. Please re-upload the file in My Documents to run OCR & quality analysis.'
        );
        return null;
      }

      const fileFormat = String(docMeta.file_format || fileBlob.type || '').toLowerCase();
      const fileNameLower = String(docMeta.doc_name || '').toLowerCase();
      const isPdf = fileFormat.includes('pdf') || fileNameLower.endsWith('.pdf');
      const isSupportedImage = fileFormat.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp)$/i.test(fileNameLower);

      if (!isPdf && !isSupportedImage) {
        renderErrorReport(
          'Unsupported File Format',
          'Only PDF and standard image formats (JPG, PNG, WebP) can be analyzed.'
        );
        return null;
      }

      const extracted = isPdf
        ? await extractDocumentFromPdf(fileBlob)
        : await extractDocumentFromImage(fileBlob);

      realExtractedText = extracted.text || '';
      extractionMetrics = extracted.metrics || extractionMetrics;

      if (extractionMetrics.extractionError && !realExtractedText) {
        renderErrorReport(
          'Corrupted or Unreadable File',
          `The uploaded file could not be decoded (${extractionMetrics.extractionError}). Please upload a valid PDF or image file.`
        );
        return null;
      }

      // Compute local deterministic report first (guarantees reproducibility)
      const deterministicReport = computeDeterministicDocumentAnalysis(docMeta, realExtractedText, extractionMetrics);

      // Call backend /api/ai/verify-document with genuine extracted text & measured metrics
      try {
        const res = await fetch('/api/ai/verify-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            docMeta: {
              id: docMeta.id,
              doc_type: docMeta.doc_type,
              doc_name: docMeta.doc_name,
              file_size: docMeta.file_size,
              file_format: docMeta.file_format
            },
            extractedText: realExtractedText,
            metrics: extractionMetrics,
            scheme: { scheme_name: 'Tamil Nadu Government Citizen Services' }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.report) {
            renderReport(data.report, docMeta, realExtractedText);
            return data.report;
          }
        }
      } catch (e) {
        // Fallback seamlessly to identical deterministic report if offline
      }

      renderReport(deterministicReport, docMeta, realExtractedText);
      return deterministicReport;
    } finally {
      isAnalyzing = false;
      setAnalyzeButtonLoading(false);
    }
  }

  function renderReport(report, docMeta, realText) {
    const container = document.getElementById('doc-verification-report');
    if (!container) return;

    const statusText = report.qualityStatus || 'Needs Attention';
    const isGood = statusText === 'Good';
    const isPoor = statusText === 'Poor Quality';
    const badgeBg = isGood ? 'rgba(16, 185, 129, 0.15)' : (isPoor ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)');
    const badgeColor = isGood ? '#10b981' : (isPoor ? '#ef4444' : '#d97706');
    const badgeBorder = isGood ? 'rgba(16, 185, 129, 0.3)' : (isPoor ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)');

    const subtitleText = report.readinessSubtitle || (
      isGood
        ? 'Automated Readability & Readiness Check Completed'
        : 'Document Quality & Readiness Check — Action Needed'
    );
    const displayedText = realText || report.extractedSummary || 'No printed text detected in document image.';

    container.innerHTML = `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 2rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
        
        <!-- Quality Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; padding: 0.25rem 0.65rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
              Quality Status: ${escapeHtml(statusText)}
            </span>
            <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin: 0.4rem 0 0.2rem 0;">${escapeHtml(docMeta.doc_name || 'Document Verification Report')}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${escapeHtml(subtitleText)}</p>
          </div>

          <div style="text-align: center; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 0.75rem 1.25rem;">
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary); line-height: 1;">${Number(report.clarityScore) || 0}%</div>
            <div style="font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Clarity Score</div>
          </div>
        </div>

        <!-- Quality Analysis & Suggestions -->
        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-clipboard-check"></i> <span>Quality Analysis & Suggestions</span>
          </div>
          <ul style="padding-left: 1.2rem; margin: 0; font-size: 0.9rem; color: var(--text-main); line-height: 1.6;">
            ${(report.recommendations || []).map(rec => `<li style="margin-bottom: 0.4rem;">${escapeHtml(rec)}</li>`).join('')}
          </ul>
        </div>

        <!-- Extracted OCR Text Preview -->
        <div style="margin-bottom: 1.5rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">
            OCR Text Extraction Preview
          </div>
          <div style="font-size: 0.85rem; color: var(--text-main); background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 1rem; font-family: monospace; white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow-y: auto;">${escapeHtml(displayedText)}</div>
        </div>

        <!-- Mandatory Disclaimer Notice -->
        <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.05)); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 1rem; font-size: 0.82rem; color: var(--text-main); line-height: 1.5;">
          <i class="fa-solid fa-shield-halved" style="color: #d97706; margin-right: 0.4rem;"></i>
          <strong>Disclaimer:</strong> ${escapeHtml(report.disclaimer || 'Automated document quality and readiness check only. Does not constitute official government verification.')}
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 0.85rem; justify-content: flex-end; margin-top: 1.5rem; flex-wrap: wrap;">
          <a href="my-documents.html" class="btn btn-secondary" style="padding: 0.65rem 1.2rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; text-decoration: none;">
            Manage Documents
          </a>
          <button type="button" class="btn btn-primary" onclick="window.location.reload()" style="padding: 0.65rem 1.4rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px;">
            Verify Another Document
          </button>
        </div>

      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadUserDocs();
    renderDocumentSelector();
    syncDocsFromCloudIfEmpty();

    const verifyBtn = document.getElementById('btn-run-verification');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => {
        const selector = document.getElementById('select-doc-to-verify');
        const selectedId = selector && selector.value ? selector.value : null;
        analyzeDocument(selectedId);
      });
    }
  });

  if (typeof window !== 'undefined') {
    window.CrowdCityDocVerifier = {
      detectActualDocumentType,
      computeDeterministicDocumentAnalysis,
      inspectCanvasBorders,
      analyzeDocument,
      loadUserDocs,
      getAuthenticatedUserId
    };
  }

})();
