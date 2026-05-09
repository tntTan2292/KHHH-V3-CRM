# Hierarchy & Navigation Audit

## 1. Drilldown Issues

- **State Inconsistency**: Drilling down in the Dashboard updates the `navStack` locally, but this context is lost when navigating to "Customers" or "Action Center".
- **Implicit Navigation**: Some widgets allow clicking to "soi" (drill down), but the global navigation bar (Sidebar/Topbar) does not always sync with the selected hierarchy node.
- **Deep Nesting UX**: The `navStack` breadcrumb in `Dashboard.jsx` is only visible within the Regional Bảng Quản trị, not as a global layout feature.

## 2. Hierarchy Visibility Issues

- **Ownership Visibility Gaps**: In `ActionCenter`, it's hard to see the organizational path of a task without drilling into the unit first.
- **Root-only Filters**: Many filters are applied to the "Selected Node", but there's no clear "Hierarchy Snapshot" (overview of children status) in the main dashboard view.

## 3. Navigation Inconsistencies

- **Module-First vs Command-First**: Navigation is currently "Module-First" (Click "Dashboard" -> Click "Customers"). A "Command Center" should be "Hierarchy-First" (Select "Region A" -> View Dashboard -> View Risks -> View Actions for Region A).
- **Sidebar fragmentation**: The sidebar is simple and doesn't reflect the complex hierarchy or current command status.

## 4. Recommendations

- **Global Hierarchy Provider**: Implement a global context or state management for the `selectedNode` and `navStack` so it persists across modules.
- **Hierarchy-Aware Topbar**: Move the hierarchy navigation and `navStack` to the `Topbar` or a persistent sub-header.
- **Drilldown by Default**: All cards and table rows should support hierarchy drilldown if they represent a unit.
- **Command Navigation**: Navigation should allow switching between "Executive View" (Command Center) and "Operational View" (Modules) for the *same hierarchy node*.
