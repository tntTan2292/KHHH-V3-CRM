from sqlalchemy.orm import Session
from .kpi_rollup_service import KPIRollupService
from .executive_health_service import ExecutiveHealthService
from .executive_trend_service import ExecutiveTrendService
import statistics
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class ExecutiveForecastService:
    """
    [GOVERNANCE] Executive Forecast Intelligence Engine.
    Provides operational projections for 1-3 months.
    Strictly READ-ONLY, Summary-First, and Deterministic.
    """

    MAX_GROWTH_PER_MONTH = 0.40 # +40% Max
    MIN_BASELINE_REVENUE = 1000000.0
    MIN_HISTORY_FOR_CONFIDENCE = 4

    @staticmethod
    def calculate_slope(series: List[float]) -> float:
        """Calculates the slope of a series using simple linear regression."""
        n = len(series)
        if n < 2: return 0.0
        x = list(range(n))
        y = series
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xx = sum(i*i for i in x)
        sum_xy = sum(i*j for i, j in zip(x, y))
        denominator = (n * sum_xx) - (sum_x * sum_x)
        if denominator == 0: return 0.0
        return ((n * sum_xy) - (sum_x * sum_y)) / denominator

    @staticmethod
    def forecast_kpi(db: Session, entity_type: str, entity_id: str, kpi_code: str, period_key: str, horizon: int = 3):
        """
        Forecasts a specific KPI for the next N months.
        """
        # 1. Fetch 6 months history
        history_values = []
        current_period = period_key
        for _ in range(6):
            if not current_period: break
            metrics = {}
            if entity_type == 'HIERARCHY_NODE':
                metrics = KPIRollupService.aggregate_node_kpis(db, int(entity_id), current_period)
            
            val = metrics.get(kpi_code, 0.0)
            history_values.insert(0, val)
            current_period = ExecutiveHealthService.get_previous_month(current_period)

        if len(history_values) < 3:
            return {"status": "INSUFFICIENT_DATA"}

        # 2. Safety Check (Anti-noise)
        avg_baseline = sum(history_values) / len(history_values)
        if kpi_code == "REVENUE" and avg_baseline < ExecutiveForecastService.MIN_BASELINE_REVENUE:
            return {"status": "BASELINE_TOO_LOW"}

        # 3. Confidence Scoring
        cv = 0.0
        if len(history_values) >= 2 and avg_baseline > 0:
            std = statistics.stdev(history_values) if len(history_values) > 1 else 0
            cv = std / avg_baseline
        
        confidence = "LOW"
        if len(history_values) >= ExecutiveForecastService.MIN_HISTORY_FOR_CONFIDENCE:
            if cv < 0.2: confidence = "HIGH"
            elif cv < 0.5: confidence = "MEDIUM"
        
        # 4. Projection Logic (Rolling Avg + Slope)
        slope = ExecutiveForecastService.calculate_slope(history_values)
        last_value = history_values[-1]
        
        projections = []
        current_projection = last_value
        
        for h in range(1, horizon + 1):
            # Apply slope but clamp growth to +40%
            projected_next = current_projection + slope
            
            # GOVERNANCE: Boundaries
            # 1. No negative
            projected_next = max(0.0, projected_next)
            # 2. Max growth clamp
            if current_projection > 0:
                growth_rate = (projected_next - current_projection) / current_projection
                if growth_rate > ExecutiveForecastService.MAX_GROWTH_PER_MONTH:
                    projected_next = current_projection * (1 + ExecutiveForecastService.MAX_GROWTH_PER_MONTH)
            
            projections.append({
                "month": f"t+{h}",
                "value": round(projected_next, 2)
            })
            current_projection = projected_next

        # 5. Trend Semantics
        total_forecast_delta = (current_projection - last_value) / last_value if last_value > 0 else 0
        status = "STABLE"
        if total_forecast_delta >= 0.30: status = "STRONGLY_GROWING"
        elif total_forecast_delta >= 0.10: status = "GROWING"
        elif total_forecast_delta <= -0.30: status = "CRITICAL_DECLINE"
        elif total_forecast_delta <= -0.10: status = "DECLINING"

        return {
            "kpi_code": kpi_code,
            "current_value": last_value,
            "projections": projections,
            "confidence": confidence,
            "cv": round(cv, 3),
            "trend_status": status,
            "total_forecast_delta": round(total_forecast_delta * 100, 2)
        }

    @staticmethod
    def get_executive_forecast(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        Aggregates forecasts for multiple KPIs and generates insights.
        """
        kpis_to_forecast = ["REVENUE", "ACTIVE_CUSTOMERS", "NEW_CUSTOMERS", "CHURN_CUSTOMERS", "POTENTIAL_LEADS"]
        results = {}
        
        for kpi in kpis_to_forecast:
            results[kpi] = ExecutiveForecastService.forecast_kpi(db, entity_type, entity_id, kpi, period_key)

        # Generate Insights
        insights = []
        rev_f = results.get("REVENUE", {})
        if rev_f.get("trend_status") == "CRITICAL_DECLINE":
            insights.append(f"Revenue projected to decline {abs(rev_f.get('total_forecast_delta'))}% within 3 months.")
        elif rev_f.get("trend_status") == "GROWING":
            insights.append("Revenue momentum recovering.")

        cust_f = results.get("ACTIVE_CUSTOMERS", {})
        if cust_f.get("trend_status") == "STABLE":
            insights.append("Customer base projected to stabilize.")
        
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period_key": period_key,
            "forecast_summary": results,
            "executive_insights": insights,
            "timestamp": datetime.now().isoformat()
        }
