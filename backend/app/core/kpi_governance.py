import enum
from typing import Dict, List, Optional
from pydantic import BaseModel

class KPIAuthority(str, enum.Enum):
    GOVERNED = "GOVERNED"     # Transaction Truth (Immutable)
    SSOT = "SSOT"             # Governed Summary (Canonical)
    DERIVED = "DERIVED"       # Calculated from GOVERNED/SSOT
    DISPLAY_ONLY = "DISPLAY"  # Dashboard helper only

class KPIDefinition(BaseModel):
    code: str
    name: str
    authority: KPIAuthority
    source: str               # e.g., "transactions", "monthly_analytics_summary"
    engine: Optional[str]     # e.g., "SummaryService", "LifecycleEngine"
    is_executive: bool = False
    can_escalate: bool = False

class KPIRegistry:
    """
    [GOVERNANCE] Centralized KPI Registry.
    SSOT for all metric definitions in CRM V3.0.
    """
    _kpis: Dict[str, KPIDefinition] = {
        "REVENUE": KPIDefinition(
            code="REVENUE", name="Tổng Doanh thu", 
            authority=KPIAuthority.GOVERNED, source="transactions", 
            engine="SummaryService", is_executive=True, can_escalate=True
        ),
        "VOLUME": KPIDefinition(
            code="VOLUME", name="Tổng Sản lượng", 
            authority=KPIAuthority.GOVERNED, source="transactions", 
            engine="SummaryService", is_executive=True, can_escalate=True
        ),
        "ACTIVE_CUSTOMERS": KPIDefinition(
            code="ACTIVE_CUSTOMERS", name="KH Hiện hữu", 
            authority=KPIAuthority.SSOT, source="monthly_analytics_summary", 
            engine="LifecycleEngine", is_executive=True, can_escalate=False
        ),
        "CHURN_CUSTOMERS": KPIDefinition(
            code="CHURN_CUSTOMERS", name="KH Rời bỏ", 
            authority=KPIAuthority.SSOT, source="monthly_analytics_summary", 
            engine="LifecycleEngine", is_executive=True, can_escalate=True
        ),
        "NEW_CUSTOMERS": KPIDefinition(
            code="NEW_CUSTOMERS", name="KH Mới", 
            authority=KPIAuthority.SSOT, source="monthly_analytics_summary", 
            engine="LifecycleEngine", is_executive=True, can_escalate=False
        ),
        "REVENUE_GROWTH": KPIDefinition(
            code="REVENUE_GROWTH", name="Tăng trưởng Doanh thu", 
            authority=KPIAuthority.DERIVED, source="calculated", 
            engine="AnalyticsRouter", is_executive=True, can_escalate=True
        ),
    }

    @classmethod
    def get_kpi(cls, code: str) -> Optional[KPIDefinition]:
        return cls._kpis.get(code.upper())

    @classmethod
    def list_executive_kpis(cls) -> List[KPIDefinition]:
        return [k for k in cls._kpis.values() if k.is_executive]

    @classmethod
    def validate_authority(cls, code: str, required_authority: List[KPIAuthority]) -> bool:
        kpi = cls.get_kpi(code)
        if not kpi:
            return False
        return kpi.authority in required_authority
