import enum
from typing import Dict, List, Optional
from pydantic import BaseModel

class KPIAuthority(str, enum.Enum):
    GOVERNED = "GOVERNED"     # Transaction Truth (Immutable)
    SSOT = "SSOT"             # Governed Summary (Canonical)
    DERIVED = "DERIVED"       # Calculated from GOVERNED/SSOT
    DISPLAY_ONLY = "DISPLAY"  # Dashboard helper only

class AggregationType(str, enum.Enum):
    SUM = "SUM"
    COUNT = "COUNT"
    AVG = "AVG"
    PERCENT = "PERCENT"
    RATIO = "RATIO"

class ScoringDirection(str, enum.Enum):
    HIGHER_BETTER = "HIGHER_BETTER"
    LOWER_BETTER = "LOWER_BETTER"

class HierarchyLevel(str, enum.Enum):
    PROVINCE = "PROVINCE"
    CENTER = "CENTER"
    CLUSTER = "CLUSTER"
    UNIT = "UNIT"
    STAFF = "STAFF"

class KPIDefinition(BaseModel):
    code: str
    display_name: str
    authority: KPIAuthority
    owner_engine: str         # e.g., "SummaryService", "LifecycleEngine"
    source_table: str         # e.g., "transactions", "monthly_analytics_summary"
    aggregation_type: AggregationType
    hierarchy_scope: List[HierarchyLevel]
    is_executive: bool = False
    can_escalate: bool = False
    unit: str = ""            # e.g., "VND", "Customers", "%"
    
    # [SCORING ENGINE FOUNDATION]
    scoring_direction: ScoringDirection = ScoringDirection.HIGHER_BETTER
    target_value: Optional[float] = None
    critical_threshold: Optional[float] = None # Value at which performance is unacceptable
    scoring_scale: float = 100.0 # Default max base score

class KPIRegistry:
    """
    [GOVERNANCE] Centralized Governed KPI Definition Registry.
    SSOT for all metric metadata in CRM V3.0.
    """
    _kpis: Dict[str, KPIDefinition] = {
        "REVENUE": KPIDefinition(
            code="REVENUE", display_name="Tổng Doanh thu", 
            authority=KPIAuthority.GOVERNED, source_table="transactions", 
            owner_engine="SummaryService", aggregation_type=AggregationType.SUM,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT, HierarchyLevel.STAFF],
            is_executive=True, can_escalate=True, unit="VND",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=100000000.0, critical_threshold=50000000.0
        ),
        "VOLUME": KPIDefinition(
            code="VOLUME", display_name="Tổng Sản lượng", 
            authority=KPIAuthority.GOVERNED, source_table="transactions", 
            owner_engine="SummaryService", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT, HierarchyLevel.STAFF],
            is_executive=True, can_escalate=True, unit="Đơn",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=1000.0, critical_threshold=200.0
        ),
        "ACTIVE_CUSTOMERS": KPIDefinition(
            code="ACTIVE_CUSTOMERS", display_name="KH Hiện hữu", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="KH",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=500.0
        ),
        "CHURN_CUSTOMERS": KPIDefinition(
            code="CHURN_CUSTOMERS", display_name="KH Rời bỏ", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=True, unit="KH",
            scoring_direction=ScoringDirection.LOWER_BETTER, target_value=10.0, critical_threshold=50.0
        ),
        "NEW_CUSTOMERS": KPIDefinition(
            code="NEW_CUSTOMERS", display_name="KH Mới", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="KH",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=50.0
        ),
        "POTENTIAL_LEADS": KPIDefinition(
            code="POTENTIAL_LEADS", display_name="KH Tiềm năng", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LeadTierEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="Leads",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=100.0
        ),
        "REVENUE_GROWTH": KPIDefinition(
            code="REVENUE_GROWTH", display_name="Tăng trưởng Doanh thu", 
            authority=KPIAuthority.DERIVED, source_table="calculated", 
            owner_engine="AnalyticsRouter", aggregation_type=AggregationType.PERCENT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT, HierarchyLevel.STAFF],
            is_executive=True, can_escalate=True, unit="%",
            scoring_direction=ScoringDirection.HIGHER_BETTER, target_value=10.0, critical_threshold=0.0
        ),
    }

    @classmethod
    def get_kpi(cls, code: str) -> Optional[KPIDefinition]:
        return cls._kpis.get(code.upper())

    @classmethod
    def list_executive_kpis(cls) -> List[KPIDefinition]:
        return [k for k in cls._kpis.values() if k.is_executive]

    @classmethod
    def list_kpis_by_level(cls, level: HierarchyLevel) -> List[KPIDefinition]:
        return [k for k in cls._kpis.values() if level in k.hierarchy_scope]

    @classmethod
    def validate_authority(cls, code: str, required_authority: List[KPIAuthority]) -> bool:
        kpi = cls.get_kpi(code)
        if not kpi:
            return False
        return kpi.authority in required_authority
