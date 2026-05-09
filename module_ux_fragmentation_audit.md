# Module UX Fragmentation Audit

## 1. Inconsistent Module UX

- **Card Styles**:
  - `Dashboard`: Uses gradient backgrounds and large icons.
  - `ActionCenter`: Uses white backgrounds with subtle borders.
  - `Customers`: Uses a mix of flat cards and lifecycle-colored badges.
- **Table Implementations**: Different sorting icons, row padding, and header styles across `Dashboard`, `ActionCenter`, and `Customers`.
- **Modals**: `CustomerHistoryModal`, `PotentialTransactionModal`, and `AssignModal` have different layouts and visual weights.

## 2. Duplicated Module Responsibilities

- **Reporting**: Both `Dashboard` (via AIAssistantInsights) and `ActionCenter` (via Task list) provide "insights" on what needs to be done.
- **Filtering**: Date and Hierarchy filters are re-implemented and styled differently in every module.

## 3. Severity Inconsistency

- **Color Semantics**:
  - "At Risk" is sometimes Orange (`Dashboard`), sometimes Red (`EliteMorningPulse`).
  - "Success/Active" is sometimes Blue (`Dashboard`), sometimes Green (`Customers`).
- **Iconography**: Different Lucide icons used for the same concept (e.g., `AlertCircle` vs `AlertTriangle` for risk).

## 4. Recommendations

- **Design System Standardization**: Define a unified set of UI tokens (Colors, Gradients, Shadows) and atomic components (GovernedCard, GovernedBadge, GovernedTable).
- **Unified Filter Bar**: Create a single, shared `CommandFilterBar` component that handles Hierarchy and Date selection across all modules.
- **Severity-First Theme**: Enforce consistent color mappings:
  - **CRITICAL**: Red / High Contrast
  - **DEGRADED/WARNING**: Orange
  - **WATCHLIST**: Amber/Yellow
  - **NORMAL/HEALTHY**: Blue/Green
- **Component Consolidation**: Merge redundant "Insights" components into a single "Executive Insight Engine" UI component.
