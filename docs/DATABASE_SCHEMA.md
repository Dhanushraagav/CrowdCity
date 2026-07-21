# CrowdCity AI v2.1 - Database Schema Documentation

## Database Tables Overview

### 1. `government_schemes` & `scheme_categories`
* **Purpose**: Stores Tamil Nadu State and Central Government welfare schemes, eligibility limits, benefits, and required documents.
* **Migration Script**: `supabase/v2_government_schemes_schema.sql` & `v2_government_schemes_seed.sql`.

### 2. `saved_schemes`
* **Purpose**: Stores citizen scheme bookmarks linked to `profiles(id)`.

### 3. `user_document_wallet`
* **Purpose**: Secure document wallet metadata (Aadhaar, Ration Card, Income Cert, Bank Passbook).
* **Migration Script**: `supabase/v2_user_documents_schema.sql`.

### 4. `user_scheme_applications`
* **Purpose**: Personal application tracking records, statuses, submission dates, reference numbers, and notes.
* **Migration Script**: `supabase/v2_user_applications_schema.sql`.

### 5. `user_reminders`
* **Purpose**: Smart reminders for document renewals, office appointments, and scheme registration deadlines.
* **Migration Script**: `supabase/v2_user_reminders_schema.sql`.

### 6. `v2_scheme_announcements` & `v2_scheme_faqs`
* **Purpose**: Admin portal announcements broadcasted to citizens and FAQs consumed by AI Government Assistant.
* **Migration Script**: `supabase/v2_admin_services_schema.sql`.
