# PHASE 3 CLEANUP REPORT: TRANSACTION DEDUPLICATION

## Overview
This document records the governance and execution of Phase 3 cleanup for duplicate transactions in CRM 3.0.

## Dedup Key Business Rule
To ensure safe deduplication without affecting legitimate multiple shipments (legit multi-event), the following triple-key was established:
1. **SHBG** (Số Hiệu Bưu Gửi)
2. **Thời gian chấp nhận** (Acceptance Time - down to the second)
3. **Doanh thu** (Revenue - to preserve correction/negative records)

## Execution Details
- **Date:** 2026-05-14
- **Script:** `backend/scripts/phase3_transaction_cleanup.py`
- **Total Transactions Audited:** 1,746,450
- **Total Redundant Records Removed:** 4,597
- **Logic:** Keeps the record with the minimum `id` (primary source) and deletes absolute duplicates.

## Financial Impact Verification
| Month | Revenue Before Cleanup | Revenue After Cleanup | Difference |
|---|---:|---:|---:|
| **2026-01** | 3,350,663,000 | 3,350,610,296 | -52,704 |
| **2026-02** | 2,149,843,000 | 2,149,843,000 | 0 |
| **2026-03** | 3,477,042,000 | 3,335,269,480 | **-141,772,520** |

## Governance Conclusion
The cleanup successfully removed verified duplicate imports. The significant drop in March 2026 revenue aligns with the identified sync duplication period. Data integrity is now restored at the raw transaction level.

---
*Authorized by Antigravity AI Coding Assistant*
