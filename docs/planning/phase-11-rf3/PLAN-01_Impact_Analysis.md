# [PLAN-01] RF3 IMPACT ANALYSIS

## Context
RF3 transforms the Dashboard from a view-only surface into a "Command Surface" by enabling actionable routing between modules. This analysis evaluates the impact of adding navigation triggers to existing operational components.

## Affected Modules
- **Dashboard.jsx**: Primary source of command triggers.
- **Customers.jsx**: Primary destination for detailed customer lists.
- **ActionCenter.jsx**: Primary destination for task-based interventions.
- **LeadPipeline.jsx**: Destination for strategic prospect management.
- **TreeExplorer.jsx**: Core context provider (needs URL sync).

## UI Areas & Behavior Changes
| UI Area | Change Type | New Behavior |
| :--- | :--- | :--- |
| MoM Territory Table | Additive | Rows/Metrics become clickable links to filtered Customer List. |
| Lifecycle Cards | Additive | Cards become clickable triggers to view specific segments in Customers module. |
| Strategic Insights | Additive | Bullet points gain inline links to relevant operational modules. |
| TreeExplorer Filter | Modification | Selection is persisted in URL query params (`node_code`). |

## Blast Radius & Risks
- **Blast Radius**: LOW. Changes are localized to `onClick` handlers and `useSearchParams` logic.
- **Preservation Risks**: 
    - *Risk*: Users might accidentally click when trying to read. 
    - *Mitigation*: Use subtle hover effects (cursor-pointer, slight underline) instead of giant buttons.
- **Operational Familiarity Risks**: 
    - *Risk*: Transforming text into links might change the "feel" of the table. 
    - *Mitigation*: Maintain current typography. Avoid standard blue link colors; use context-aware styling.

## Summary (Operational Language)
RF3 makes the numbers on the dashboard "clickable". If a manager sees a unit performing poorly or a sudden spike in churn, they can click that number to see the exact list of customers and assign tasks immediately, without having to manually search in other menus.
