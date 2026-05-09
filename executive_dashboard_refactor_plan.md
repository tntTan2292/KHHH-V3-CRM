# Executive Dashboard Refactor Plan (RF2+)

## 1. Goal: Enterprise Operational Command Center

Transition from a data-heavy dashboard to a severity-driven Command Center that directs executive attention to critical areas.

## 2. RF2+ Refactor Direction

### Backend Integration (Governed Payloads)
- Switch all dashboard data fetching to `api/executive/command-center`.
- Use the `EXEC_COMMAND_V1` payload as the single source of truth for the dashboard view.

### Attention Flow (Severity-Driven)
- **Primary Section**: Operational Health & Risk (The "Vitals").
- **Secondary Section**: Situation Room (Current Concerns & Anomalies).
- **Tertiary Section**: Momentum & Foresight (Trends & Forecasts).
- Use `executive_status` to determine the global dashboard "alert level".

### Dashboard Restructuring
- **Top Bar**: Global Hierarchy Navigation + Executive Status Indicator.
- **Hero Section**: Unified "Executive Summary" card based on `governance_metadata`.
- **Drilldown Panels**: Clicking a unit in the hierarchy snapshot should transition the entire dashboard context to that unit.

## 3. Hierarchy Drilldown Proposal

- Implement a "Hierarchy-First" navigation model where the organizational context is selected *before* viewing module data.
- Standardize the `navStack` as a global application state.
- Ensure all modules (Customers, Action Center) automatically filter based on the globally selected hierarchy node.

## 4. Governance-Safe Migration Approach

1. **Staging**: Create `ExecutiveCommandCenter.jsx` as a new page, leaving the old `Dashboard.jsx` intact (Additive Implementation).
2. **Componentization**: Extract and refactor components into a `governed` folder (e.g., `GovernedKpiCard`, `GovernedSituationPanel`).
3. **Pilot**: Test the Command Center for a specific hierarchy level (e.g., BĐTP).
4. **Deprecation**: Gradually route "Dashboard" menu items to the new Command Center.

## 5. Visual Storytelling

- Move away from simple bar/line charts to more "Situation Room" visualizations:
  - Momentum Indicators (Speedometers for growth).
  - Risk Heatmaps (Geospatial or Grid based on Hierarchy).
  - Insight Timelines.
