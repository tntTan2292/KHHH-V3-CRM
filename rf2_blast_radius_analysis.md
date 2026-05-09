# RF2 Blast Radius Analysis

## Assessment of Risks for RF2A Implementation

### 1. Risk Areas
- **Hierarchy Context Switching**: Impact of changing `selectedNode` on existing operational API calls.
- **Data Load Balancing**: Fetching both legacy analytics and new governed intelligence payloads simultaneously.
- **Z-Index/Overlay Conflicts**: New filters or shell elements overlapping existing interactive dashboard parts.

### 2. Regression Risks
- **Null Payload Crash**: Executive components crashing if `EXEC_COMMAND_V1` is empty or malformed (Mitigation: Error Boundaries & Optional Chaining).
- **Date Sync Mismatch**: Discrepancies between `CommandFilterBar` dates and legacy API date logic.
- **Chart Library Incompatibility**: Recharts version conflicts or rendering bugs when mixing old and new chart components.

### 3. UX Disruption Risks
- **Familiarity Loss**: Users feeling lost if the "Shell" changes the navigation or feel too drastically.
- **Information Overload**: If executive intelligence is too dense, it may hide the operational data users actually need for work.
- **Performance Lag**: Heavy intelligence payloads causing the primary dashboard to lag during mounting.

### 4. Operational Continuity Risks
- **Action Blocking**: A crash in the new "Intelligence" layer must not block access to "Customer List" or "Action Center".
- **Report Export**: Ensuring `html2pdf` still captures the familiar operational view correctly, even with new shell wrappers.

## Mitigation Strategy
- **Partial Failure Resilience**: Every new intelligence component MUST be wrapped in an individual `ErrorBoundary` and return `null` on failure.
- **Operational Priority**: The core dashboard content must render FIRST, with the intelligence layer loading asynchronously (e.g., using SWR).
- **Additive CSS**: New styles must not override global dashboard themes.
