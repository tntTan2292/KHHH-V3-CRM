import sqlite3
import pandas as pd
from sqlalchemy.orm import Session
from ..models import LeadPerformance, LeadSyncLog, Transaction
from sqlalchemy import func
import datetime

CRM_DASHBOARD_DB_PATH = r"d:\Antigravity - Project\crm_dashboard_bd_hue\data\crm_dashboard.db"

class LeadSyncEngine:
    def __init__(self, db: Session):
        self.db = db
        
    def normalize_cms_code(self, code: str):
        if not code:
            return None
        return str(code).strip().upper()

    def run_sync(self):
        log = LeadSyncLog(status="RUNNING")
        self.db.add(log)
        self.db.commit()
        
        try:
            # 1. Extract from CRM_Dashboard
            conn = sqlite3.connect(CRM_DASHBOARD_DB_PATH)
            
            # Khách hàng đã được phân quyền và có đầy đủ thông tin từ journey_fact
            query = """
                SELECT 
                    lead_id,
                    ma_cms,
                    lead_name,
                    lead_expected_revenue
                FROM journey_fact
            """
            df_source = pd.read_sql_query(query, conn)
            conn.close()
            
            # Deduplicate by lead_id (journey_fact might have multiple rows per lead)
            df_source = df_source.drop_duplicates(subset=['lead_id'], keep='last')
            
            log.source_row_count = len(df_source)
            
            inserted = 0
            updated = 0
            
            # Lấy doanh thu thực tế từ Transactions của V3.0 (nhóm theo ma_kh)
            actual_revenues = self.db.query(
                Transaction.ma_kh,
                func.sum(Transaction.doanh_thu).label('total_revenue'),
                func.count(Transaction.id).label('tx_count')
            ).filter(
                Transaction.ma_kh.isnot(None)
            ).group_by(Transaction.ma_kh).all()
            
            # Map ma_kh -> (revenue, count)
            actual_rev_map = {}
            for row in actual_revenues:
                if row.ma_kh:
                    norm_code = self.normalize_cms_code(row.ma_kh)
                    actual_rev_map[norm_code] = {
                        'revenue': float(row.total_revenue or 0),
                        'count': int(row.tx_count or 0)
                    }
                    
            # 2. Lấy toàn bộ LeadPerformance hiện có để tối ưu Update (không query từng dòng)
            existing_leads = self.db.query(LeadPerformance).all()
            existing_map = {l.lead_id: l for l in existing_leads if l.lead_id}
            
            # Lưu ý: Theo nguyên tắc thép, chúng ta đồng bộ toàn bộ dòng (kể cả chưa có mã CMS) 
            # để đo lường Tầng 1 (Toàn bộ Lead) và Tầng 2 (Có cam kết). 
            # Các khách hàng có mã CMS sẽ được map với thực tế.
            
            for index, row in df_source.iterrows():
                lead_id = str(row['lead_id'])
                norm_cms = self.normalize_cms_code(row['ma_cms']) if pd.notna(row['ma_cms']) else None
                expected_rev_str = row['lead_expected_revenue']
                expected_rev = 0.0
                if pd.notna(expected_rev_str) and str(expected_rev_str).strip() != '':
                    try:
                        expected_rev = float(expected_rev_str)
                    except ValueError:
                        pass
                
                # Tìm Actual Revenue
                actual_rev = 0.0
                tx_count = 0
                if norm_cms and norm_cms in actual_rev_map:
                    actual_rev = actual_rev_map[norm_cms]['revenue']
                    tx_count = actual_rev_map[norm_cms]['count']
                    
                completion_rate = 0.0
                if expected_rev > 0:
                    completion_rate = (actual_rev / expected_rev) * 100.0
                    
                # Upsert by lead_id (Because lead_id is the primary trace key from CRM_Dashboard for ALL leads. 
                # Wait, the user specifically said: "Chỉ sử dụng mã CMS làm khóa nghiệp vụ. Lead_ID không tham gia vào logic đối chiếu doanh thu."
                # Nhưng nếu khách hàng chưa có CMS (Tầng 1, Tầng 2) thì sao?
                # Tầng 1 và 2 vẫn có thể update dựa vào lead_id để hứng được.
                # Let's strictly update by lead_id from source to maintain the total pool, 
                # but matching with V3.0 Transactions relies purely on ma_cms.
                
                if lead_id in existing_map:
                    # Update
                    obj = existing_map[lead_id]
                    obj.ma_cms = norm_cms
                    obj.ten_kh = row['lead_name']
                    obj.expected_revenue = expected_rev
                    obj.actual_revenue = actual_rev
                    obj.actual_transactions_count = tx_count
                    obj.completion_rate = completion_rate
                    obj.last_synced_at = datetime.datetime.now()
                    updated += 1
                else:
                    # Insert
                    new_obj = LeadPerformance(
                        lead_id=lead_id,
                        ma_cms=norm_cms,
                        ten_kh=row['lead_name'],
                        expected_revenue=expected_rev,
                        actual_revenue=actual_rev,
                        actual_transactions_count=tx_count,
                        completion_rate=completion_rate
                    )
                    self.db.add(new_obj)
                    inserted += 1
                    
            self.db.commit()
            
            log.status = "SUCCESS"
            log.inserted_count = inserted
            log.updated_count = updated
            log.sync_completed_at = datetime.datetime.now()
            self.db.commit()
            
            return {"status": "success", "inserted": inserted, "updated": updated, "total_source": len(df_source)}
            
        except Exception as e:
            self.db.rollback()
            log.status = "FAILED"
            log.error_message = str(e)
            log.sync_completed_at = datetime.datetime.now()
            self.db.commit()
            raise e
