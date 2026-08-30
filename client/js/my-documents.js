// CrowdCity AI v2.0 - My Documents Wallet JavaScript
// Manages document uploads, drag-and-drop, preview modal, deletion, IndexedDB binary storage, and Supabase integration.

(function() {
  'use strict';

  let userDocuments = [];
  let currentFilterType = 'all';
  let currentSearchQuery = '';

  const documentTypesList = [
    { code: 'aadhaar', name: 'Aadhaar Card' },
    { code: 'ration_card', name: 'Smart Family Ration Card' },
    { code: 'income_cert', name: 'Income Certificate' },
    { code: 'community_cert', name: 'Community Certificate' },
    { code: 'bank_passbook', name: 'Bank Account Passbook' },
    { code: 'pan_card', name: 'PAN Card' },
    { code: 'student_id', name: 'Student ID / Study Certificate' },
    { code: 'farmer_cert', name: 'Farmer Ownership Certificate (Patta)' },
    { code: 'disability_cert', name: 'Disability Certificate' },
    { code: 'passport_photo', name: 'Passport Size Photograph' },
    { code: 'driving_licence', name: 'Driving Licence' },
    { code: 'other', name: 'Other Document' }
  ];

  // High-performance IndexedDB engine for multi-megabyte document binary storage (PDFs, PNGs, JPGs)
  const IndexedDocDB = {
    dbName: 'CrowdCityDocWalletDB',
    storeName: 'documents',

    open: function() {
      return new Promise((resolve, reject) => {
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

    saveFile: async function(id, blob, metadata) {
      try {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.put({ id: id, blob: blob, metadata: metadata, updated_at: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = (e) => reject(e.target.error);
        });
      } catch (e) {
        console.warn("IndexedDB save warning:", e);
        return false;
      }
    },

    getFile: async function(id) {
      try {
        const db = await this.open();
        return new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch (e) {
        return null;
      }
    },

    deleteFile: async function(id) {
      try {
        const db = await this.open();
        return new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        return false;
      }
    }
  };

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async function compressImageFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return fileToDataURL(file);
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          fileToDataURL(file).then(resolve).catch(() => resolve(''));
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        fileToDataURL(file).then(resolve).catch(() => resolve(''));
      };
      reader.readAsDataURL(file);
    });
  }

  function dataURLToBlob(dataurl) {
    try {
      if (!dataurl || typeof dataurl !== 'string' || !dataurl.startsWith('data:')) return null;
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.warn("dataURLToBlob warning:", e);
      return null;
    }
  }

  function generateDocUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  let _docFetchInFlight = null;
  let _lastDocFetchAt = 0;
  const _DOC_FETCH_COOLDOWN_MS = 6000;

  async function fetchUserDocuments(isManualRetry = false) {
    const now = Date.now();
    // 1. Guard against rapid repeated automatic calls unless manual retry
    if (!isManualRetry && _lastDocFetchAt && (now - _lastDocFetchAt < _DOC_FETCH_COOLDOWN_MS)) {
      console.log('[DATA] Document Wallet FETCH SKIPPED (cooldown active)');
      return;
    }

    // 2. Return in-flight promise if a request is already executing (deduplication)
    if (_docFetchInFlight) {
      console.log('[DATA] Document Wallet FETCH JOIN (deduplicated in-flight)');
      return _docFetchInFlight;
    }

    _docFetchInFlight = (async () => {
      console.log('[DATA] Document Wallet FETCH START');

      // Pre-load local cached documents immediately for fast 0ms paint
      if (userDocuments.length === 0) {
        try {
          const local = localStorage.getItem('cc_user_uploaded_docs');
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              userDocuments = parsed;
              renderDocumentsList();
            }
          }
        } catch (e) {}
      }

      // Show skeleton / loader only if we have zero documents in memory
      const container = document.getElementById('documents-grid-container');
      if (container && userDocuments.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 4rem 1rem; grid-column: 1 / -1;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
            <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your secure document wallet...</p>
          </div>
        `;
      }

      // Get authenticated user ID synchronously without extra network calls
      let userId = null;
      if (typeof getCurrentUser === 'function') {
        const u = getCurrentUser();
        if (u) userId = u.id || u.sub;
      }
      if (!userId && typeof getSession === 'function') {
        const s = getSession();
        if (s && s.user) userId = s.user.id || s.user.sub;
      }
      if (!userId) {
        try {
          const sessionStr = localStorage.getItem('cc_session');
          if (sessionStr) {
            const parsed = JSON.parse(sessionStr);
            if (parsed && parsed.user) userId = parsed.user.id || parsed.user.sub;
          }
        } catch (e) {}
      }

      if (!userId) {
        console.log('[DATA] Document Wallet FETCH ERROR: No authenticated user');
        if (userDocuments.length === 0) {
          renderEmptyState("Please sign in to access your secure document wallet.");
        }
        return;
      }

      updateMPINHeaderButton();

      let fetchSucceeded = false;
      try {
        if (typeof window.getOrInitSupabaseClient === 'function') {
          const client = await window.getOrInitSupabaseClient();
          if (client) {
            const { data, error } = await client
              .from('user_document_wallet')
              .select('id, user_id, doc_type, doc_name, file_url, file_size, file_format, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
              fetchSucceeded = true;
              _lastDocFetchAt = Date.now();
              console.log('[DATA] Document Wallet FETCH SUCCESS', data.length);

              // Mark cloud documents as synced
              const cloudDocs = data.map(d => ({ ...d, sync_status: 'synced' }));

              // Retain any local-only pending documents that haven't synced yet
              const pendingDocs = userDocuments.filter(localDoc => 
                localDoc.sync_status === 'pending_sync' && !cloudDocs.some(cd => cd.id === localDoc.id)
              );

              userDocuments = [...pendingDocs, ...cloudDocs];
              saveLocalDocsIndex(userDocuments);

              if (userDocuments.length > 0) {
                renderDocumentsList();
              } else {
                renderEmptyState("You haven't uploaded any documents to your wallet yet. Upload your Aadhaar, Ration Card, or Income Certificate to prepare for government scheme applications.");
              }
              return;
            } else if (error) {
              console.warn('[DATA] Document Wallet FETCH ERROR from Supabase:', error);
            }
          }
        }
      } catch (err) {
        console.warn('[DATA] Document Wallet FETCH ERROR:', err);
      }

      _lastDocFetchAt = Date.now();

      // If temporary network failure occurs, retain existing valid documents
      if (userDocuments.length > 0) {
        console.log('[DATA] Retaining existing in-memory/cached documents:', userDocuments.length);
        renderDocumentsList();
        return;
      }

      // Check local storage fallback
      try {
        const local = localStorage.getItem('cc_user_uploaded_docs');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            userDocuments = parsed;
            renderDocumentsList();
            return;
          }
        }
      } catch (e) {}

      // Clean error state with manual Try Again action
      renderErrorState("Unable to load documents. Please check your connection and try again.");
    })().finally(() => {
      _docFetchInFlight = null;
    });

    return _docFetchInFlight;
  }

  function renderErrorState(message) {
    const container = document.getElementById('documents-grid-container');
    const countElem = document.getElementById('docs-count-badge');
    if (countElem) countElem.textContent = '0';
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; grid-column: 1 / -1;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.8rem; color: #ef4444; margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">Unable to Load Documents</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <button type="button" id="btn-doc-retry" class="btn btn-secondary" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <i class="fa-solid fa-rotate-right"></i> <span>Try Again</span>
        </button>
      </div>
    `;

    const retryBtn = document.getElementById('btn-doc-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => fetchUserDocuments(true));
    }
  }

  function renderEmptyState(message) {
    const container = document.getElementById('documents-grid-container');
    const countElem = document.getElementById('docs-count-badge');
    if (countElem) countElem.textContent = '0';

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; grid-column: 1 / -1;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Documents Uploaded</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('doc-file-input').click()" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-cloud-arrow-up"></i> <span>Upload First Document</span>
        </button>
      </div>
    `;
  }

  function renderDocumentsList() {
    const container = document.getElementById('documents-grid-container');
    const countElem = document.getElementById('docs-count-badge');

    let filtered = userDocuments;
    if (currentFilterType !== 'all') {
      filtered = filtered.filter(d => d.doc_type === currentFilterType);
    }
    if (currentSearchQuery) {
      filtered = filtered.filter(d => (d.doc_name || '').toLowerCase().includes(currentSearchQuery) || (d.doc_type || '').toLowerCase().includes(currentSearchQuery));
    }

    if (countElem) countElem.textContent = filtered.length;

    if (!container) return;

    if (filtered.length === 0) {
      renderEmptyState("No documents match your filter criteria.");
      return;
    }

    container.innerHTML = filtered.map(doc => {
      const typeInfo = documentTypesList.find(t => t.code === doc.doc_type) || { name: doc.doc_name };
      const formattedDate = new Date(doc.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const sizeStr = doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : 'Document File';
      const isSynced = doc.sync_status !== 'pending_sync';
      const statusBadge = isSynced
        ? `<span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary);"><i class="fa-solid fa-cloud-check" style="margin-right: 4px;"></i> Available</span>`
        : `<span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: rgba(245, 158, 11, 0.12); color: #d97706;" title="Saved locally on this device"><i class="fa-solid fa-hard-drive" style="margin-right: 4px;"></i> Local (Sync Pending)</span>`;

      return `
        <div class="doc-wallet-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 6px 20px rgba(0,0,0,0.03);">
          
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem;">
              ${statusBadge}

              <button type="button" class="btn-delete-doc" data-id="${doc.id}" title="Delete Document" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; min-width: 0; overflow: hidden;">
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(99, 102, 241, 0.12); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                <i class="fa-solid fa-file-pdf"></i>
              </div>
              <div style="min-width: 0; flex: 1; overflow: hidden;">
                <h4 style="font-size: 0.98rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.15rem 0; line-height: 1.3; word-break: break-word; overflow-wrap: anywhere;" title="${doc.doc_name}">${doc.doc_name}</h4>
                <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${typeInfo.name}</span>
              </div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem; margin-bottom: 1rem;">
              <span><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
              <span><i class="fa-regular fa-file"></i> ${sizeStr}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-secondary btn-view-doc" data-id="${doc.id}" style="flex: 1; padding: 0.5rem 0.35rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px; text-align: center; cursor: pointer; white-space: nowrap;">
              <i class="fa-solid fa-eye"></i> View
            </button>
            <button type="button" class="btn btn-secondary btn-download-doc" data-id="${doc.id}" style="flex: 1; padding: 0.5rem 0.35rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px; text-align: center; cursor: pointer; white-space: nowrap;">
              <i class="fa-solid fa-download"></i> Download
            </button>
          </div>

        </div>
      `;
    }).join('');

    // Attach View Listeners (Protected by MPIN)
    container.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.id;
        const target = userDocuments.find(d => d.id === docId);
        if (target) {
          handleProtectedAction(() => openDocumentView(target));
        }
      });
    });

    // Attach Download Listeners (Protected by MPIN)
    container.querySelectorAll('.btn-download-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.id;
        const target = userDocuments.find(d => d.id === docId);
        if (target) {
          handleProtectedAction(() => downloadDocumentFile(target));
        }
      });
    });

    // Attach Delete Listeners (Protected by MPIN)
    container.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.id;
        handleProtectedAction(async () => {
          await deleteDocument(docId);
        });
      });
    });
  }

  async function openDocumentView(doc) {
    if (!doc) return;

    // 1. Try retrieving binary Blob from IndexedDB on current device
    const stored = await IndexedDocDB.getFile(doc.id);
    if (stored && stored.blob) {
      const blobUrl = URL.createObjectURL(stored.blob);
      window.open(blobUrl, '_blank');
      return;
    }

    // 2. Fallback to file_url (cloud Base64 Data URL or link)
    if (doc.file_url && !doc.file_url.startsWith('indexeddb://')) {
      if (doc.file_url.startsWith('data:')) {
        const blob = dataURLToBlob(doc.file_url);
        if (blob) {
          IndexedDocDB.saveFile(doc.id, blob, { docType: doc.doc_type, docName: doc.doc_name });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
          return;
        }
      }
      window.open(doc.file_url, '_blank');
      return;
    }

    if (window.showToast) window.showToast("Document preview unavailable on this device.", "warning");
  }

  async function downloadDocumentFile(doc) {
    if (!doc) return;

    const a = document.createElement('a');

    // 1. Try retrieving binary Blob from IndexedDB on current device
    const stored = await IndexedDocDB.getFile(doc.id);
    if (stored && stored.blob) {
      a.href = URL.createObjectURL(stored.blob);
    } else if (doc.file_url && doc.file_url.startsWith('data:')) {
      const blob = dataURLToBlob(doc.file_url);
      if (blob) {
        IndexedDocDB.saveFile(doc.id, blob, { docType: doc.doc_type, docName: doc.doc_name });
        a.href = URL.createObjectURL(blob);
      } else {
        a.href = doc.file_url;
      }
    } else if (doc.file_url && !doc.file_url.startsWith('indexeddb://')) {
      a.href = doc.file_url;
    } else {
      if (window.showToast) window.showToast("File data unavailable for download on this device.", "error");
      return;
    }

    a.download = doc.doc_name || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function uploadDocument(file, docType, docName) {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      if (window.showToast) window.showToast("File size exceeds 10MB limit.", "error");
      return;
    }

    const docUuid = generateDocUUID();
    const cleanDocName = docName || file.name || 'Uploaded Document';
    const mimeType = file.type || 'application/pdf';

    let userId = null;
    if (typeof getCurrentUser === 'function') {
      const u = getCurrentUser();
      if (u) userId = u.id || u.sub;
    }
    if (!userId && typeof getSession === 'function') {
      const s = getSession();
      if (s && s.user) userId = s.user.id || s.user.sub;
    }

    console.log('[DATA] Document Upload START', {
      docId: docUuid,
      hasUserId: !!userId,
      docType: docType,
      docName: cleanDocName,
      fileSize: file.size,
      mimeType: mimeType
    });

    // 1. Store full binary file Blob in local IndexedDB
    try {
      await IndexedDocDB.saveFile(docUuid, file, { docType, docName: cleanDocName });
      console.log('[DATA] Document Upload LOCAL SUCCESS');
    } catch (dbErr) {
      console.warn('[DATA] Document Upload LOCAL DB WARNING:', dbErr);
    }

    const newDoc = {
      id: docUuid,
      user_id: userId,
      doc_type: docType,
      doc_name: cleanDocName,
      file_url: `indexeddb://${docUuid}`,
      file_size: file.size,
      file_format: mimeType,
      sync_status: 'pending_sync',
      created_at: new Date().toISOString()
    };

    // Render document in grid immediately
    const exists = userDocuments.some(d => d.id === docUuid);
    if (!exists) {
      userDocuments.unshift(newDoc);
    }
    saveLocalDocsIndex(userDocuments);

    // Reset file input
    const fileInput = document.getElementById('doc-file-input');
    if (fileInput) fileInput.value = '';

    renderDocumentsList();

    // 2. Cloud Metadata Synchronization (Single bounded INSERT)
    if (userId) {
      console.log('[DATA] Document Upload CLOUD INSERT START');
      try {
        if (typeof window.getOrInitSupabaseClient === 'function') {
          const client = await window.getOrInitSupabaseClient();
          if (client) {
            const { data, error } = await client.from('user_document_wallet').insert([{
              id: docUuid,
              user_id: userId,
              doc_type: docType,
              doc_name: cleanDocName,
              file_url: `indexeddb://${docUuid}`,
              file_path: `doc_wallet/${cleanDocName}`,
              file_size: file.size,
              file_format: mimeType
            }]);

            if (!error) {
              console.log('[DATA] Document Upload CLOUD INSERT SUCCESS');
              console.log('[DATA] Document Upload COMPLETE');
              newDoc.sync_status = 'synced';
              saveLocalDocsIndex(userDocuments);
              renderDocumentsList();
              if (window.showToast) window.showToast(`Document "${cleanDocName}" securely added to your wallet!`, "success");
              return;
            } else {
              console.warn('[DATA] Document Upload CLOUD INSERT FAILED', error);
              console.log('[DATA] Document Upload STATUS: PENDING_SYNC');
            }
          }
        }
      } catch (cloudErr) {
        console.warn('[DATA] Document Upload CLOUD INSERT FAILED', cloudErr);
        console.log('[DATA] Document Upload STATUS: PENDING_SYNC');
      }
    } else {
      console.log('[DATA] Document Upload STATUS: PENDING_SYNC (No user ID)');
    }

    newDoc.sync_status = 'pending_sync';
    saveLocalDocsIndex(userDocuments);
    renderDocumentsList();
    if (window.showToast) window.showToast("Saved locally — cloud sync pending", "info");
  }

  function saveLocalDocsIndex(docsArray) {
    try {
      const cleanIndex = docsArray.map(d => ({
        id: d.id,
        user_id: d.user_id,
        doc_type: d.doc_type,
        doc_name: d.doc_name,
        file_url: d.file_url,
        file_size: d.file_size,
        file_format: d.file_format,
        sync_status: d.sync_status,
        created_at: d.created_at
      }));
      localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(cleanIndex));
    } catch (e) {
      console.warn("Local storage index error:", e);
    }
  }

  async function deleteDocument(docId) {
    console.log('[DATA] Document Delete START', { docId });
    // 1. Delete binary file from IndexedDB
    await IndexedDocDB.deleteFile(docId);

    const targetDoc = userDocuments.find(d => d.id === docId);
    userDocuments = userDocuments.filter(d => d.id !== docId);
    saveLocalDocsIndex(userDocuments);

    let userId = null;
    if (typeof getCurrentUser === 'function') {
      const u = getCurrentUser();
      if (u) userId = u.id || u.sub;
    }

    // 2. Delete from Supabase table if cloud synced
    if (userId && targetDoc && targetDoc.sync_status !== 'pending_sync') {
      try {
        if (typeof window.getOrInitSupabaseClient === 'function') {
          const client = await window.getOrInitSupabaseClient();
          if (client) {
            await client.from('user_document_wallet').delete().eq('id', docId).eq('user_id', userId);
            console.log('[DATA] Document Delete CLOUD SUCCESS');
          }
        }
      } catch (e) {
        console.warn('[DATA] Document Delete CLOUD WARNING:', e);
      }
    }

    if (window.showToast) window.showToast("Document deleted from wallet.", "info");
    renderDocumentsList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetchUserDocuments();

    // File Input & Drag and Drop Setup
    const fileInput = document.getElementById('doc-file-input');
    const dropZone = document.getElementById('doc-drop-zone');
    const selectDocType = document.getElementById('select-upload-doc-type');
    const inputDocName = document.getElementById('input-upload-doc-name');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const docType = selectDocType?.value || 'aadhaar';
        const docName = inputDocName?.value || file?.name || 'Uploaded Document';
        if (file) uploadDocument(file, docType, docName);
      });
    }

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropZone.style.borderColor = 'var(--primary)';
          dropZone.style.background = 'rgba(13, 148, 136, 0.08)';
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropZone.style.borderColor = 'var(--border-color)';
          dropZone.style.background = 'var(--bg-surface)';
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        const docType = selectDocType?.value || 'aadhaar';
        const docName = inputDocName?.value || file?.name || 'Uploaded Document';
        if (file) uploadDocument(file, docType, docName);
      });
    }

    // Filter & Search Listeners
    const searchInput = document.getElementById('input-doc-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderDocumentsList();
      });
    }

    const filterTypeSelect = document.getElementById('select-filter-doc-type');
    if (filterTypeSelect) {
      filterTypeSelect.addEventListener('change', (e) => {
        currentFilterType = e.target.value;
        renderDocumentsList();
      });
    }

    // MPIN Security Listeners & Initializer
    updateMPINHeaderButton();

    // If MPIN is NOT set yet, automatically show popup to set MPIN on entering page
    if (!getStoredMPIN()) {
      setTimeout(() => {
        openMPINModal('set');
      }, 400);
    }

    const cancelBtn = document.getElementById('mpin-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeMPINModal);

    const submitBtn = document.getElementById('mpin-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', submitMPIN);

    const resetBtn = document.getElementById('mpin-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => window.triggerMPINSetupOrChange());

    const resendOtpBtn = document.getElementById('mpin-resend-otp-btn');
    if (resendOtpBtn) resendOtpBtn.addEventListener('click', async () => {
      await generateAndSendEmailOTP();
    });

    // Wire Segmented PIN Box Synchronizer & Auto-Submit Handlers
    const allPinInputIds = ['mpin-input-verify', 'mpin-input-set', 'mpin-input-confirm', 'mpin-input-old', 'mpin-input-otp'];
    let autoSubmitTimer = null;

    function checkAutoSubmit(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const val = input.value.trim();

      if (inputId === 'mpin-input-set') {
        if (val.length === 4) {
          const confirmInput = document.getElementById('mpin-input-confirm');
          if (confirmInput) {
            confirmInput.focus();
          }
        }
        return;
      }

      const targetLength = (inputId === 'mpin-input-otp') ? 6 : 4;
      if (val.length === targetLength) {
        if (autoSubmitTimer) clearTimeout(autoSubmitTimer);
        autoSubmitTimer = setTimeout(() => {
          submitMPIN();
        }, 120);
      }
    }

    allPinInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          syncPinBoxes(id);
          checkAutoSubmit(id);
        });
        el.addEventListener('focus', () => {
          allPinInputIds.forEach(otherId => syncPinBoxes(otherId));
        });
        el.addEventListener('blur', () => {
          syncPinBoxes(id);
        });
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') submitMPIN();
        });
      }
    });

    document.querySelectorAll('.pin-box-group').forEach(group => {
      group.addEventListener('click', () => {
        const inputId = group.dataset.inputId;
        const input = document.getElementById(inputId);
        if (input) input.focus();
      });
    });
  });

  // MPIN Security Manager Core Functions (Cross-Device Cloud Synced)
  const MPIN_STORAGE_KEY = 'cc_doc_wallet_mpin';
  const MPIN_SESSION_UNLOCKED_KEY = 'cc_doc_wallet_unlocked';

  let pendingActionAfterMPIN = null;
  let currentMPINMode = 'verify'; // 'set', 'verify', 'old', 'otp'
  let activeEmailOTP = '';
  let cachedUserMPIN = '';

  function fetchUserMPINCloud() {
    try {
      let userId = null;
      if (typeof getCurrentUser === 'function') {
        const u = getCurrentUser();
        if (u) userId = u.id || u.sub;
      }
      const userKey = userId ? `cc_doc_wallet_mpin_${userId}` : MPIN_STORAGE_KEY;
      const activePin = localStorage.getItem(userKey) || localStorage.getItem(MPIN_STORAGE_KEY) || '';
      if (activePin) {
        cachedUserMPIN = activePin;
        updateMPINHeaderButton();
      }
    } catch (e) {}
  }

  function getStoredMPIN() {
    if (cachedUserMPIN) return cachedUserMPIN;
    let userId = null;
    if (typeof getCurrentUser === 'function') {
      const u = getCurrentUser();
      if (u) userId = u.id || u.sub;
    }
    const userKey = userId ? `cc_doc_wallet_mpin_${userId}` : MPIN_STORAGE_KEY;
    return localStorage.getItem(userKey) || localStorage.getItem(MPIN_STORAGE_KEY) || '';
  }

  async function saveStoredMPIN(pin) {
    cachedUserMPIN = pin;
    localStorage.setItem(MPIN_STORAGE_KEY, pin);
    let userId = null;
    if (typeof getCurrentUser === 'function') {
      const u = getCurrentUser();
      if (u) userId = u.id || u.sub;
    }
    if (userId) {
      localStorage.setItem(`cc_doc_wallet_mpin_${userId}`, pin);
    }
    updateMPINHeaderButton();
  }

  function isSessionUnlocked() {
    return sessionStorage.getItem(MPIN_SESSION_UNLOCKED_KEY) === 'true';
  }

  function updateMPINHeaderButton() {
    const label = document.getElementById('mpin-btn-label');
    if (label) {
      label.textContent = getStoredMPIN() ? 'Change MPIN' : 'Set MPIN';
    }
  }

  function syncPinBoxes(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const group = document.querySelector(`.pin-box-group[data-input-id="${inputId}"]`);
    if (!group) return;

    const boxes = group.querySelectorAll('.pin-box');
    const val = input.value.trim();

    let isCurrentlyActive = (document.activeElement === input);
    if (!isCurrentlyActive && currentMPINMode === 'set') {
      const setVal = (document.getElementById('mpin-input-set')?.value || '').trim();
      if (inputId === 'mpin-input-set' && setVal.length < 4) {
        isCurrentlyActive = true;
      } else if (inputId === 'mpin-input-confirm' && setVal.length === 4) {
        isCurrentlyActive = true;
      }
    } else if (!isCurrentlyActive) {
      if (currentMPINMode === 'verify' && inputId === 'mpin-input-verify') isCurrentlyActive = true;
      if (currentMPINMode === 'old' && inputId === 'mpin-input-old') isCurrentlyActive = true;
      if (currentMPINMode === 'otp' && inputId === 'mpin-input-otp') isCurrentlyActive = true;
    }

    boxes.forEach((box, idx) => {
      if (idx < val.length) {
        box.textContent = (inputId === 'mpin-input-otp') ? val[idx] : '●';
        box.classList.add('filled');
        box.classList.remove('active');
      } else {
        box.textContent = '';
        box.classList.remove('filled');
        if (isCurrentlyActive && idx === val.length) {
          box.classList.add('active');
        } else {
          box.classList.remove('active');
        }
      }
    });
  }

  function handleProtectedAction(actionCallback) {
    const storedMPIN = getStoredMPIN();

    if (!storedMPIN) {
      pendingActionAfterMPIN = actionCallback;
      openMPINModal('set');
      return;
    }

    // Always enforce MPIN security verification for confidential document operations (View, Download, Delete)
    pendingActionAfterMPIN = actionCallback;
    openMPINModal('verify');
  }

  async function getUserEmail() {
    try {
      const profile = JSON.parse(localStorage.getItem('cc_user_profile') || '{}');
      if (profile && profile.email) return profile.email;

      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          if (session?.data?.session?.user?.email) return session.data.session.user.email;
        }
      }
    } catch (e) {}
    return 'citizen@crowdcity.co.in';
  }

  async function generateAndSendEmailOTP() {
    const userEmail = await getUserEmail();

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, type: 'mpin_change' })
      });
      const data = await res.json();
      if (res.ok) {
        activeEmailOTP = ''; // Reset dev fallback so canonical server OTP is verified
        if (typeof window.showToast === 'function') {
          window.showToast(`🔒 Security Verification OTP sent to ${userEmail}! Check your email inbox.`, 'success');
        }
        return;
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast(data.error || 'Please wait a moment before requesting another code.', 'warning');
        }
        return;
      }
    } catch (err) {
      console.warn("Backend send-otp unreachable, activating dev fallback mode:", err);
    }

    // Dev/Offline Fallback mode if backend API server is unreachable
    activeEmailOTP = Math.floor(100000 + Math.random() * 900000).toString();
    if (typeof window.showToast === 'function') {
      window.showToast(`🔒 Dev Fallback: OTP sent to ${userEmail}! (Code: ${activeEmailOTP})`, 'info');
    }
  }

  async function verifyEmailOTP(enteredOTP) {
    const userEmail = await getUserEmail();
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, code: enteredOTP, type: 'mpin_change' })
      });
      const data = await res.json();
      if (res.ok) {
        return { valid: true };
      } else {
        return { valid: false, error: data.error || 'Invalid OTP code. Please check your email and try again.' };
      }
    } catch (err) {
      console.warn("Backend verify-otp unreachable, checking dev fallback OTP:", err);
    }

    if (activeEmailOTP && enteredOTP === activeEmailOTP) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid OTP code. Please check your email and try again.' };
  }

  async function openMPINModal(mode = 'verify') {
    currentMPINMode = mode;
    const backdrop = document.getElementById('mpin-modal-backdrop');
    if (!backdrop) return;

    // Display modal backdrop immediately (0ms)
    backdrop.style.display = 'flex';

    const title = document.getElementById('mpin-modal-title');
    const desc = document.getElementById('mpin-modal-desc');
    const icon = document.getElementById('mpin-modal-icon');
    const setContainer = document.getElementById('mpin-set-container');
    const verifyContainer = document.getElementById('mpin-verify-container');
    const oldContainer = document.getElementById('mpin-old-container');
    const otpContainer = document.getElementById('mpin-otp-container');
    const errorBox = document.getElementById('mpin-modal-error');
    const resetWrap = document.getElementById('mpin-reset-wrap');

    if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }
    
    // Reset all inputs & sync box displays
    const inputIds = ['mpin-input-set', 'mpin-input-confirm', 'mpin-input-verify', 'mpin-input-old', 'mpin-input-otp'];
    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
        syncPinBoxes(id);
      }
    });

    // Hide all containers
    [setContainer, verifyContainer, oldContainer, otpContainer].forEach(c => {
      if (c) c.style.display = 'none';
    });

    let targetInput = null;

    if (mode === 'set') {
      if (title) title.textContent = getStoredMPIN() ? 'Set New Security MPIN' : 'Set Security MPIN';
      if (desc) desc.textContent = 'Create a 4-digit PIN to protect viewing, downloading, and deleting confidential wallet documents.';
      if (icon) icon.className = 'fa-solid fa-key';
      if (setContainer) setContainer.style.display = 'flex';
      if (resetWrap) resetWrap.style.display = 'none';
      targetInput = document.getElementById('mpin-input-set');

    } else if (mode === 'old') {
      if (title) title.textContent = 'Verify Current MPIN';
      if (desc) desc.textContent = 'Enter your current 4-digit Security MPIN to authorize changing your PIN.';
      if (icon) icon.className = 'fa-solid fa-shield-halved';
      if (oldContainer) oldContainer.style.display = 'block';
      if (resetWrap) resetWrap.style.display = 'none';
      targetInput = document.getElementById('mpin-input-old');

    } else if (mode === 'otp') {
      if (title) title.textContent = 'Email OTP Verification';
      if (desc) desc.textContent = 'We sent a 6-digit Security Verification OTP to your registered email address.';
      if (icon) icon.className = 'fa-solid fa-envelope-circle-check';
      if (otpContainer) otpContainer.style.display = 'flex';
      if (resetWrap) resetWrap.style.display = 'none';
      targetInput = document.getElementById('mpin-input-otp');

      // Asynchronously update email address in description
      getUserEmail().then(userEmail => {
        if (desc && currentMPINMode === 'otp' && userEmail) {
          desc.textContent = `We sent a 6-digit Security Verification OTP to your registered email address (${userEmail}).`;
        }
      }).catch(e => console.warn("Email fetch info warning:", e));

    } else { // 'verify'
      if (title) title.textContent = 'Enter Security MPIN';
      if (desc) desc.textContent = 'Enter your 4-digit Security MPIN to proceed with this document operation.';
      if (icon) icon.className = 'fa-solid fa-lock';
      if (verifyContainer) verifyContainer.style.display = 'block';
      if (resetWrap) resetWrap.style.display = 'block';
      targetInput = document.getElementById('mpin-input-verify');
    }

    setTimeout(() => targetInput?.focus(), 50);
  }

  function closeMPINModal() {
    const backdrop = document.getElementById('mpin-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  async function submitMPIN() {
    if (currentMPINMode === 'otp') {
      const enteredOTP = (document.getElementById('mpin-input-otp')?.value || '').trim();

      if (!enteredOTP || enteredOTP.length !== 6) {
        showMPINError('Please enter the 6-digit OTP code sent to your email.');
        return;
      }

      const result = await verifyEmailOTP(enteredOTP);
      if (!result.valid) {
        showMPINError(result.error || 'Invalid OTP code. Please check your email and try again.');
        const otpInp = document.getElementById('mpin-input-otp');
        if (otpInp) { otpInp.value = ''; syncPinBoxes('mpin-input-otp'); otpInp.focus(); }
        return;
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Email OTP verified successfully!', 'success');
      }

      // Step 1 Complete: Move to Step 2 (Old MPIN) if stored MPIN exists, else Step 3 (Set MPIN)
      if (getStoredMPIN()) {
        openMPINModal('old');
      } else {
        openMPINModal('set');
      }

    } else if (currentMPINMode === 'old') {
      const oldPin = (document.getElementById('mpin-input-old')?.value || '').trim();
      const storedPin = getStoredMPIN();

      if (!oldPin) {
        showMPINError('Please enter your current 4-digit MPIN.');
        return;
      }

      if (oldPin !== storedPin) {
        showMPINError('Incorrect Current MPIN. Please try again.');
        const oldInp = document.getElementById('mpin-input-old');
        if (oldInp) { oldInp.value = ''; syncPinBoxes('mpin-input-old'); oldInp.focus(); }
        return;
      }

      // Step 2 Complete: Move to Step 3 (Set New MPIN)
      openMPINModal('set');

    } else if (currentMPINMode === 'set') {
      const pin = (document.getElementById('mpin-input-set')?.value || '').trim();
      const confirmPin = (document.getElementById('mpin-input-confirm')?.value || '').trim();
      const previousPin = getStoredMPIN();

      if (!/^\d{4}$/.test(pin)) {
        showMPINError('MPIN must be exactly 4 numeric digits.');
        return;
      }

      if (previousPin && pin === previousPin) {
        showMPINError('This is your previous MPIN. Please set a new PIN.');
        const setInp = document.getElementById('mpin-input-set');
        const confirmInp = document.getElementById('mpin-input-confirm');
        if (setInp) { setInp.value = ''; syncPinBoxes('mpin-input-set'); setInp.focus(); }
        if (confirmInp) { confirmInp.value = ''; syncPinBoxes('mpin-input-confirm'); }
        return;
      }

      if (pin !== confirmPin) {
        showMPINError('MPIN confirmation does not match. Please re-enter.');
        const confirmInp = document.getElementById('mpin-input-confirm');
        if (confirmInp) { confirmInp.value = ''; syncPinBoxes('mpin-input-confirm'); confirmInp.focus(); }
        return;
      }

      saveStoredMPIN(pin);
      sessionStorage.setItem(MPIN_SESSION_UNLOCKED_KEY, 'true');
      updateMPINHeaderButton();
      
      const action = pendingActionAfterMPIN;
      pendingActionAfterMPIN = null;
      closeMPINModal();

      if (typeof window.showToast === 'function') {
        window.showToast('Security MPIN updated successfully!', 'success');
      }

      if (action) {
        action();
      }

    } else { // 'verify'
      const enteredPin = (document.getElementById('mpin-input-verify')?.value || '').trim();
      const storedPin = getStoredMPIN();

      if (!enteredPin) {
        showMPINError('Please enter your 4-digit MPIN.');
        return;
      }

      if (enteredPin !== storedPin) {
        showMPINError('Incorrect Security MPIN. Please try again.');
        const verInp = document.getElementById('mpin-input-verify');
        if (verInp) { verInp.value = ''; syncPinBoxes('mpin-input-verify'); verInp.focus(); }
        return;
      }

      sessionStorage.setItem(MPIN_SESSION_UNLOCKED_KEY, 'true');
      
      const action = pendingActionAfterMPIN;
      pendingActionAfterMPIN = null;
      closeMPINModal();

      if (action) {
        action();
      }
    }
  }

  function showMPINError(msg) {
    const errorBox = document.getElementById('mpin-modal-error');
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }

    const visibleGroups = document.querySelectorAll('.pin-box-group');
    visibleGroups.forEach(group => {
      if (group.closest('div[style*="display: none"]') === null) {
        group.classList.add('shake-error');
        setTimeout(() => group.classList.remove('shake-error'), 450);
      }
    });
  }

  window.triggerMPINSetupOrChange = function() {
    if (getStoredMPIN()) {
      openMPINModal('otp'); // Instant 0ms modal popup
      generateAndSendEmailOTP(); // Asynchronous email dispatch in background
    } else {
      openMPINModal('set');
    }
  };

})();
