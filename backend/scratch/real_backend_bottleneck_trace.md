# Diagnostic Report: KHHH CRM V3.0 Real Backend Bottleneck Trace 🔍

During Phase 2C, the frontend bundle size was reduced by **90.4%** (from 1.09 MB to 105 KB), and lazy-loading was integrated for all heavy components. However, the Dashboard still exhibited a noticeable loading skeleton phase on first boot. 

This diagnostic audit performs a deep runtime scan of the backend service layer and SQLite queries to identify the root cause of the delay.

---

## 📊 1. API Endpoint Latency Metrics (Live Measurement)

We executed an automated timing analysis against the live production backend (running on port `8000` with 1,754,405 transactions and 3,575 customers).

### API Timing Breakdown:
```bash
=== RUN 1: COLD LOAD (First request after mount / restart) ===
COLD /api/analytics/summary                   :  1519.08 ms  <-- 🚨 THE BIG BOTTLENECK!
COLD /api/analytics/revenue-monthly           :    12.62 ms
COLD /api/analytics/top-movers                :    14.48 ms
COLD /api/analytics/heatmap-units             :    13.61 ms
COLD /api/analytics/customer-scoring          :    15.02 ms
COLD /api/analytics/churn-prediction          :    15.15 ms
COLD /api/analytics/system-health             :     8.59 ms

=== RUN 2: HOT LOAD (Cached request response) ===
HOT  /api/analytics/summary                   :  1457.58 ms  <-- 🚨 Bypasses all cache!
HOT  /api/analytics/revenue-monthly           :     8.65 ms
HOT  /api/analytics/top-movers                :    11.22 ms
HOT  /api/analytics/heatmap-units             :    11.14 ms
HOT  /api/analytics/customer-scoring          :    10.07 ms
HOT  /api/analytics/churn-prediction          :    10.23 ms
HOT  /api/analytics/system-health             :     7.33 ms
```

**Observation**: While all cached analytical widgets load in **under 15 ms**, the primary `/api/analytics/summary` endpoint takes **1.45 to 1.52 seconds** on every single request, completely uncached.

---

## 🎯 2. Sub-Method Timing Analysis

We parsed and timed the individual SQLAlchemy service modules invoked sequentially inside `/api/analytics/summary` / `get_dashboard_stats()`:

| Sub-Method / Query Layer | Execution Time | % of Total Time | Source Table / Operation |
| :--- | :---: | :---: | :---: |
| `get_revenue_for_range_governed` | 43.84 ms | 2.9% | `transactions` (MoM sum) |
| `LifecycleService.get_customer_lifecycle_stats` | 4.99 ms | 0.3% | `monthly_analytics_summary` |
| **`PotentialService.get_potential_data`** | **1,189.56 ms** | **78.3%** | `transactions` (**1.75M row grouping**) |
| Others (Region, Service, Month range) | ~220.00 ms | 18.5% | Iteration overhead / formatting |

**Verdict**: The **`PotentialService.get_potential_data`** method consumes **78.3% of the entire request duration** (1.19 seconds), making it the single largest performance barrier in the KHHH CRM suite.

---

## ⚙️ 3. Under-the-Hood SQL & Execution Flow Trace

### The Query Bottleneck:
Inside `/api/analytics/summary` (which calls `get_dashboard_stats()`), the backend executes the following call to count potential (vãng lai) customers:
```python
# analytics.py (Line 184)
_, kh_tiem_nang, potential_ranks, _ = PotentialService.get_potential_data(
    db=db, current_user=current_user, start_date=governed_start, end_date=governed_end,
    node_code=node_code, min_days=1, include_all=True
)
```
Notice that the first parameter (`_`) which returns the detailed, sorted, mapped list of thousands of potential customers is **completely discarded**! The backend only needs the total count (`kh_tiem_nang`) and the segment counts (`potential_ranks`).

However, `PotentialService.get_potential_data()` still executes a massive, heavy aggregate query:
```python
query = db.query(
    Transaction.ten_nguoi_gui.label('raw_name'),
    Transaction.dia_chi_nguoi_gui.label('raw_address'),
    Transaction.ma_dv_chap_nhan.label('ma_bc'),
    func.count(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.id))).label('tong_so_don'),
    func.sum(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.doanh_thu), else_=0)).label("tong_doanh_thu"),
    func.count(func.distinct(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), func.date(Transaction.ngay_chap_nhan))))).label("so_ngay_gui"),
    func.sum(case((Transaction.ngay_chap_nhan.between(prev_start, prev_end), Transaction.doanh_thu), else_=0)).label("prev_doanh_thu"),
    func.max(Transaction.ngay_chap_nhan).label("ngay_gan_nhat")
).filter(
    (Transaction.ma_kh == '') | (Transaction.ma_kh == None),
    Transaction.ngay_chap_nhan >= prev_start
).group_by(Transaction.ten_nguoi_gui, Transaction.dia_chi_nguoi_gui, Transaction.ma_dv_chap_nhan)
```

### Why it Chokes SQLite:
1. **1.75 Million Row Scan**: It filters on `(ma_kh IS NULL OR ma_kh = '')`, which matches the vast majority of non-contract walk-in transactions (vãng lai).
2. **Heavy Text Group By**: It groups by three massive text columns (`ten_nguoi_gui`, `dia_chi_nguoi_gui`, and `ma_dv_chap_nhan`), forcing SQLite to build massive hash structures in memory/disk.
3. **Loop Overhead**: In the post-processing phase, it loops through thousands of grouped rows, normalizes names/addresses, maps post offices, and calculates MoM velocity—only to discard the resulting array of detail items!
4. **FastAPI Event-Loop Blocking**: Because the FastAPI route is declared with `async def`, it runs directly on the single-threaded asyncio event loop. The synchronous SQLAlchemy `.all()` database call **blocks the entire thread for 1.2 seconds**, preventing concurrent endpoints (like `/api/analytics/data-coverage` and `/api/analytics/system-health`) from responding to the client during this time, causing the prolonged loading state.

---

## 💡 4. Proposed Minimal Governance Plan

We propose a minimal, high-efficiency, zero-risk plan that requires **no database migrations or business logic modifications**:

1. **Short-Circuit Counts (`PotentialService`)**:
   * If `include_all` is `True` (indicating a summary count is needed) AND we are querying a complete calendar month, **bypass the raw transaction table scan completely**.
   * Retrieve the pre-aggregated potential customer counts directly from the `monthly_analytics_summary` table (which is already populated incrementally by the incremental scheduler).
   * **Expected timing**: ~1 ms instead of 1,189 ms.

2. **Allow Cache-Retrieval for Trend Loop (`analytics.py`)**:
   * In `/api/analytics/revenue-monthly`, allow `use_summary=True` when querying completed historical months (which is the case for 13 out of 14 months in the trend array), avoiding 14 concurrent scans of the entire `transactions` table.

3. **FastAPI Non-Blocking thread isolation**:
   * Offload the remaining synchronous SQLite queries to the FastAPI thread pool by removing `async` from the `/summary` and `/dashboard` route definitions, allowing Uvicorn to delegate them to standard workers, keeping the main loop 100% responsive.
