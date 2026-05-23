from ..core.config_churn import ChurnClassificationConfig

class ChurnClassificationService:
    """
    [SSOT] Single Source of Truth cho logic phân loại Churn Suspect/Real.
    Dashboard và Filter List dùng chung class này để tránh lệ số liệu.
    """
    
    @staticmethod
    def get_suspect_sql_condition(id_col: str) -> str:
        """
        Trả về chuỗi điều kiện SQL WHERE để nhận diện KH Suspect (Nghi ngờ).
        """
        threshold = ChurnClassificationConfig.CHURN_SUSPECT_SINGLE_TX_THRESHOLD
        intl_max = ChurnClassificationConfig.CHURN_SUSPECT_INTL_MAX_TX
        
        sql = f"""
        (
            (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) <= {threshold}
        """
        
        if ChurnClassificationConfig.CHURN_SUSPECT_ENABLE_INTL_RULE:
            sql += f"""
            OR
            (
                (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) <= {intl_max}
                AND (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) > 0
                AND 
                (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) = 
                (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col} AND t.ma_dv = 'L')
            )
            """
            
        sql += "\n)"
        return sql
        
    @staticmethod
    def get_suspect_reason_sql_column(id_col: str) -> str:
        """
        Trả về chuỗi SQL CASE WHEN để tạo cột Ảo (Virtual Column) suspect_reason.
        """
        threshold = ChurnClassificationConfig.CHURN_SUSPECT_SINGLE_TX_THRESHOLD
        intl_max = ChurnClassificationConfig.CHURN_SUSPECT_INTL_MAX_TX
        
        sql = f"""
        CASE 
            WHEN (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) <= {threshold}
                THEN 'SINGLE_TRANSACTION'
        """
        
        if ChurnClassificationConfig.CHURN_SUSPECT_ENABLE_INTL_RULE:
            sql += f"""
            WHEN (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) <= {intl_max}
                 AND (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) > 0
                 AND (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col}) = 
                     (SELECT COUNT(id) FROM transactions t WHERE t.ma_kh = {id_col} AND t.ma_dv = 'L')
                THEN 'LOW_ACTIVITY_INTL_ONLY'
            """
            
        sql += "\nELSE NULL END"
        return sql
