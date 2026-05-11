# [PLAN-02] COMMAND ACTION MAP

## Objective
Map every "Executive Insight" area on the Dashboard to its corresponding "Operational Destination".

## Action Routing Table

| Dashboard Area | Metric/Trigger | Destination Module | Context Preserved (URL Params) |
| :--- | :--- | :--- | :--- |
| **MoM Territory** | Weak Unit Name | `Customers` | `node_code={unit_code}&growth=negative` |
| **MoM Territory** | Growth Metric | `Customers` | `node_code={unit_code}&sort=growth_asc` |
| **Lifecycle Card** | "CHURNED" | `Customers` | `lifecycle=churned` |
| **Lifecycle Card** | "AT RISK" | `Customers` | `lifecycle=at_risk` |
| **Lifecycle Card** | "ACTIVE" | `Customers` | `lifecycle=active` |
| **Strategic Insight** | "Churn Warning" | `Customers` | `risk_level=CAO` |
| **Strategic Insight** | "Weak Territory"| `ActionCenter` | `node_code={weak_code}` |
| **Strategic Insight** | "New Leads" | `LeadPipeline` | `status=NEW` |

## Navigation Logic
- **Single Click**: Navigates to the module and applies filters.
- **Breadcrumb Context**: The target module should show a "Filtered from Dashboard" indicator with a "Clear Filters" option to maintain operational flexibility.
- **Deep Linking**: All routes must be shareable via URL (e.g., `.../customers?node_code=BC123&lifecycle=at_risk`).
