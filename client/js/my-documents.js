// CrowdCity AI v2.0 - My Documents Wallet JavaScript
// Manages document uploads, drag-and-drop, preview modal, deletion, and Supabase integration.

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

  async function fetchUserDocuments() {
    const container = document.getElementById('documents-grid-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; grid-column: 1 / -1;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your secure document wallet...</p>
        </div>
      `;
    }

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            renderEmptyState("Please sign in to access your secure document wallet.");
            return;
          }

          const { data, error } = await client
            .from('user_document_wallet')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            userDocuments = data;
            // Store locally for cross-referencing in scheme details page
            localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(userDocuments));
            renderDocumentsList();
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase document fetch error, using local fallback:", err);
    }

    // LocalStorage Fallback if database table is pending
    try {
      const local = localStorage.getItem('cc_user_uploaded_docs');
      if (local) {
        userDocuments = JSON.parse(local);
        renderDocumentsList();
        return;
      }
    } catch (e) {}

    renderEmptyState("You haven't uploaded any documents to your wallet yet. Upload your Aadhaar, Ration Card, or Income Certificate to prepare for government scheme applications.");
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
      filtered = filtered.filter(d => d.doc_name.toLowerCase().includes(currentSearchQuery) || d.doc_type.toLowerCase().includes(currentSearchQuery));
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
      const sizeStr = doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : 'PDF Document';

      return `
        <div class="doc-wallet-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 6px 20px rgba(0,0,0,0.03);">
          
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary);">
                Available
              </span>

              <button type="button" class="btn-delete-doc" data-id="${doc.id}" title="Delete Document" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(99, 102, 241, 0.12); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                <i class="fa-solid fa-file-pdf"></i>
              </div>
              <div>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.15rem 0; line-height: 1.2;">${doc.doc_name}</h4>
                <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">${typeInfo.name}</span>
              </div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem; margin-bottom: 1rem;">
              <span><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
              <span><i class="fa-regular fa-file"></i> ${sizeStr}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
            <a href="${doc.file_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex: 1; padding: 0.5rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px; text-decoration: none; text-align: center;">
              <i class="fa-solid fa-eye"></i> View
            </a>
            <a href="${doc.file_url}" download="${doc.doc_name}" class="btn btn-secondary" style="flex: 1; padding: 0.5rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px; text-decoration: none; text-align: center;">
              <i class="fa-solid fa-download"></i> Download
            </a>
          </div>

        </div>
      `;
    }).join('');

    // Attach Delete Listeners
    container.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.id;
        await deleteDocument(docId);
      });
    });
  }

  async function uploadDocument(file, docType, docName) {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (window.showToast) window.showToast("File size exceeds 5MB limit. Please upload a smaller PDF or image file.", "error");
      return;
    }

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            if (window.showToast) window.showToast("Please sign in to save documents to your account.", "info");
            return;
          }

          // Create base64 URL or Object URL for secure client viewing
          const reader = new FileReader();
          reader.onload = async (e) => {
            const fileUrl = e.target.result;
            const newDoc = {
              user_id: userId,
              doc_type: docType,
              doc_name: docName || file.name,
              file_url: fileUrl,
              file_size: file.size,
              file_format: file.type || 'pdf'
            };

            const { data, error } = await client.from('user_document_wallet').upsert(newDoc).select();

            if (!error && data) {
              if (window.showToast) window.showToast("Document securely uploaded to your wallet!", "success");
              fetchUserDocuments();
            } else {
              saveDocToLocalFallback(newDoc);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    } catch (e) {
      console.warn("Database upload fallback:", e);
    }

    // Fallback if offline
    const reader = new FileReader();
    reader.onload = (e) => {
      const newDoc = {
        id: 'local_' + Date.now(),
        doc_type: docType,
        doc_name: docName || file.name,
        file_url: e.target.result,
        file_size: file.size,
        created_at: new Date().toISOString()
      };
      saveDocToLocalFallback(newDoc);
    };
    reader.readAsDataURL(file);
  }

  function saveDocToLocalFallback(newDoc) {
    userDocuments.unshift(newDoc);
    localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(userDocuments));
    if (window.showToast) window.showToast("Document saved to your local wallet!", "success");
    renderDocumentsList();
  }

  async function deleteDocument(docId) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_document_wallet').delete().eq('id', docId);
        }
      }
    } catch (e) {}

    userDocuments = userDocuments.filter(d => d.id !== docId);
    localStorage.setItem('cc_user_uploaded_docs', JSON.stringify(userDocuments));
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
  });

})();
