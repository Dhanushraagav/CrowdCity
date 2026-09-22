# CrowdCity AI — Civic Issue Priority Score Specification

## 1. Objective
The **Civic Issue Priority Score** is an authoritative, deterministic mathematical rating system designed for CrowdCity municipal authorities. It calculates the objective urgency of reported civic complaints to optimize dispatch workflows, resource allocation, and emergency escalations.

The score operates as a backend data-driven intelligence layer. It strictly complements—and does not replace—the existing SLA timelines, duplicate detection, or 4-tier location hierarchy.

---

## 2. Mathematical Formula
The final priority score \(P\) is computed using a weighted linear combination of five normalized civic factors:

\[
P = (0.30 \times S) + (0.25 \times A) + (0.20 \times R) + (0.15 \times D) + (0.10 \times U)
\]

### Clamping Bounds
Every individual factor is normalized to the domain \([0, 100]\). The resulting score \(P\) is mathematically guaranteed to remain within:
\[
0 \le P \le 100
\]
Precision is retained internally in database records (`NUMERIC(5, 2)`), while frontends present rounded values with single-decimal precision (e.g. `68.4`).

---

## 3. Variables
The five variables represent distinct dimensions of civic urgency:

| Variable | Name | Description |
| :--- | :--- | :--- |
| **\(S\)** | **Severity Score** | Threat level to public safety and infrastructure integrity based on category and emergency triage. |
| **\(A\)** | **Affected Citizens Score** | Scale of citizen impact, consolidated from duplicate community reports linked to a master complaint. |
| **\(R\)** | **Recurrence Score** | Historical frequency of identical or related civic failures in the same geographic radius within 30 days. |
| **\(D\)** | **Duration Score** | Elapsed unresolved time dynamically mapped against the authoritative SLA deadline. |
| **\(U\)** | **Public Location Importance** | Strategic infrastructure tier of the incident site (e.g. hospital, school, arterial road, residential zone). |

---

## 4. Normalization Rules

All normalization curves and parameters are centralized in `server/config/civicPriorityConfig.js`.

### Factor 1 — Severity (\(S\))
Uses existing complaint category severity and emergency status:
- **CRITICAL / Emergency**: \(100\)
- **HIGH**: \(75\)
- **MEDIUM (Default)**: \(50\)
- **LOW**: \(25\)

*Missing severity defaults safely to \(50\) (MEDIUM) and is never silently assumed to be critical.*

### Factor 2 — Affected Citizens (\(A\))
Consolidated community reports linked to a master issue increase the affected score using a capped linear normalization against a configured reference count (\(25\)):
\[
A = \min\left(100, \frac{100 \times \text{citizen\_count}}{25}\right)
\]
- \(1\) reporting citizen \(\rightarrow A = 4\)
- \(5\) citizens \(\rightarrow A = 20\)
- \(10\) citizens \(\rightarrow A = 40\)
- \(25+\) citizens \(\rightarrow A = 100\) (capped)

### Factor 3 — Recurrence (\(R\))
Evaluates the number of complaints in the same category within a 250m radius over a 30-day window:
\[
R = \min\left(100, \frac{100 \times \text{recurrence\_count}}{5}\right)
\]
- \(0\) historical recurrences \(\rightarrow R = 0\)
- \(1\) recurrence \(\rightarrow R = 20\)
- \(3\) recurrences \(\rightarrow R = 60\)
- \(5+\) recurrences \(\rightarrow R = 100\) (capped)

### Factor 4 — Duration (\(D\))
Evaluates unresolved duration against the authoritative SLA deadline:
- **Resolved / Closed**: \(D = 0\)
- **Within SLA**: Scales smoothly from \(0\) up to \(75\) at the exact deadline:
  \[
  D = \left(\frac{\text{elapsed\_hours}}{\text{sla\_deadline\_hours}}\right) \times 75
  \]
- **Overdue**: Scales from \(75\) up to \(100\) over the configured escalation window:
  \[
  D = 75 + \min\left(25, 25 \times \frac{\text{overdue\_hours}}{\text{escalation\_hours}}\right)
  \]

### Factor 5 — Public Location Importance (\(U\))
Configurable infrastructure tier values (metadata-driven with a safe default of \(50\)):
- `EMERGENCY_SERVICE` / `HOSPITAL`: \(100\)
- `SCHOOL` / `TRANSPORT_HUB`: \(90\)
- `PUBLIC_ROAD`: \(70\)
- `RESIDENTIAL` (Default): \(50\)
- `GENERAL_AREA`: \(40\)

---

## 5. Centralized Weights Configuration
Weights are declared in `server/config/civicPriorityConfig.js` and validated at startup and test time via `validateWeights()`:

```javascript
weights: {
  severity: 0.30,           // 30%
  affected: 0.25,           // 25%
  recurrence: 0.20,         // 20%
  duration: 0.15,           // 15%
  public_importance: 0.10   // 10%
}
// Sum = 1.00 (Strictly enforced)
```

---

## 6. Priority Level Thresholds

Scores are classified into four authoritative operational tiers:

| Priority Level | Score Range | Operational Meaning | Suggested Action |
| :--- | :--- | :--- | :--- |
| **LOW** | \(0.00 - 24.99\) | Minor routine issue | Routine maintenance queue |
| **MODERATE** | \(25.00 - 49.99\) | Standard municipal maintenance | Regular departmental dispatch |
| **HIGH** | \(50.00 - 74.99\) | Severe issue or multi-citizen impact | Expedited field inspector assignment |
| **CRITICAL** | \(75.00 - 100.00\) | Life safety risk, emergency, or major outage | Immediate emergency dispatch |

---

## 7. Duplicate & Master Complaint Integration
When multiple citizens submit reports for the same civic issue:
1. CrowdCity's multi-signal engine identifies candidates using geographic proximity (Haversine), category matching, and text similarity.
2. Supporting citizen reports are attached to `issue_supporting_reports` with foreign key reference to `issues.id`.
3. The master complaint's `citizen_count` increments monotonically.
4. **The priority engine immediately recalculates the master complaint's priority score**, dynamically reflecting the broader community impact without creating fragmented duplicate casework.

---

## 8. Example Calculations

### Example 1: Critical Emergency Pipeline Burst
- Emergency Water Pipeline Burst near Government Hospital
- Severity: Emergency \(\rightarrow S = 100\)
- Affected: 30 citizens consolidated \(\rightarrow A = 100\)
- Recurrence: 2 previous leaks in window \(\rightarrow R = 40\)
- Duration: 2h into 4h emergency SLA \(\rightarrow D = 37.5\)
- Location Importance: Hospital \(\rightarrow U = 100\)

\[
P = (100 \times 0.30) + (100 \times 0.25) + (40 \times 0.20) + (37.5 \times 0.15) + (100 \times 0.10)
\]
\[
P = 30.0 + 25.0 + 8.0 + 5.625 + 10.0 = 78.63 \rightarrow \mathbf{78.6\ (\text{CRITICAL})}
\]

### Example 2: Routine Pothole in Residential Colony
- Fresh single report of road crack in Kannampalayam
- Severity: Low \(\rightarrow S = 25\)
- Affected: 1 citizen \(\rightarrow A = 4\)
- Recurrence: First occurrence \(\rightarrow R = 0\)
- Duration: 1h into 168h SLA \(\rightarrow D = 0.45\)
- Location Importance: Residential \(\rightarrow U = 50\)

\[
P = (25 \times 0.30) + (4 \times 0.25) + (0 \times 0.20) + (0.45 \times 0.15) + (50 \times 0.10)
\]
\[
P = 7.5 + 1.0 + 0.0 + 0.07 + 5.0 = 13.57 \rightarrow \mathbf{13.6\ (\text{LOW})}
\]

### Example 3: Overdue Road Hazard near Arterial Junction
- Unresolved pothole reported by 15 citizens, approaching overdue
- Severity: High \(\rightarrow S = 75\)
- Affected: 15 citizens \(\rightarrow A = 60\)
- Recurrence: 2 previous potholes \(\rightarrow R = 40\)
- Duration: At SLA deadline (24h) \(\rightarrow D = 75\)
- Location Importance: Public Road \(\rightarrow U = 70\)

\[
P = (75 \times 0.30) + (60 \times 0.25) + (40 \times 0.20) + (75 \times 0.15) + (70 \times 0.10)
\]
\[
P = 22.5 + 15.0 + 8.0 + 11.25 + 7.0 = 63.75 \rightarrow \mathbf{63.8\ (\text{HIGH})}
\]

---

## 9. Limitations
1. **Mathematical, Not Predictive**: The score quantifies current observable urgency; it does not forecast hypothetical future landslides, floods, or traffic jams.
2. **Metadata Dependency**: Location importance relies on explicit infrastructure flags or fallback defaults; arbitrary text strings are never guessed.
3. **SLA Independence**: Priority score informs urgency ranking; SLA remains the contractual legal deadline for municipal response.

---

## 10. Model Versioning & Auditability
Every calculation attaches:
- `priority_model_version`: Current version is `'v1'`.
- `priority_calculated_at`: ISO 8601 UTC timestamp of score generation.
- `priority_factors`: Audit record of exact inputs used:
  ```json
  {
    "severity": 75,
    "affected": 60,
    "recurrence": 40,
    "duration": 75,
    "public_importance": 70
  }
  ```

---

## 11. API & Data Behavior

### Endpoints
- `POST /api/issues`: Calculates score server-side upon creation; strips any client-provided scores.
- `POST /api/issues/:id/support`: Automatically increments `citizen_count` and updates master priority score.
- `PATCH /api/issues/:id/status`: Recalculates duration and priority on lifecycle transition.
- `GET /api/issues`: Returns `priority_score` and `priority_level` for all users; restricts `priority_factors` to authority and admin roles.
- `GET /api/issues/:id`: Exposes full factor breakdown to authority accounts for explainability.
