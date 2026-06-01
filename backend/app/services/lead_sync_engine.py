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
            
            # 1.5 Deduplicate Data Nguồn (Hybrid Deduplication)
            # Chuẩn hóa CMS trước khi lọc trùng
            df_source['ma_cms_norm'] = df_source['ma_cms'].apply(lambda x: self.normalize_cms_code(x) if pd.notna(x) else None)
            
            # Tách tập có CMS và không có CMS
            df_with_cms = df_source[df_source['ma_cms_norm'].notna()]
            df_without_cms = df_source[df_source['ma_cms_norm'].isna()]
            
            # Lọc trùng theo mã CMS cho nhóm có CMS (Cùng CMS = 1 Khách hàng)
            df_with_cms = df_with_cms.drop_duplicates(subset=['ma_cms_norm'], keep='last')
            
            # Lọc trùng theo lead_id cho nhóm KHÔNG CÓ CMS
            df_without_cms = df_without_cms.drop_duplicates(subset=['lead_id'], keep='last')
            
            # Gộp lại
            df_source = pd.concat([df_with_cms, df_without_cms])
            
            # Xử lý triệt để: Nếu 1 lead_id vừa có dòng không CMS vừa có dòng có CMS, ưu tiên giữ dòng CÓ CMS
            df_source['has_cms'] = df_source['ma_cms_norm'].notna()
            df_source = df_source.sort_values(by=['has_cms'], ascending=[False])
            df_source = df_source.drop_duplicates(subset=['lead_id'], keep='first')
            
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
                    
            # 2. Lấy toàn bộ LeadPerformance hiện có để tối ưu Update
            existing_leads = self.db.query(LeadPerformance).all()
            cms_map = {l.ma_cms: l for l in existing_leads if l.ma_cms}
            lead_map = {l.lead_id: l for l in existing_leads if l.lead_id}
            
            log.source_row_count = len(df_source)
            
            for index, row in df_source.iterrows():
                lead_id = str(row['lead_id'])
                norm_cms = row['ma_cms_norm']
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
                    
                # HYBRID UPSERT LOGIC
                # Ưu tiên 1: Tìm theo CMS (Định danh cao nhất)
                # Ưu tiên 2: Tìm theo Lead_ID (Dành cho Lead chưa convert)
                obj = None
                if norm_cms and norm_cms in cms_map:
                    obj = cms_map[norm_cms]
                elif lead_id in lead_map:
                    obj = lead_map[lead_id]
                
                if obj:
                    # Update
                    # Kiểm tra xung đột: Nếu dòng hiện tại có lead_id khác với lead_id incoming,
                    # và lead_id incoming đang bị một dòng "Rác" (top-funnel) khác chiếm giữ
                    if obj.lead_id != lead_id and lead_id in lead_map:
                        conflict_obj = lead_map[lead_id]
                        if conflict_obj.id != obj.id:
                            # Xóa dòng rác để giải phóng lead_id
                            self.db.delete(conflict_obj)
                            self.db.flush()
                            
                    obj.lead_id = lead_id
                    if norm_cms:
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
