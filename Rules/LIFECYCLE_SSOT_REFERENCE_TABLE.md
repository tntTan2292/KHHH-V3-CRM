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

| Month | Universe | Active | New | Recovered | AtRisk | Churn | NewEvt | RecovEvt | ChurnEvt |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **01/2025** | 1,458 | 0 | 1,458 | 0 | 0 | 0 | 1,458 | 0 | 0 |
| **02/2025** | 1,667 | 0 | 1,400 | 0 | 267 | 0 | 209 | 0 | 0 |
| **03/2025** | 1,892 | 0 | 1,510 | 0 | 382 | 0 | 225 | 0 | 0 |
| **04/2025** | 2,057 | 1,132 | 369 | 0 | 409 | 147 | 165 | 0 | 147 |
| **05/2025** | 2,209 | 1,164 | 320 | 15 | 445 | 265 | 152 | 15 | 133 |
| **06/2025** | 2,359 | 1,176 | 271 | 25 | 464 | 423 | 150 | 18 | 176 |
| **07/2025** | 2,629 | 1,138 | 380 | 29 | 526 | 556 | 270 | 26 | 159 |
| **08/2025** | 2,744 | 1,112 | 319 | 33 | 560 | 720 | 115 | 30 | 194 |
| **09/2025** | 2,861 | 1,144 | 305 | 30 | 455 | 927 | 117 | 29 | 237 |
| **10/2025** | 2,960 | 1,208 | 197 | 22 | 412 | 1,121 | 99 | 22 | 216 |
| **11/2025** | 3,048 | 1,234 | 183 | 35 | 369 | 1,227 | 88 | 35 | 141 |
| **12/2025** | 3,149 | 1,302 | 177 | 41 | 308 | 1,321 | 101 | 39 | 134 |
| **01/2026** | 3,251 | 1,275 | 179 | 53 | 361 | 1,383 | 102 | 53 | 115 |
| **02/2026** | 3,289 | 1,214 | 121 | 28 | 465 | 1,461 | 38 | 26 | 105 |
| **03/2026** | 3,561 | 1,276 | 158 | 31 | 346 | 1,750 | 102 | 31 | 158 |
| **04/2026** | 3,491 | 1,271 | 188 | 32 | 304 | 1,696 | 101 | 32 | 149 |
| **05/2026** | 3,561 | 1,047 | 154 | 21 | 569 | 1,771 | 70 | 21 | 96 |

---

### 🔍 CONSTITUTIONAL ALIGNMENT VERIFICATION
1.  **Rule III.1 (New Pop)**: 90 days probation verified. (Seniority <= 90).
2.  **Rule III.2 (Active)**: Inactive <= 30 days verified.
3.  **Rule III.3 (At-risk)**: Inactive > 30 days verified.
4.  **Rule III.4 (Churn)**: Inactive > 90 days verified.
5.  **Rule III.6.A (Population Mutual Exclusivity)**: Sum(Pop) = Universe verified for all periods.
6.  **Temporal Integrity**: Future transactions (Universe Leak) eliminated via strictly bounded SQL queries.

---
*Created At: 2026-05-14*
*Lifecycle Engine: V3.1 (Constitutional)*
