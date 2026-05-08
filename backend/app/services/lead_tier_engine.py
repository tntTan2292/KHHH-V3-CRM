import logging

logger = logging.getLogger(__name__)

class LeadTierEngine:
    """
    [GOVERNANCE] Centralized Lead Tier Engine.
    Authoritative source for ranking potential leads (Diamond, Gold, Silver, Normal).
    """

    # Centralized Thresholds
    # In a future phase, these can be moved to database-driven config
    THRESHOLDS = {
        "DIAMOND": {"revenue": 5000000, "orders": 5},
        "GOLD":    {"revenue": 2000000, "orders": 3},
        "SILVER":  {"revenue": 500000,  "orders": 2},
    }

    @staticmethod
    def classify_lead_rank(revenue: float, orders: int) -> str:
        """
        [GOVERNANCE] Shared ranking logic to ensure consistency across Services & Dashboards.
        Input: revenue (float), orders (int)
        Output: "KIM CƯƠNG", "VÀNG", "BẠC", "THƯỜNG"
        """
        # 1. DIAMOND: High Revenue AND High frequency
        if (revenue >= LeadTierEngine.THRESHOLDS["DIAMOND"]["revenue"] and 
            orders >= LeadTierEngine.THRESHOLDS["DIAMOND"]["orders"]):
            return "KIM CƯƠNG"
        
        # 2. GOLD: Moderate Revenue AND Moderate frequency
        if (revenue >= LeadTierEngine.THRESHOLDS["GOLD"]["revenue"] and 
            orders >= LeadTierEngine.THRESHOLDS["GOLD"]["orders"]):
            return "VÀNG"
            
        # 3. SILVER: Low Revenue OR Low frequency (Momentum leads)
        if (revenue >= LeadTierEngine.THRESHOLDS["SILVER"]["revenue"] or 
            orders >= LeadTierEngine.THRESHOLDS["SILVER"]["orders"]):
            return "BẠC"
            
        # 4. NORMAL: Everything else
        return "THƯỜNG"

    @staticmethod
    def get_tier_color(rank: str) -> str:
        """Helper for UI consistency if needed at backend level"""
        colors = {
            "KIM CƯƠNG": "#70d6ff",
            "VÀNG": "#ffd670",
            "BẠC": "#e9ecef",
            "THƯỜNG": "#ffffff"
        }
        return colors.get(rank, "#ffffff")
