# Frontend Governance Violations Audit

## 1. Frontend Business Logic (CRITICAL)

### KPI Calculations
- **File**: `Dashboard.jsx` (Lines 65-80)
- **Violation**: Calculates `revGrowth`, `arpuChange`, and `revChange` locally.
- **Risk**: Divergence from backend "Single Source of Truth".

### Business State Inference
- **File**: `Dashboard.jsx` (Lines 85-88, 776-781)
- **Violation**: `AIAssistantInsights` and `getQuadrant` define what is "positive", "negative", or a "Star/Cow/Prospect" based on frontend constants.
- **Risk**: Business rules are fragmented between frontend and backend.

### Task Flow Classification
- **File**: `Customers.jsx` (Lines 71-83)
- **Violation**: `getTaskFlow` decides if a customer is "Giao Lead", "Giao Cảnh báo", or "Giao VIP" based on local `nhom_kh` checks.
- **Risk**: Inconsistent escalation logic if backend rules change.

## 2. Thresholds & Constants

- **Dashboard**: `COLORS` array and severity thresholds (`revGrowth < -5` for negative) are hardcoded in the component.
- **Customers**: RFM segments and lifecycle status mappings are managed locally in `lifecycleConfig`.

## 3. Duplicated Severity Logic

- `Dashboard.jsx` uses its own logic for "System Health".
- `ActionCenter.jsx` uses its own `StatusBadge` and `FlowBadge` logic.
- `Customers.jsx` uses `getRankBadge` and local gradient mappings.

## 4. Recommendations

- **Purge local business logic**: All growth, status, and classification logic must be moved to the backend Engines.
- **Governed Payload Rendering**: Frontend should only check `status` or `severity` fields provided by the API (e.g., `item.severity === 'HIGH'`).
- **Unified Metadata**: Configuration for colors, icons, and labels should ideally come from a central governance registry or a shared constant file that matches backend definitions.
