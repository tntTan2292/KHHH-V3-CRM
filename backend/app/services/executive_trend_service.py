from sqlalchemy.orm import Session
from .kpi_rollup_service import KPIRollupService
from .executive_health_service import ExecutiveHealthService
from ..core.kpi_governance import KPIRegistry
import statistics
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class ExecutiveTrendService:
    """
    [GOVERNANCE] Executive Trend Intelligence Engine.
    Provides foresight into operational momentum, anomalies, and deterioration.
    Strictly READ-ONLY and Summary-First.
    """

    # ANTI-NOISE GOVERNANCE: Minimum thresholds to avoid false positives for small units
    MIN_REVENUE_BASELINE = 1000000.0 # 1 Million VND
    MIN_CUSTOMER_BASELINE = 5
    MIN_DATA_POINTS = 3 # Minimum months for trend analysis

    # ANOMALY THRESHOLDS
    SPIKE_THRESHOLD = 0.40    # >= 40%
    COLLAPSE_THRESHOLD = 0.30 # > 30%
    VOLATILITY_CV_THRESHOLD = 0.50 # Coefficient of Variation > 0.5

    @staticmethod
    def calculate_momentum(current: float, previous: float) -> str:
        """Determines momentum level based on MoM change."""
        if previous == 0:
            return "STABLE"
        delta = (current - previous) / previous
        
        if delta >= 0.20: return "STRONGLY_IMPROVING"
        if delta >= 0.05: return "IMPROVING"
        if delta <= -0.20: return "CRITICAL_DECLINE"
        if delta <= -0.05: return "DEGRADING"
        return "STABLE"

    @staticmethod
    def analyze_trend(db: Session, entity_type: str, entity_id: str, period_key: str, window_size: int = 6):
        """
        Analyzes multi-period trends and detects anomalies.
        """
        # 1. Fetch Historical Window
        history = []
        current_period = period_key
        
        for _ in range(window_size + 1): # Get current + history
            if not current_period: break
            
            metrics = {}
            if entity_type == 'HIERARCHY_NODE':
                metrics = KPIRollupService.aggregate_node_kpis(db, int(entity_id), current_period)
            
            if metrics:
                history.insert(0, {"period": current_period, "metrics": metrics})
            
            current_period = ExecutiveHealthService.get_previous_month(current_period)

        if len(history) < 2:
            return {"status": "INSUFFICIENT_DATA"}

        # 2. Extract series for analysis
        rev_series = [h["metrics"].get("REVENUE", 0.0) for h in history]
        cust_series = [h["metrics"].get("ACTIVE_CUSTOMERS", 0.0) for h in history]
        
        current_rev = rev_series[-1]
        prev_rev = rev_series[-2]
        baseline_revs = rev_series[:-1] # History excluding current
        
        current_cust = cust_series[-1]
        prev_cust = cust_series[-2]
        baseline_custs = cust_series[:-1]

        # 3. Momentum Analysis
        momentum = {
            "REVENUE": ExecutiveTrendService.calculate_momentum(current_rev, prev_rev),
            "CUSTOMERS": ExecutiveTrendService.calculate_momentum(current_cust, prev_cust)
        }

        # 4. Anomaly Detection with Anti-Noise Governance
        anomalies = []
        
        # Rule: Only check anomalies if baseline meets minimum thresholds
        avg_baseline_rev = sum(baseline_revs) / len(baseline_revs) if baseline_revs else 0
        avg_baseline_cust = sum(baseline_custs) / len(baseline_custs) if baseline_custs else 0

        if (len(baseline_revs) >= ExecutiveTrendService.MIN_DATA_POINTS and 
            avg_baseline_rev >= ExecutiveTrendService.MIN_REVENUE_BASELINE and 
            avg_baseline_cust >= ExecutiveTrendService.MIN_CUSTOMER_BASELINE):
            
            # Spike/Collapse Detection (Revenue)
            rev_delta = (current_rev - avg_baseline_rev) / avg_baseline_rev if avg_baseline_rev > 0 else 0
            if rev_delta >= ExecutiveTrendService.SPIKE_THRESHOLD:
                anomalies.append({
                    "type": "SPIKE_ANOMALY",
                    "kpi": "REVENUE",
                    "explainability": {
                        "baseline_value": round(avg_baseline_rev, 2),
                        "current_value": round(current_rev, 2),
                        "delta_percent": round(rev_delta * 100, 2),
                        "comparison_window": f"{len(baseline_revs)} months",
                        "evidence_snapshot": rev_series
                    }
                })
            elif rev_delta <= -ExecutiveTrendService.COLLAPSE_THRESHOLD:
                anomalies.append({
                    "type": "COLLAPSE_ANOMALY",
                    "kpi": "REVENUE",
                    "explainability": {
                        "baseline_value": round(avg_baseline_rev, 2),
                        "current_value": round(current_rev, 2),
                        "delta_percent": round(rev_delta * 100, 2),
                        "comparison_window": f"{len(baseline_revs)} months",
                        "evidence_snapshot": rev_series
                    }
                })

            # Volatility Detection (CV = stddev / mean)
            if len(rev_series) >= 3:
                cv = statistics.stdev(rev_series) / sum(rev_series) * len(rev_series) if sum(rev_series) > 0 else 0
                if cv > ExecutiveTrendService.VOLATILITY_CV_THRESHOLD:
                    anomalies.append({
                        "type": "VOLATILITY_ALERT",
                        "kpi": "REVENUE",
                        "cv": round(cv, 3),
                        "explainability": {
                            "baseline_value": round(avg_baseline_rev, 2),
                            "current_value": round(current_rev, 2),
                            "delta_percent": round(cv * 100, 2),
                            "comparison_window": f"{len(rev_series)} months",
                            "evidence_snapshot": rev_series
                        }
                    })

        # 5. Trend Signals Generation
        signals = []
        if any(a["type"] == "COLLAPSE_ANOMALY" for a in anomalies):
            signals.append("DECLINE_SIGNAL")
        if momentum["REVENUE"] == "CRITICAL_DECLINE":
            signals.append("WATCH_SIGNAL")
        if momentum["REVENUE"] in ["IMPROVING", "STRONGLY_IMPROVING"] and current_rev > avg_baseline_rev:
            signals.append("GROWTH_SIGNAL")

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period_key": period_key,
            "momentum": momentum,
            "rolling_average": {
                "REVENUE": round(avg_baseline_rev, 2),
                "CUSTOMERS": round(avg_baseline_cust, 2)
            },
            "anomaly_detection": anomalies,
            "trend_signals": signals,
            "window_size": len(history),
            "timestamp": datetime.now().isoformat()
        }
