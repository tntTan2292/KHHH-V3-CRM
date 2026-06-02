import sqlite3
import pandas as pd
from sqlalchemy.orm import Session
from ..models import LeadPerformance, LeadSyncLog, Transaction, HierarchyNode
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
            
            # Lấy toàn bộ dữ liệu từ bảng SSOT Materialized View
            query = "SELECT lead_id, ma_cms, lead_name as customer_name, lead_expected_revenue, primary_ma_diem_gd, primary_ma_bdpx, contact_created_at FROM journey_final_ssot"
            df_source = pd.read_sql_query(query, conn)
            conn.close()
            
            nodes = self.db.query(HierarchyNode).all()
            
            code_to_id = {str(n.code).strip().upper(): n.id for n in nodes if n.code}
            
            def get_ssot_point_id(row):
                pt = str(row.get('primary_ma_diem_gd', '')).strip().upper()
                if pt and pt != 'NAN' and pt != 'NONE' and pt in code_to_id:
                    return code_to_id[pt]
                    
                wd = str(row.get('primary_ma_bdpx', '')).strip().upper()
                if wd and wd != 'NAN' and wd != 'NONE' and wd in code_to_id:
                    return code_to_id[wd]
                    
                return None
                
            df_source['point_id'] = df_source.apply(get_ssot_point_id, axis=1)
            
            # Chuẩn hóa CMS
            df_source['ma_cms_norm'] = df_source['ma_cms'].apply(lambda x: self.normalize_cms_code(x) if pd.notna(x) else None)
            
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
            lead_map = {l.lead_id: l for l in existing_leads if l.lead_id is not None}
            
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
                
                best_point_id = int(row['point_id']) if pd.notna(row['point_id']) else None
                
                # Tìm Actual Revenue
                actual_rev = 0.0
                tx_count = 0
                if norm_cms and norm_cms in actual_rev_map:
                    actual_rev = actual_rev_map[norm_cms]['revenue']
                    tx_count = actual_rev_map[norm_cms]['count']
                    
                completion_rate = 0.0
                if expected_rev > 0:
                    completion_rate = (actual_rev / expected_rev) * 100.0
                    
                # Cập nhật theo đúng lead_id (SSOT 1:1)
                obj = None
                if lead_id in lead_map:
                    obj = lead_map[lead_id]
                
                if obj:
                    # Update
                    if norm_cms:
                        obj.ma_cms = norm_cms
                    
                    created_at_source = pd.to_datetime(row.get('contact_created_at')) if pd.notna(row.get('contact_created_at')) else None
                    if created_at_source:
                        obj.created_at_source = created_at_source
                        
                    obj.ten_kh = row.get('lead_name', row.get('customer_name', ''))
                    obj.expected_revenue = expected_rev
                    obj.actual_revenue = actual_rev
                    obj.actual_transactions_count = tx_count
                    obj.completion_rate = completion_rate
                    if best_point_id:
                        obj.point_id = best_point_id
                    obj.last_synced_at = datetime.datetime.now()
                    updated += 1
                else:
                    # Insert
                    new_obj = LeadPerformance(
                        lead_id=lead_id,
                        ma_cms=norm_cms,
                        ten_kh=row.get('lead_name', row.get('customer_name', '')),
                        expected_revenue=expected_rev,
                        actual_revenue=actual_rev,
                        actual_transactions_count=tx_count,
                        completion_rate=completion_rate,
                        point_id=best_point_id,
                        created_at_source=pd.to_datetime(row.get('contact_created_at')) if pd.notna(row.get('contact_created_at')) else None
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
