# [PLAN-05] CONTROLLED IMPLEMENTATION PHASES

## Implementation Strategy
RF3 will be deployed in 4 additive sub-phases to ensure stability and user feedback loops.

---

### Phase RF3.1: Context Persistence Engine
- **Goal**: Enable URL-based hierarchy syncing.
- **Affected Files**: `TreeExplorer.jsx`, `Dashboard.jsx`, `Customers.jsx`, `ActionCenter.jsx`.
- **Change**: Sync `selectedNode` to `URLSearchParams`.
- **Rollback Safety**: Defaults to user scope if URL param is invalid.
- **Blast Radius**: Low (Contextual).

---

### Phase RF3.2: Metric Command Routing
- **Goal**: Make Dashboard metrics actionable.
- **Affected Files**: `Dashboard.jsx` (Territory Table & Lifecycle Cards).
- **Change**: Wrap unit names and lifecycle counts in `<Link>` components.
- **Rollback Safety**: Purely additive UI; logic-free navigation.
- **Blast Radius**: Very Low (Local UI).

---

### Phase RF3.3: Strategic Insight Actions
- **Goal**: Connect AI insights to execution modules.
- **Affected Files**: `Dashboard.jsx` (`AIAssistantInsights` component).
- **Change**: Add contextual "Action" links to the end of insight bullets.
- **Rollback Safety**: Removing links restores previous state.
- **Blast Radius**: Minimal.

---

### Phase RF3.4: Cross-Module Breadcrumbs
- **Goal**: Clarify filtered states in destination modules.
- **Affected Files**: `Customers.jsx`, `ActionCenter.jsx`, `LeadPipeline.jsx`.
- **Change**: Add a "Filter Context" header when `node_code` is present in URL.
- **Rollback Safety**: Header only renders conditionally.
- **Blast Radius**: Low.
