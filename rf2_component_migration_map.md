# RF2 Component Migration Map

## Goal
To map the integration of new governed components into the existing operational dashboard using an additive-only approach.

| Component | Strategy | Description |
| :--- | :--- | :--- |
| **Dashboard.jsx** | **Preserve Root** | Keeps its original identity and layout. Acts as the host for augmentations. |
| **ExecutiveShell** | **Wrap** | Provides the `HierarchyProvider` and global filters (`CommandFilterBar`) without modifying the dashboard's internal layout. |
| **Lifecycle Cards** | **Keep Original** | The 5 cards stay. Augment with small status badges from the executive payload. |
| **Revenue Chart** | **Keep Original** | The main AreaChart stays. Add a dashed "Forecast Line" from `forecast_intelligence`. |
| **AttentionRail** | **New (Compact)** | Integrated as a thin status bar or a small side widget to show global priority. |
| **ExecutiveSummaryBoard** | **New (Secondary)** | Moved to a "Pulse" section at the bottom or a side rail. Not a primary header. |
| **GovernedKpiSection** | **Augment** | Integrated into existing KPI tooltips or as small "Momentum Indicators" next to core metrics. |
| **SituationSection** | **New (Supporting)** | Added as a bottom "Situational Awareness" panel for deep-dive. |
| **ExecutiveActionPanel** | **Augment** | Integrated as a "Quick Commands" menu or floating button. |

## Integration Map (Additive Only)
1. **Wrap `App`** with `HierarchyProvider`.
2. **Wrap `Dashboard`** with `ExecutiveShell` (Layout only).
3. **Inject `CommandFilterBar`** into the top position.
4. **Overlay `AttentionPulse`** on the existing header.
5. **Annotate `RevenueChart`** with governed momentum signals.
6. **Append `IntelligenceLayer`** (Concerns/Insights) at the bottom of the page.
