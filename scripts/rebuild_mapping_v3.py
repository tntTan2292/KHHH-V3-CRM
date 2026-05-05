import sys
import os
import logging
from sqlalchemy import text

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal, engine
from app.models import HierarchyNode, Transaction, NhanSu

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("REBUILD_MAPPING")

def rebuild_mapping():
    db = SessionLocal()
    try:
        logger.info("--- BAT DAU CAP NHAT MAPPING HIERARCHY V3 ---")
        
        # 1. Lay map Point
        point_map = {n.code: n.id for n in db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()}
        logger.info(f"Da nap {len(point_map)} diem phuc vu tu Danh muc.")
        
        # 2. Cap nhat point_id cho Transaction dua tren ma_dv_chap_nhan
        logger.info("Dang cap nhat point_id cho bang Transactions...")
        count = 0
        total_trans = db.query(Transaction).count()
        
        # Batch update de tang toc
        for code, node_id in point_map.items():
            res = db.query(Transaction).filter(Transaction.ma_dv_chap_nhan == code).update({"point_id": node_id})
            count += res
            
        db.commit()
        logger.info(f"Da cap nhat {count}/{total_trans} giao dich.")
        
        # 3. Cap nhat point_id cho NhanSu (Dua tren logic moi)
        logger.info("Dang cap nhat point_id cho Nhan su...")
        # Lay map toan bo Hierarchy de lookup linh hoat
        all_nodes = {n.code: n.id for n in db.query(HierarchyNode).all()}
        
        nhan_su_list = db.query(NhanSu).all()
        ns_count = 0
        for ns in nhan_su_list:
            target_id = None
            if ns.ma_bc in all_nodes: # uu tien cap Phuong/Xa
                target_id = all_nodes[ns.ma_bc]
            elif ns.ma_don_vi in all_nodes: # sau do den cap Trung tam
                target_id = all_nodes[ns.ma_don_vi]
                
            if target_id:
                ns.point_id = target_id
                ns_count += 1
        
        db.commit()
        logger.info(f"Da cap nhat {ns_count} nhan su vao Hierarchy.")
        
        logger.info("--- HOAN TAT ---")
        
    except Exception as e:
        logger.error(f"LOI: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    rebuild_mapping()
