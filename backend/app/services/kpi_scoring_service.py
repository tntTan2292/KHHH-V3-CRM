import logging
from typing import Optional
from ..core.kpi_governance import KPIRegistry, ScoringDirection

logger = logging.getLogger(__name__)

class KPIScoringService:
    """
    [GOVERNANCE] Centralized KPI Scoring Engine.
    Translates raw metric values into normalized performance scores.
    """

    @staticmethod
    def calculate_normalized_score(kpi_code: str, raw_value: float) -> float:
        """
        Calculates a normalized score (0-100+) based on the KPI definition.
        
        Logic:
        - HIGHER_BETTER: (raw / target) * scale
        - LOWER_BETTER: (target / raw) * scale (if raw > target, else scale)
          Actually, for LOWER_BETTER, a better approach is linear penalty:
          score = scale - ((raw - target) / (critical - target)) * scale
        """
        kpi = KPIRegistry.get_kpi(kpi_code)
        if not kpi or kpi.target_value is None:
            return 0.0

        target = kpi.target_value
        scale = kpi.scoring_scale
        
        if kpi.scoring_direction == ScoringDirection.HIGHER_BETTER:
            if target == 0: return 0.0
            # Linear scoring: 100% of target = 100 points. 
            # Can exceed 100 if raw > target.
            score = (raw_value / target) * scale
        else:
            # LOWER_BETTER (e.g., Churn)
            if raw_value <= target:
                return scale # Perfect score if below target
            
            critical = kpi.critical_threshold or (target * 2)
            if critical <= target: return 0.0
            
            # Linear penalty towards critical threshold
            penalty_range = critical - target
            excess = raw_value - target
            score = scale - (excess / penalty_range) * scale
        
        return max(0.0, round(score, 2))

    @staticmethod
    def get_performance_status(kpi_code: str, score: float) -> str:
        """Categorizes score into qualitative status."""
        if score >= 100: return "EXCELLENT"
        if score >= 80: return "GOOD"
        if score >= 50: return "WARNING"
        return "CRITICAL"
