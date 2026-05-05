import pandas as pd
import sys
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal, engine, Base
from app.models import Role, User, HierarchyNode, NhanSu, Transaction, Customer

# Password hashing (Using pbkdf2_sha256 due to bcrypt issue in this environment)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def init_system_3():
    db = SessionLocal()
    try:
        print("--- [INIT] Khoi tao He thong 3.0 ---")
        
        # 1. Tao Roles
        roles = [
            {"name": "ADMIN", "description": "Quan tri vien toan quyen"},
            {"name": "CENTER_LEADER", "description": "Lanh dao Trung tam (Van hanh/Kinh doanh)"},
            {"name": "REP_LEADER", "description": "Truong Dai dien Cum"},
            {"name": "COMMUNE_LEADER", "description": "Giam doc Phuong/Xa"},
            {"name": "STAFF", "description": "Nhan vien CSKH/Giao dich vien"}
        ]
        
        for r_data in roles:
            role = db.query(Role).filter(Role.name == r_data["name"]).first()
            if not role:
                role = Role(**r_data)
                db.add(role)
                print(f"    - Da tao Role: {r_data['name']}")
        db.commit()

        # 2. Tao Admin User (adminbdhue)
        admin_role = db.query(Role).filter(Role.name == "ADMIN").first()
        admin_user = db.query(User).filter(User.username == "adminbdhue").first()
        if not admin_user:
            admin_user = User(
                username="adminbdhue",
                hashed_password=get_password_hash("tnt@ttvhhue"),
                full_name="Administrator (BĐTP)",
                role_id=admin_role.id
            )
            db.add(admin_user)
            print(f"    - Da tao User Admin: adminbdhue / tnt@ttvhhue")
        db.commit()

        # [NEW] Clear Data de nạp lại chuẩn chỉ (theo yêu cầu sếp)
        print("--- [RESET] Dang xoa du lieu cu de nap lai chuan chi ---")
        db.query(Transaction).delete()
        db.query(NhanSu).delete()
        db.query(HierarchyNode).delete()
        db.commit()

        # 3. Import Catalog tu Excel
        excel_path = r"d:\Antigravity - Project\KHHH - Antigravity - V2\archive\data\BangDanhMuc.xlsx"
        print(f"--- [IMPORT] Dang nap Danh muc tu {os.path.basename(excel_path)} ---")
        
        # Doc cac sheet
        df_units = pd.read_excel(excel_path, sheet_name='DM_DON_VI_CHUAN')
        df_clusters = pd.read_excel(excel_path, sheet_name='DM_TD_BDPX_MAP')
        df_points = pd.read_excel(excel_path, sheet_name='DM_DIEM_PHUC_VU_CHUAN')
        df_ns = pd.read_excel(excel_path, sheet_name='DM_NHAN_SU_CHUAN')
        df_users = pd.read_excel(excel_path, sheet_name='DM_USERNAME')

        # Clean data
        df_units = df_units.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        df_clusters = df_clusters.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        df_points = df_points.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        df_ns = df_ns.map(lambda x: str(x).strip() if not pd.isna(x) else x)
        
        node_map = {} # code -> id

        # 3.1. LEVEL 1: UNITS (Cac Trung tam)
        print(f"    - Dang nap Don vi (Units)...")
        # Chi lay cac don vi cap cao (Ma_Don_Vi_Cha la 53 hoac nan, loai_don_vi khong phai BDPX/Phuong)
        for _, row in df_units.iterrows():
            code = row['Ma_Don_Vi']
            if code in node_map: continue
            
            # Neu la cap cao (Trung tam)
            if row['Loai_Don_Vi'] in ['CENTER', 'UNIT', 'VĂN PHÒNG', 'BAN']:
                node = db.query(HierarchyNode).filter(HierarchyNode.code == code).first()
                if not node:
                    node = HierarchyNode(code=code, name=row['Ten_Don_Vi'], type='UNIT')
                    db.add(node)
                    db.flush()
                node_map[code] = node.id

        # Mapping Parent-Child cho Units
        for _, row in df_units.iterrows():
            code = row['Ma_Don_Vi']
            parent_code = row['Ma_Don_Vi_Cha']
            if code in node_map and parent_code in node_map:
                node = db.get(HierarchyNode, node_map[code])
                node.parent_id = node_map[parent_code]
        db.commit()

        # 3.2. LEVEL 2: CLUSTERS (Cac Cum/Truong dai dien)
        print(f"    - Dang nap Cum (Clusters)...")
        cluster_codes = df_clusters['Ma_TD'].unique()
        for c_code in cluster_codes:
            if pd.isna(c_code) or c_code == 'nan': continue
            node = db.query(HierarchyNode).filter(HierarchyNode.code == c_code).first()
            if not node:
                node = HierarchyNode(code=c_code, name=f"Cụm {c_code}", type='CLUSTER')
                db.add(node)
                db.flush()
            node_map[c_code] = node.id
            
            # Tim don vi cha cho Cum (lay Ma_Don_Vi_Cha cua BDPX thuoc Cum nay)
            member_bdpx = df_clusters[df_clusters['Ma_TD'] == c_code]['Ma_Don_Vi_BDPX'].iloc[0]
            unit_info = df_units[df_units['Ma_Don_Vi'] == member_bdpx]
            if not unit_info.empty:
                parent_unit_code = unit_info['Ma_Don_Vi_Cha'].iloc[0]
                if parent_unit_code in node_map:
                    node.parent_id = node_map[parent_unit_code]
        db.commit()

        # 3.3. LEVEL 3: BDPX (Buu dien Phuong/Xa)
        print(f"    - Dang nap Phuong/Xa (BDPX)...")
        for _, row in df_clusters.iterrows():
            code = row['Ma_Don_Vi_BDPX']
            td_code = row['Ma_TD']
            if code in node_map: continue
            
            node = db.query(HierarchyNode).filter(HierarchyNode.code == code).first()
            if not node:
                node = HierarchyNode(code=code, name=row['Ten_Don_Vi_BDPX'], type='BDPX')
                db.add(node)
                db.flush()
            node_map[code] = node.id
            
            # Link to Cluster
            if td_code in node_map:
                node.parent_id = node_map[td_code]
        db.commit()

        # 3.4. LEVEL 4: POINTS (Diem phuc vu / madvChapnhan)
        print(f"    - Dang nap Diem phuc vu (Points)...")
        for _, row in df_points.iterrows():
            code = row['Ma_Diem']
            bdpx_code = row['Ma_Don_Vi_BDPX']
            if code in node_map: continue

            node = db.query(HierarchyNode).filter(HierarchyNode.code == code).first()
            if not node:
                node = HierarchyNode(code=code, name=row['Ten_Diem'], type='POINT')
                db.add(node)
                db.flush()
            node_map[code] = node.id
            
            # Link to BDPX
            if bdpx_code in node_map:
                node.parent_id = node_map[bdpx_code]
        db.commit()

        # 3.5. PERSONNEL (Nhan Su)
        print(f"    - Dang nap Nhan su & Mapping Hierarchy...")
        un_map = df_users.dropna(subset=['Mã nhân viên']).set_index('Mã nhân viên')['Tên tài khoản'].to_dict()
        
        for _, row in df_ns.iterrows():
            hr_id = row['Ma_NS']
            if pd.isna(hr_id): continue
            
            # Cleanup HR ID
            hr_id_clean = hr_id.replace('HR', '').lstrip('0') if hr_id.startswith('HR') else hr_id
            username = un_map.get(hr_id) or un_map.get(hr_id_clean) or un_map.get(int(hr_id_clean) if hr_id_clean.isdigit() else None)
            
            # Determine Point ID (link to most granular available)
            target_node_id = None
            if row['Ma_Diem_GD'] in node_map:
                target_node_id = node_map[row['Ma_Diem_GD']]
            elif row['Ma_BC'] in node_map:
                target_node_id = node_map[row['Ma_BC']]
            elif row['Ma_Don_Vi'] in node_map:
                target_node_id = node_map[row['Ma_Don_Vi']]

            ns = db.query(NhanSu).filter(NhanSu.hr_id == hr_id).first()
            if not ns:
                ns = NhanSu(hr_id=hr_id)
                db.add(ns)
            
            ns.full_name = row['Ho_ten']
            ns.username_app = username
            ns.ma_don_vi = row['Ma_Don_Vi']
            ns.ma_bc = row['Ma_BC']
            ns.chuc_vu = row['Chuc_vu']
            ns.email = row['Email']
            ns.point_id = target_node_id
            
        db.commit()

        print(f"===================================================")
        print(f"TONG KET:")
        print(f" - Hierarchy Nodes: {db.query(HierarchyNode).count()}")
        print(f" - Personnel: {db.query(NhanSu).count()}")
        print(f" - Admin User: OK")
        print(f"===================================================")

    except Exception as e:
        print(f"    - [!] LOI: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_system_3()
