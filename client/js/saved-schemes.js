// CrowdCity AI v2.0 - My Saved Schemes JavaScript
// Queries saved_schemes table for the logged-in user with save/remove capability

(function() {
  'use strict';

  let savedSchemesData = [];

  async function fetchSavedSchemes() {
    const container = document.getElementById('saved-schemes-list');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your bookmarked schemes...</p>
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
            renderEmptyState("Please sign in to view and manage your saved government schemes.");
            return;
          }

          // Query saved_schemes joined with government_schemes
          const { data, error } = await client
            .from('saved_schemes')
            .select('id, saved_at, government_schemes(*)')
            .eq('user_id', userId)
            .order('saved_at', { ascending: false });

          if (!error && data) {
            savedSchemesData = data.map(item => ({
              bookmarkId: item.id,
              savedAt: item.saved_at,
              ...item.government_schemes
            })).filter(item => item.scheme_name || item.name);

            renderSavedSchemes(savedSchemesData);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Saved schemes database query error:", err);
    }

    // Fallback if offline or demo user
    renderEmptyState("You haven't saved any government schemes yet. Browse eligible schemes and click 'Save Scheme' to bookmark them here.");
  }

  function renderEmptyState(message) {
    const container = document.getElementById('saved-schemes-list');
    const countElem = document.getElementById('saved-count-number');
    if (countElem) countElem.textContent = '0';

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-regular fa-bookmark" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Saved Schemes</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <a href="scheme-checker.html" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-award"></i> <span>Check Eligible Schemes</span>
        </a>
      </div>
    `;
  }

  function renderSavedSchemes(schemes) {
    const container = document.getElementById('saved-schemes-list');
    const countElem = document.getElementById('saved-count-number');
    if (countElem) countElem.textContent = schemes.length;

    if (!container) return;

    if (schemes.length === 0) {
      renderEmptyState("You haven't saved any government schemes yet. Browse eligible schemes and click 'Save Scheme' to bookmark them here.");
      return;
    }

    container.innerHTML = schemes.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const docs = Array.isArray(scheme.required_documents) 
        ? scheme.required_documents 
        : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

      return `
        <div class="saved-scheme-card" data-bookmark-id="${scheme.bookmarkId}" data-scheme-id="${scheme.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: ${isState ? 'rgba(13, 148, 136, 0.12)' : 'rgba(99, 102, 241, 0.12)'}; color: ${isState ? 'var(--primary)' : '#6366f1'}; display: inline-block; margin-bottom: 0.35rem;">
                ${isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme'}
              </span>
              <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${scheme.scheme_name || scheme.name}</h3>
            </div>
            
            <button type="button" class="btn-remove-saved" data-bookmark-id="${scheme.bookmarkId}" data-scheme-id="${scheme.id}" title="Remove from bookmarks" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </p>

          <p style="font-size: 0.92rem; color: var(--text-main); line-height: 1.6; margin: 0 0 1.25rem 0;">
            ${scheme.short_description || scheme.description || 'Government welfare program.'}
          </p>

          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">
              Benefits Summary
            </div>
            <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600;">
              ${scheme.benefits_summary || scheme.benefits || 'Government financial support and benefits.'}
            </div>
          </div>

          ${docs.length > 0 ? `
            <div style="margin-bottom: 1.25rem;">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">Document Checklist:</div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${docs.map(doc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: 6px; color: var(--text-main);">${doc}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.85rem; align-items: center; justify-content: flex-end; border-top: 1px dashed var(--border-color); padding-top: 1.25rem;">
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.65rem 1.3rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
              <span>Apply on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach Remove Button Listeners
    document.querySelectorAll('.btn-remove-saved').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookmarkId = btn.dataset.bookmarkId;
        const schemeId = btn.dataset.schemeId;
        await removeSavedScheme(bookmarkId, schemeId, btn);
      });
    });
  }

  async function removeSavedScheme(bookmarkId, schemeId, buttonElem) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (userId) {
            let query = client.from('saved_schemes').delete();
            if (bookmarkId) query = query.eq('id', bookmarkId);
            else if (schemeId) query = query.eq('user_id', userId).eq('scheme_id', schemeId);

            const { error } = await query;
            if (!error) {
              if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
            }
          }
        }
      }
    } catch (err) {
      console.warn("Remove bookmark error:", err);
    }

    // Animate removal from DOM
    const card = buttonElem.closest('.saved-scheme-card');
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => {
        card.remove();
        savedSchemesData = savedSchemesData.filter(s => s.bookmarkId !== bookmarkId && s.id !== schemeId);
        renderSavedSchemes(savedSchemesData);
      }, 300);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetchSavedSchemes();
  });

})();
