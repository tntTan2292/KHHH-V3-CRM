# 📜 LIFECYCLE SSOT REFERENCE TABLE (CONSTITUTIONAL)
*(Single Source of Truth - Frozen Reference)*

---

### 🛡️ GOVERNANCE METADATA
- **Generation Method**: Full Constitutional Rebuild (LifecycleEngine V3.1)
- **Compliance**: HIEN_PHAP_CRM_3.0.md (Strict 30/90 Boundary)
- **Status**: **FROZEN** (Official Source for Lifecycle Audits)
- **Period**: 01/2025 → 05/2026
- **Authority**: Mọi Dashboard, API và Module Khách hàng phải đối soát (Audit) theo bảng số liệu này. Không được sử dụng kết quả truy vấn trực tiếp để tự xác thực tính đúng đắn nếu không khớp với bảng này.

---

### 📊 REFERENCE DATA TABLE

> Runtime truth set aligned to `days_inactive > 90` and the current DB snapshot / summary outputs.

| Month | Universe | Active | New | Recovered | AtRisk | Churn | NewEvt | RecovEvt | ChurnEvt |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **01/2025** | 1,457 | 0 | 1,457 | 0 | 0 | 0 | 1,458 | 0 | 0 |
| **02/2025** | 1,666 | 0 | 1,400 | 0 | 266 | 0 | 209 | 0 | 0 |
| **03/2025** | 1,891 | 0 | 1,510 | 0 | 381 | 0 | 225 | 0 | 0 |
| **04/2025** | 2,056 | 1,131 | 369 | 0 | 409 | 147 | 165 | 0 | 147 |
| **05/2025** | 2,208 | 1,164 | 320 | 15 | 444 | 265 | 152 | 15 | 133 |
| **06/2025** | 2,358 | 1,175 | 271 | 25 | 464 | 423 | 150 | 18 | 176 |
| **07/2025** | 2,628 | 1,138 | 380 | 29 | 525 | 556 | 270 | 26 | 159 |
| **08/2025** | 2,743 | 1,112 | 319 | 33 | 559 | 720 | 115 | 30 | 194 |
| **09/2025** | 2,860 | 1,143 | 305 | 30 | 455 | 927 | 117 | 29 | 237 |
| **10/2025** | 2,959 | 1,208 | 197 | 22 | 411 | 1,121 | 99 | 22 | 216 |
| **11/2025** | 3,047 | 1,233 | 183 | 35 | 369 | 1,227 | 88 | 35 | 141 |
| **12/2025** | 3,148 | 1,302 | 177 | 41 | 307 | 1,321 | 101 | 39 | 134 |
| **01/2026** | 3,250 | 1,275 | 179 | 53 | 360 | 1,383 | 102 | 53 | 115 |
| **02/2026** | 3,288 | 1,213 | 121 | 28 | 465 | 1,461 | 38 | 26 | 105 |
| **03/2026** | 3,390 | 1,276 | 158 | 31 | 345 | 1,580 | 102 | 31 | 158 |
| **04/2026** | 3,491 | 1,271 | 188 | 32 | 304 | 1,696 | 101 | 32 | 149 |
| **05/2026** | 3,561 | 1,047 | 154 | 21 | 568 | 1,771 | 70 | 21 | 96 |

---

### 🔍 RUNTIME ALIGNMENT VERIFICATION
1.  **Rule III.1 (New Pop)**: 90 days probation verified.
2.  **Rule III.2 (Active)**: Inactive <= 30 days verified.
3.  **Rule III.3 (At-risk)**: Inactive > 30 days verified.
4.  **Rule III.4 (Churn)**: Inactive > 90 days verified.
5.  **Population Mutual Exclusivity**: Sum(Pop) = Universe verified against current snapshot truth set.
6.  **Temporal Integrity**: Future transactions excluded by runtime bounded SQL.

---
*Created At: 2026-05-14*
*Lifecycle Engine: V3.1 (Constitutional)*
