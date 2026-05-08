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
            is_executive=True, can_escalate=True, unit="VND"
        ),
        "VOLUME": KPIDefinition(
            code="VOLUME", display_name="Tổng Sản lượng", 
            authority=KPIAuthority.GOVERNED, source_table="transactions", 
            owner_engine="SummaryService", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT, HierarchyLevel.STAFF],
            is_executive=True, can_escalate=True, unit="Đơn"
        ),
        "ACTIVE_CUSTOMERS": KPIDefinition(
            code="ACTIVE_CUSTOMERS", display_name="KH Hiện hữu", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="KH"
        ),
        "CHURN_CUSTOMERS": KPIDefinition(
            code="CHURN_CUSTOMERS", display_name="KH Rời bỏ", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=True, unit="KH"
        ),
        "NEW_CUSTOMERS": KPIDefinition(
            code="NEW_CUSTOMERS", display_name="KH Mới", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LifecycleEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="KH"
        ),
        "POTENTIAL_LEADS": KPIDefinition(
            code="POTENTIAL_LEADS", display_name="KH Tiềm năng", 
            authority=KPIAuthority.SSOT, source_table="monthly_analytics_summary", 
            owner_engine="LeadTierEngine", aggregation_type=AggregationType.COUNT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT],
            is_executive=True, can_escalate=False, unit="Leads"
        ),
        "REVENUE_GROWTH": KPIDefinition(
            code="REVENUE_GROWTH", display_name="Tăng trưởng Doanh thu", 
            authority=KPIAuthority.DERIVED, source_table="calculated", 
            owner_engine="AnalyticsRouter", aggregation_type=AggregationType.PERCENT,
            hierarchy_scope=[HierarchyLevel.PROVINCE, HierarchyLevel.CENTER, HierarchyLevel.CLUSTER, HierarchyLevel.UNIT, HierarchyLevel.STAFF],
            is_executive=True, can_escalate=True, unit="%"
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
