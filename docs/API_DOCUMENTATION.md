# CrowdCity AI v2.1 - API Documentation

## AI Service Endpoints

### 1. `POST /api/ai/explain-scheme`
* **Description**: Generates citizen-friendly plain English/Tamil qualification explanations for a government scheme.
* **Payload**:
  ```json
  {
    "scheme": { "scheme_name": "Kalaignar Magalir Urimai Thittam", "benefits": "..." },
    "userProfile": { "age": 25, "income": 120000, "district": "Chennai" },
    "lang": "en"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "explanation": {
      "whyQualify": "Based on your age of 25 and annual income...",
      "mainBenefits": "...",
      "requiredDocuments": "...",
      "importantNotes": "..."
    }
  }
  ```

---

### 2. `POST /api/ai/assistant-chat`
* **Description**: Conversational Q&A endpoint for the ChatGPT-style AI Government Assistant.
* **Payload**:
  ```json
  {
    "messages": [{ "sender": "user", "text": "What are the documents needed for Pudhumai Penn?" }],
    "userProfile": {},
    "schemeKnowledge": []
  }
  ```

---

### 3. `POST /api/ai/verify-document`
* **Description**: Evaluates uploaded certificate image/PDF metadata and extracted text for clarity, resolution, uncropped borders, and OCR summary.
* **Payload**:
  ```json
  {
    "docMeta": { "doc_name": "Smart Ration Card", "file_size": 102400 },
    "extractedText": "Sample text..."
  }
  ```

---

### 4. `POST /api/ai/form-guidance`
* **Description**: Returns field-by-field guidance, why required, common mistakes, and example values for government application forms.

---

### 5. `POST /api/ai/recommendations`
* **Description**: Proactive Recommendation Engine endpoint for tailored scheme matches, document readiness alerts, and deadline reminders.
