# CrowdCity AI v2.1 - Developer & Architecture Guide

## Overview
CrowdCity AI is an AI-powered Civic Issue Reporting & Government Services Ecosystem built for Tamil Nadu State and Central Government welfare initiatives.

---

## Architectural Principles
1. **Strict Version 1 Non-Breaking Policy**:
   - Version 1 modules (Citizen Complaint Reporting, AI Issue Classification, AI Department Assignment, Live Issue Map, Complaint Tracking, Authority Dashboard, Authentication) remain 100% untouched and isolated.
2. **Version 2 Government Services Module**:
   - Extends government services with 20 modular steps covering Scheme Eligibility Checker, Saved Schemes, Scheme Details, Application Guide, ChatGPT-style AI Government Assistant, Independent Office Locator, Secure Document Wallet, Citizen Services Dashboard, AI Document Verification Assistant, AI Form Filling Assistant, Government Application Tracker, Smart Reminder Center, AI Recommendation Engine, and Government Services Admin Portal.

---

## Technology Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+), FontAwesome 6, Leaflet.js Maps, PWA Service Worker.
- **Backend**: Node.js, Express.js, Groq AI SDK (Llama-3.3-70b-versatile).
- **Database & Auth**: Supabase PostgreSQL, Row Level Security (RLS) policies.
- **Hosting**: Vercel (Frontend Static Client), Render (Node.js API Web Service).

---

## Code Base Organization
```text
/client
  ├── css/ (style.css, components.css, assistant.css)
  ├── js/ (scheme-checker.js, scheme-results.js, scheme-details.js, saved-schemes.js, assistant.js, office-locator.js, my-documents.js, services-dashboard.js, doc-verifier.js, form-assistant.js, app-tracker.js, reminders.js, services-admin.js, command-palette.js)
  ├── services.html, scheme-checker.html, scheme-results.html, scheme-details.html, saved-schemes.html, assistant.html, office-locator.html, my-documents.html, services-dashboard.html, doc-verifier.html, form-assistant.html, app-tracker.html, reminders.html, services-admin.html
  ├── 404.html, 500.html, offline.html

/server
  ├── controllers/ (aiController.js, complaintController.js, authController.js)
  ├── routes/ (aiRoutes.js, complaintRoutes.js, authRoutes.js)
  ├── services/ (groqService.js, recommendationService.js)
  ├── server.js

/supabase
  ├── v2_government_schemes_schema.sql
  ├── v2_government_schemes_seed.sql
  ├── v2_user_documents_schema.sql
  ├── v2_user_applications_schema.sql
  ├── v2_user_reminders_schema.sql
  ├── v2_admin_services_schema.sql
```
