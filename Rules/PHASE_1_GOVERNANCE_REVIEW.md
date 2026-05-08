# GOVERNANCE REVIEW REPORT - PHASE 1

## A. Dependency Matrix

| Engine | Inputs | Outputs | Consumed By | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Ownership Governance** | Hierarchy Tree, User Role, point_id | Scope IDs, Query Filters | All Services/Routers | Mapping inconsistency between `point_id` (int) and `ma_bc` (string). |
| **Lifecycle Engine** | Transaction DB (SSOT) | Lifecycle State, Growth Tag | Summary Service, Customer List | None - Highly aligned with SSOT principles. |
| **VIP Tier Engine** | Transaction DB (Rolling 3M) | VIP Tier, Risk Status | Summary Service, Priority Engine | Fixed Top-N thresholds in config (Scalability risk). |
| **Lead Tier Engine** | Transaction DB, Manual Entry | Lead Tier, Potential RFM | Potential Module, Summary Service | **High Risk**: Hard-coded thresholds; Duplicated logic. |
| **Priority Engine** | Lifecycle/VIP Results | Priority Score & Level | Summary Service, Notification Engine | Missing Lead Tier inputs (Lead Priority is ignored). |
| **Notification Engine**| Summary Data, Rules | System Events, Alerts | Executive Dashboard, Alert Hub | Cooldown bypass risk if summary is rebuilt frequently. |
| **Escalation Engine** | System Events, Rules | Ownership Transfer, Records | Task Orchestrator, Management | Circular risk if transfers trigger new alerts. |
| **Exec. Dashboard** | Governed Summaries (SSOT) | KPI Cards, Trends, Alerts | Leaders, Executive Layer | **Dashboard Drift**: Logic duplication in `SummaryService`. |

## B. Governance Risks

| Risk Type | Description | Severity |
| :--- | :--- | :--- |
| **Duplicated Scoring** | Lead Ranking logic exists in both `PotentialService` and `SummaryService` with different thresholds. | 🔴 Critical |
| **Hard-coded Governance** | Lead Tier uses fixed revenue thresholds (`THRESHOLD_DIAMOND_REV`) instead of Hybrid Ranking Model. | 🔴 Critical |
| **Dashboard Drift** | Dashboard KPI cards for Leads will not match the Potential List due to divergent ranking logic. | 🟠 High |
| **SSOT Bypass Risk** | `PotentialService` queries raw Transactions directly for ranking instead of using a Governed Lead Engine. | 🟠 High |
| **Hierarchy Risk** | `ScopingService` handles `Customer` by mapping string codes (`ma_bc`) while others use `point_id`. | 🟡 Medium |
| **Priority Exclusion** | New Lead Tier signals (Momentum, Aging) are not yet integrated into the `PriorityEngine`. | 🟡 Medium |

## C. Critical Conflicts

| Conflict Area | Description | Impact |
| :--- | :--- | :--- |
| **Lead Tier vs. Constitution** | Implementation uses hard-coded thresholds (fixed 5M/2M/500K) vs. Constitutional requirement for "Hybrid Ranking". | Non-compliance with SSOT principles. |
| **Potential vs. Summary** | `classify_rank` in `SummaryService` (rev > 5M & cnt > 20) != `PotentialService` (rev >= 5M & cnt >= 5). | Data discrepancy on Executive Dashboard. |
| **Lead vs. VIP Naming** | Both use "Diamond/Gold/Bronze" labels, creating confusion between identify customers and prospects. | Operational confusion in Critical Center. |
| **Priority Gap** | `PriorityEngine` ignores Lead Risk/Aging, conflicting with Section VI.5 of the Constitution. | Leads never reach "Critical" priority. |

## D. Recommended Refactor Targets

*   **Centralize Lead Tier Logic**: Move ranking logic from `PotentialService` and `SummaryService` into a dedicated `LeadTierEngine` class.
*   **Implement Hybrid Ranking**: Replace fixed thresholds in `config_segments.py` with percentile-based or momentum-based ranking as per Section V.2.
*   **Harmonize Priority Formula**: Update `PriorityEngine` to consume Lead Tier momentum and aging signals.
*   **Unified Scoping**: Align `Customer` ownership mapping to use `point_id` consistently across all governance layers.
*   **Lead Summary Table**: Create a governed `monthly_lead_summary` table to prevent repeated heavy scanning of the raw Transaction DB for prospects.

## E. Phase Readiness

- **Not Ready** for next stabilization phase. 
- **Reason**: The Lead Tier implementation is currently in direct conflict with the updated Constitution (Hard-coded vs. Dynamic) and exhibits critical logic duplication that will cause dashboard drift.

---
**Reviewer**: Antigravity CRM Governance Engineer
**Timestamp**: 2026-05-08 09:45 (ICT)
**Status**: Governance Audit Failed - Refactor Required for Lead Tier.
