# Dashboard Governance Audit - CRM V3.0 Phase 11

## 1. Governance Violations (B3 & KPI Constitution)

- **Local Severity Inference**: The dashboard calculates "positive/warning/negative" status for insights locally in `AIAssistantInsights`. This violates the "centralized engine logic" rule.
- **Local Quadrant Classification**: Regional performance is classified into "NGÔI SAO", "BÒ SỮA", "TRIỂN VỌNG", "YẾU KÉM" using frontend logic instead of governed backend signals.
- **Raw Metric Exposure**: Frontend fetches raw stats from `/api/analytics/summary` and performs local aggregations and comparisons. It should be consuming the `EXEC_COMMAND_V1` governed payload.
- **KPI Calculation Drift**: Growth rates and ARPU changes are calculated on the fly in the frontend, leading to potential divergence from backend "Transaction Truth".

## 2. Dashboard UX Issues

- **Dashboard Noise**: The current dashboard is a mix of charts, cards, and AI insights with no clear "Executive Attention Flow".
- **ERP-Style Layout**: Over-reliance on standard grids and charts (ERP-style) rather than a "Command Center" visualization that highlights risks first.
- **Priority Flow Failure**: Risk and SLA alerts are buried below lifecycle cards. The "Executive Health" isn't the primary focal point.
- **Redundant Information**: "Elite Morning Pulse" and "System Health" banners take up significant vertical space without providing drilldown-ready context.

## 3. Operational Visibility Problems

- **Hierarchy context loss**: When drilling down into a unit, the dashboard updates, but the global navigation context doesn't always reflect the "Command Center" philosophy.
- **Siloed Views**: Risk, Health, and Forecast are viewed as separate widgets rather than an integrated "Situation Overview".
- **Lack of Storytelling**: Data is presented as points/series rather than an "Executive Story" (e.g., "Why is revenue declining in Region X despite high volume?").

## 4. Recommendations

- **Transition to Governed Payloads**: Replace multiple `/api/analytics` calls with a single call to `/api/executive/command-center`.
- **Severity-Driven UI**: Use the `executive_status` (CRITICAL, DEGRADED, WATCHLIST) to drive the main dashboard theme and attention routing.
- **Hierarchy-First Navigation**: Standardize the `navStack` and `TreeExplorer` into a global "Command Navigation" bar.
- **Refactor to Unified Cards**: Create a single "Governed KPI Card" component that renders based on payload metadata.
