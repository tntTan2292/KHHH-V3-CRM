from .config_segments import (
    THRESHOLD_BRONZE_REV,
    THRESHOLD_BRONZE_SHIP,
    THRESHOLD_DIAMOND_REV,
    THRESHOLD_DIAMOND_SHIP,
    THRESHOLD_GOLD_REV,
    THRESHOLD_GOLD_SHIP,
)


def classify_potential_rank(revenue: float, shipment_count: int) -> str:
    revenue = revenue or 0.0
    shipment_count = shipment_count or 0

    # Value tiers must satisfy both revenue and shipment thresholds.
    if revenue > 0 and (
        revenue >= THRESHOLD_DIAMOND_REV and shipment_count >= THRESHOLD_DIAMOND_SHIP
    ):
        return "Kim Cương"

    if revenue > 0 and (
        revenue >= THRESHOLD_GOLD_REV and shipment_count >= THRESHOLD_GOLD_SHIP
    ):
        return "Vàng"

    if revenue > 0 and (
        revenue >= THRESHOLD_BRONZE_REV and shipment_count >= THRESHOLD_BRONZE_SHIP
    ):
        return "Bạc"

    return "Thường"
