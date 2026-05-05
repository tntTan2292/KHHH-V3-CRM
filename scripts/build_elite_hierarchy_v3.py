import pandas as pd
import sys
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal, engine, Base
from app.models import HierarchyNode, Transaction, NhanSu

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ELITE_HIERARCHY")

def build_elite_hierarchy():
    db = SessionLocal()
    try:
        logger.info("--- [START] XAY DUNG CAY THU MUC ELITE 3.0 ---")
        
        # 0. Backup logic (Thông báo)
        logger.info("Yeu cau DBA sao luu database truoc khi thuc hien...")
        
        # 1. Reset Hierarchy Nodes cu (Giu lai data khac)
        logger.info("Dang lam sach bang hierarchy_nodes cu...")
        db.query(HierarchyNode).delete()
        db.commit()

        # 2. Doc Danh muc tu Excel
        excel_path = r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\archive\data\BangDanhMuc.xlsx"
        if not os.path.exists(excel_path):
            logger.error(f"Khong tim thay file danh muc tai: {excel_path}")
            return

        logger.info(f"Dang doc file: {os.path.basename(excel_path)}")
        df_units = pd.read_excel(excel_path, sheet_name='DM_DON_VI_CHUAN')
        df_clusters = pd.read_excel(excel_path, sheet_name='DM_TD_BDPX_MAP')
        df_points = pd.read_excel(excel_path, sheet_name='DM_DIEM_PHUC_VU_CHUAN')

        # Clean strings
        df_units = df_units.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        df_clusters = df_clusters.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        df_points = df_points.map(lambda x: str(x).strip() if not pd.isna(x) else x)

        node_map = {} # code -> id

        # --- CAP 1: ROOT (Buu dien TP Hue) ---
        root = HierarchyNode(code="53", name="Bưu điện Thành phố Huế", type="ROOT")
        db.add(root)
        db.flush()
        node_map["53"] = root.id
        logger.info(f"    [OK] Cap 1: {root.name}")

        # --- CAP 2: BRANCH (TTVH & TTKD) ---
        # Tu van tu Solution Architect: Mac dinh Hue co 2 khoi nay
        ttvh = HierarchyNode(code="TTVH", name="Trung tâm Vận hành (TTVH)", type="BRANCH", parent_id=root.id)
        ttkd = HierarchyNode(code="TTKD", name="Trung tâm Kinh doanh (TTKD)", type="BRANCH", parent_id=root.id)
        db.add_all([ttvh, ttkd])
        db.flush()
        node_map["TTVH"] = ttvh.id
        node_map["TTKD"] = ttkd.id
        logger.info(f"    [OK] Cap 2: TTVH & TTKD")

        # --- CAP 3: NHANH / CUM ---
        # Nhánh TTVH: Chi co To hien huu (Logic moi: 531120 se duoc map truc tiep len TTVH sau)
        # Chung ta tao mot node ao de Sếp de nhin
        to_hien_huu_parent = HierarchyNode(code="TTVH_HH", name="Tổ khách hàng hiện hữu - TTVH", type="CLUSTER", parent_id=ttvh.id)
        db.add(to_hien_huu_parent)
        db.flush()
        node_map["TTVH_HH"] = to_hien_huu_parent.id
        
        # Nhánh TTKD: Nap cac Cum tu Excel
        cluster_codes = df_clusters['Ma_TD'].unique()
        for c_code in cluster_codes:
            if pd.isna(c_code) or c_code == 'nan': continue
            c_name = f"Cụm {c_code}"
            node = HierarchyNode(code=c_code, name=c_name, type="CLUSTER", parent_id=ttkd.id)
            db.add(node)
            db.flush()
            node_map[c_code] = node.id
        logger.info(f"    [OK] Cap 3: Da nap {len(cluster_codes)} Cum thuoc TTKD")

        # --- CAP 4: PHUONG / XA (WARD) ---
        # Lay tu df_clusters
        for _, row in df_clusters.iterrows():
            code = row['Ma_Don_Vi_BDPX']
            name = row['Ten_Don_Vi_BDPX']
            parent_code = row['Ma_TD']
            
            if code in node_map: continue # Tranh trung lap
            
            parent_id = node_map.get(parent_code)
            if parent_id:
                node = HierarchyNode(code=code, name=name, type="WARD", parent_id=parent_id)
                db.add(node)
                db.flush()
                node_map[code] = node.id
        logger.info(f"    [OK] Cap 4: Da nap danh sach Phuong/Xa")

        # --- CAP 5: DIEM PHUC VU (POINT) ---
        point_count = 0
        for _, row in df_points.iterrows():
            code = row['Ma_Diem']
            name = row['Ten_Diem']
            ward_code = row['Ma_Don_Vi_BDPX']
            
            # Logic dac biet cho 531120: Map len TTVH (Cap 2)
            if code == '531120':
                parent_id = node_map["TTVH"]
                logger.info(f"    [SPECIAL] Mapping 531120 truc tiep vao TTVH")
            else:
                parent_id = node_map.get(ward_code)
            
            if parent_id:
                node = HierarchyNode(code=code, name=name, type="POINT", parent_id=parent_id)
                db.add(node)
                db.flush()
                node_map[code] = node.id
                point_count += 1
        
        db.commit()
        logger.info(f"    [OK] Cap 5: Da nap {point_count} Diem phuc vu")

        # --- [RE-MAPPING] CAP NHAT POINT_ID CHO TRANSACTION & NHAN SU ---
        logger.info("Dang tien hanh Mapping lai toan bo Giao dich & Nhan su...")
        
        # Mapping POINT code to ID
        point_id_map = {n.code: n.id for n in db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()}
        
        # Batch update Transaction
        update_count = 0
        for code, node_id in point_id_map.items():
            res = db.query(Transaction).filter(Transaction.ma_dv_chap_nhan == code).update({"point_id": node_id})
            update_count += res
        db.commit()
        logger.info(f"    [DONE] Da re-mapping {update_count} giao dich.")

        # Re-mapping Nhan Su
        ns_list = db.query(NhanSu).all()
        ns_update = 0
        for ns in ns_list:
            if ns.ma_bc in node_map:
                ns.point_id = node_map[ns.ma_bc]
                ns_update += 1
            elif ns.ma_don_vi in node_map:
                ns.point_id = node_map[ns.ma_don_vi]
                ns_update += 1
        db.commit()
        logger.info(f"    [DONE] Da re-mapping {ns_update} nhan su.")

        logger.info("--- [FINISH] HE THONG CAY THU MUC 3.0 DA SAN SANG ---")

    except Exception as e:
        logger.error(f"LOI NGHIE TRONG: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    build_elite_hierarchy()
