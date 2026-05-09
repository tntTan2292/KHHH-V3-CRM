# RF2 Operational Preservation Plan

## Goal
To ensure that the Phase 11 Executive Dashboard refactor remains an **additive** improvement and does not disrupt the existing operational visibility and user mental models.

## Operational Areas to Preserve
- **Lifecycle Stats**: The 5 core cards (ACTIVE, NEW, RECOVERED, AT_RISK, CHURNED) must remain at the top as the primary operational pulse.
- **Revenue Identity**: The primary Revenue Area Chart must remain the centerpiece of the dashboard, showing historical trends and current performance.
- **Service & Regional Structure**: The pie and bar charts for service and regional breakdown must be preserved to maintain familiarity in revenue composition analysis.
- **Customer Identity**: Search and filtering for specific customer segments must remain easily accessible.

## Dashboard Ownership Boundaries
- **Dashboard.jsx** is and remains the **Primary Operational Dashboard**.
- Ownership of the root layout, visual hierarchy, and core data flow belongs to the **Operational Layer**.
- The Executive Layer is a **tenant** within this layout, not the landlord.

## User Mental Model Preservation
- **Familiar Start**: When a user logs in, they should see the same numbers and charts they are accustomed to in the same locations.
- **Evolutionary UX**: Changes should feel like "added intelligence" (e.g., status badges, tooltips, or augmentation bars) rather than a redesigned workspace.
- **Low Cognitive Migration**: No retraining should be required for basic CRM operations.

## Operational Familiarity Constraints
- No removal of existing charts or metrics.
- No forced navigation change (e.g., forcing a dashboard selection before seeing data).
- The "Executive Shell" should wrap the existing experience without hiding it.
