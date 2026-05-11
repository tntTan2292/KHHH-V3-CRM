# [PLAN-03] HIERARCHY CONTEXT FLOW

## The Challenge
Hierarchy context (selected Cụm/Bưu cục) is currently lost when navigating between Dashboard and operational pages. This creates friction for managers who want to "Drill-Down" on the dashboard and then "Execute" in the Customers or Action Center modules.

## Proposed "Lightweight" Architecture
Instead of a global Redux-like state store (overengineering), we will use **URL Query Parameters** as the source of truth for the organization's hierarchy state.

### Flow Mechanism:
1. **Selection (TreeExplorer)**: When a user selects a node, `TreeExplorer` updates the URL: `?node_code=BC_HUE_01`.
2. **Persistence (Sidebar/Navigation)**: All links in the Sidebar and internal Dashboard links will append the current `node_code` to the destination URL.
3. **Consumption (Page Load)**: Each module (`Customers`, `Dashboard`, `ActionCenter`) reads `node_code` from the URL on initial mount and uses it for API fetches.
4. **Sync**: If the user changes the hierarchy on the `Customers` page, the URL is updated, and navigating back to the `Dashboard` preserves that selection.

## Benefits
- **Zero Memory Overhead**: No state management bloat.
- **Natural Back/Forward**: Browser history works as expected.
- **Easy Sharing**: Managers can copy a URL of a specific filtered view and send it to staff.
- **Rollback Safety**: If the URL parameter is missing, the system defaults to the user's primary scope (standard behavior).

## Risk Mitigation
- **URL Bloat**: Keep parameters minimal (`node_code` and `node_type`).
- **Parsing Errors**: Use defensive parsing in `useHierarchy` hook to handle invalid or missing codes.
