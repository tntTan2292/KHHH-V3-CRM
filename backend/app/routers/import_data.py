import os
import logging
import pandas as pd
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from ..models import Customer, Transaction, SyncLog
from ..schemas import ImportResult
from ..services.excel_reader import read_file1, read_file2, find_all_bf_files
from ..services.sftp_service import SFTPManager
from ..services.rfm import compute_rfm
from ..core.cache import CacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

import_status = {"running": False, "message": "Chưa khởi tạo", "done": False, "error": None}

def do_import(db: Session, full_reset: bool = True, target_files: list = None):
    global import_status
    import_status = {"running": True, "message": "Đang chuẩn bị dữ liệu...", "done": False, "error": None}
    
    try:
        if full_reset:
            import_status["message"] = "Đang xóa dữ liệu cũ để nạp mới..."
            db.query(Transaction).delete()
            db.query(Customer).delete()
            db.commit()
            # Xóa cache khi reset toàn bộ dữ liệu
            CacheService.clear()

        # 1. Đọc File 1 - Khách hàng Hiện Hữu (Chỉ làm nếu full_reset hoặc database trống)
        existing_customers_count = db.query(Customer).count()
        if full_reset or existing_customers_count == 0:
            import_status["message"] = "Đang nạp danh sách khách hàng KHHH..."
            df1 = read_file1()
            customers_imported = 0
            for _, row in df1.iterrows():
                ma = str(row.get("ma_crm_cms", "")).strip().upper()
                if not ma or ma == 'NAN': continue
                
                c = Customer(
                    stt=int(row.get("stt", 0) or 0),
                    ma_crm_cms=ma,
                    loai_kh=row.get("loai_kh", ""),
                    nhom_kh="Khách hàng hiện hữu",
                    ten_kh=row.get("ten_kh", ""),
                    ten_bc_vhx=row.get("ten_bc_vhx", ""),
                    bdp_x=row.get("bdp_x", ""),
                    cuoc_dac_thu=row.get("cuoc_dac_thu", ""),
                    nguoi_rs_bg_ttkd=row.get("nguoi_rs_bg_ttkd", ""),
                    nguoi_rs_bg_ttvh=row.get("nguoi_rs_bg_ttvh", ""),
                    don_vi_gan_hd_cms=row.get("don_vi_gan_hd_cms", ""),
                    da_gui_hd_vly=row.get("da_gui_hd_vly", ""),
                    tinh_hinh_ra_soat=row.get("tinh_hinh_ra_soat", ""),
                    tinh_hinh_ban_giao_cms=row.get("tinh_hinh_ban_giao_cms", ""),
                    don_vi=row.get("don_vi", ""),
                    tong_doanh_thu=0.0,
                    is_churn=0,
                )
                db.add(c)
                customers_imported += 1
            db.commit()

        # 3. Quét tất cả file BF (hoặc chỉ dùng file được chỉ định)
        if target_files:
            bf_files = target_files
        else:
            bf_files = find_all_bf_files()
            
        if not bf_files:
            if not target_files:
                raise Exception("Không tìm thấy bất kỳ file giao dịch BF nào.")
            else:
                import_status["message"] = "Đã hoàn thành - Không có file mới"
                return

        # 2. Chuẩn bị Map cho Hierarchy (Lấy tất cả các loại node để đảm bảo ánh xạ đầy đủ)
        from ..models import HierarchyNode
        point_map = {n.code: n.id for n in db.query(HierarchyNode).all()}

        total_transactions = 0
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        for filepath in bf_files:
            filename = os.path.basename(filepath)
            import_status["message"] = f"Đang nạp {filename}..."
            df_bf = read_file2(filepath)
            # ... (giữ nguyên logic nạp batch_data và upsert hiện tại)
            df_bf = df_bf.where(pd.notnull(df_bf), None)
            batch_data = []
            for _, row in df_bf.iterrows():
                shbg = row.get("shbg")
                if not shbg: continue
                
                ma_dv_chap_nhan = str(row.get("ma_dv_chap_nhan", "530000"))
                p_id = point_map.get(ma_dv_chap_nhan)
                
                record = {
                    "shbg": str(shbg),
                    "ma_dv": str(row.get("ma_dv", "")),
                    "username": str(row.get("username", "")),
                    "ma_kh": str(row.get("ma_kh", "")).strip().upper() if row.get("ma_kh") and str(row.get("ma_kh")).lower() != 'nan' else None,
                    "ten_nguoi_gui": str(row.get("ten_nguoi_gui", "")),
                    "dia_chi_nguoi_gui": str(row.get("dia_chi_nguoi_gui", "")),
                    "dia_chi_nguoi_nhan": str(row.get("dia_chi_goc", "")),
                    "tinh_thanh_moi": str(row.get("tinh_thanh_moi", "")) if row.get("tinh_thanh_moi") else None,
                    "lien_tinh_noi_tinh": str(row.get("lien_tinh_noi_tinh", "")) if row.get("lien_tinh_noi_tinh") else None,
                    "trong_nuoc_quoc_te": str(row.get("trong_nuoc_quoc_te", "")) if row.get("trong_nuoc_quoc_te") else None,
                    "ngay_chap_nhan": row.get("ngay_chap_nhan"),
                    "kl_tinh_cuoc": float(row.get("kl_tinh_cuoc", 0) or 0),
                    "cuoc_chinh_co_vat": float(row.get("cuoc_chinh_co_vat", 0) or 0),
                    "phu_phi_xang_dau_co_vat": float(row.get("phu_phi_xang_dau_co_vat", 0) or 0),
                    "phu_phi_vung_xa_co_vat": float(row.get("phu_phi_vung_xa_co_vat", 0) or 0),
                    "phu_phi_khac_co_vat": float(row.get("phu_phi_khac_co_vat", 0) or 0),
                    "cuoc_thu_ho": float(row.get("cuoc_thu_ho", 0) or 0),
                    "cuoc_gtgt": float(row.get("cuoc_gtgt", 0) or 0),
                    "doanh_thu": float(row.get("doanh_thu", 0) or 0),
                    "ma_dv_chap_nhan": ma_dv_chap_nhan,
                    "point_id": p_id,
                    "dich_vu_chinh": str(row.get("dich_vu_chinh", "")),
                }
                batch_data.append(record)
                total_transactions += 1
                if len(batch_data) >= 1000:
                    db.execute(sqlite_insert(Transaction).values(batch_data))
                    db.commit()
                    batch_data = []

            if batch_data:
                db.execute(sqlite_insert(Transaction).values(batch_data))
                db.commit()

        # ... (giữ nguyên logic đồng bộ KH, RFM...)
        import_status["message"] = "Đồng bộ Khách hàng & RFM..."
        db.execute(text("""
            INSERT INTO customers (ma_crm_cms, ten_kh, loai_kh, nhom_kh, is_churn, tong_doanh_thu)
            SELECT t.ma_kh, t.ten_nguoi_gui, 'Ngoài danh mục KHHH', 'Khách hàng mới', 0, 0
            FROM transactions t
            LEFT JOIN customers c ON t.ma_kh = c.ma_crm_cms
            WHERE c.ma_crm_cms IS NULL AND t.ma_kh IS NOT NULL AND t.ma_kh NOT IN ('', 'nan', 'NAN', 'None')
            GROUP BY t.ma_kh
        """))
        db.commit()
        db.execute(text("""
            UPDATE customers SET tong_doanh_thu = (SELECT SUM(doanh_thu) FROM transactions WHERE transactions.ma_kh = customers.ma_crm_cms),
            is_churn = CASE WHEN (SELECT SUM(doanh_thu) FROM transactions WHERE transactions.ma_kh = customers.ma_crm_cms) > 0 THEN 0 ELSE 1 END
        """))
        db.commit()
        # RFM (Tối ưu nhẹ cho data lớn)
        all_customers = db.query(Customer).all()
        cust_list_for_rfm = [{"ma_crm_cms": c.ma_crm_cms, "tong_doanh_thu": c.tong_doanh_thu} for c in all_customers]
        rfm_results = compute_rfm(cust_list_for_rfm)
        rfm_map = {r["ma_crm_cms"]: r["rfm_segment"] for r in rfm_results}
        for c in all_customers:
            c.rfm_segment = rfm_map.get(c.ma_crm_cms, "Thường")
        db.commit()

        import_status = {
            "running": False,
            "message": f"✅ Hoàn thành! Đã nạp {total_transactions} giao dịch mới.",
            "done": True, "error": None
        }
        return total_transactions # Bổ sung return để các worker khác biết số lượng
    except Exception as e:
        logger.error(f"Lỗi khi import: {e}", exc_info=True)
        db.rollback()
        import_status = {"running": False, "message": f"❌ Lỗi: {e}", "done": False, "error": str(e)}

@router.get("/sftp-check")
async def check_sftp_sync(db: Session = Depends(get_db)):
    """Kiểm tra Gap dữ liệu và phiên bản mới trên SFTP"""
    try:
        all_remote_folders = SFTPManager.list_folders()
        # Chỉ lấy các folder từ ngày 31/03/2026 trở đi theo lệnh sếp
        remote_folders = [f for f in all_remote_folders if f >= "20260331"]
        
        # Lấy lịch sử đã sync
        synced_folders = {r.folder_name: r for r in db.query(SyncLog).all()}
        
        gaps = []
        updates = []
        
        for folder in remote_folders:
            target_file = SFTPManager.get_target_bf_file(folder)
            if not target_file: continue
            
            if folder not in synced_folders:
                gaps.append({"folder": folder, "file": target_file["name"], "size": target_file["size"]})
            else:
                log = synced_folders[folder]
                # Nếu dung lượng hoặc mtime khác biệt -> Cập nhật mới từ TCT
                if target_file["size"] != log.file_size:
                    updates.append({"folder": folder, "file": target_file["name"], "old_size": log.file_size, "new_size": target_file["size"]})
        
        return {"gaps": gaps, "updates": updates, "total_remote": len(remote_folders)}
    except Exception as e:
        return {"error": str(e)}

@router.post("/sftp-sync")
async def sync_sftp(background_tasks: BackgroundTasks, db: Session = Depends(get_db), folders: list = None):
    """Kích hoạt đồng bộ các folder chỉ định hoặc toàn bộ gap"""
    if import_status["running"]:
        return {"success": False, "message": "Hệ thống đang bận..."}
    
    background_tasks.add_task(sync_worker, db, folders)
    return {"success": True, "message": "Bắt đầu đồng bộ SFTP..."}

async def sync_worker(db_in: Session, folders: list):
    """Worker xử lý đồng bộ SFTP chạy ngầm - Sử dụng Session riêng biệt"""
    global import_status
    import_status = {"running": True, "message": "Đang kết nối SFTP...", "done": False, "error": None}
    
    # Tạo session mới riêng cho worker để tránh lỗi đóng session của FastAPI
    db = SessionLocal()
    try:
        # 1. Kiểm tra danh sách cần nạp
        check = await check_sftp_sync(db)
        to_sync = folders or [g["folder"] for g in check.get("gaps", [])]
        
        if not to_sync:
            import_status = {"running": False, "message": "✅ Hệ thống đã đầy đủ dữ liệu.", "done": True, "error": None}
            return

        downloaded_files = []
        for f_name in to_sync:
            import_status["message"] = f"Đang tải dữ liệu ngày {f_name}..."
            target = SFTPManager.get_target_bf_file(f_name)
            if not target: continue
            
            local_path = SFTPManager.download_file(f_name, target["name"])
            downloaded_files.append(local_path)
            
            # Lưu log
            log = db.query(SyncLog).filter(SyncLog.folder_name == f_name).first()
            if not log:
                log = SyncLog(folder_name=f_name)
                db.add(log)
            log.file_name = target["name"]
            log.file_size = target["size"]
            log.remote_mtime = target["mtime"]
            log.status = "COMPLETED"
            db.commit()
            
        # 2. Chạy Import Incremental
        import_status["message"] = "Đang nạp dữ liệu vào Database..."
        total = do_import(db, full_reset=False, target_files=downloaded_files)
        
        import_status = {
            "running": False, 
            "message": f"✅ Thành công! Đã nạp {total} giao dịch mới của tháng 04 vào SQLite.", 
            "done": True, "error": None
        }
        # Tự động xóa cache sau khi đồng bộ dữ liệu mới thành công
        CacheService.clear()
        logger.info("Sync completed - Cache cleared to ensure data freshness.")
    except Exception as e:
        logger.error(f"Sync Worker Error: {e}")
        import_status = {"running": False, "message": f"❌ Lỗi: {e}", "done": False, "error": str(e)}
    finally:
        db.close() # Luôn đóng session worker

@router.post("", response_model=ImportResult)
async def trigger_import(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if import_status.get("running"):
        return ImportResult(success=False, message="Đang import...", customers_imported=0, transactions_imported=0)
    
    background_tasks.add_task(do_import, db, full_reset=True)
    return ImportResult(success=True, message="Bắt đầu Import (Full Reset)", customers_imported=0, transactions_imported=0)

@router.get("/status")
async def get_import_status():
    return import_status

@router.post("/smart-auto-sync")
async def smart_auto_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Logic tự động hóa 'Elite': 
    1. Kiểm tra ngày hiện tại (T) và ngày cần có dữ liệu (T-1).
    2. Nếu chưa có dữ liệu T-1 trong SyncLog, tự động kích hoạt sync ngầm.
    """
    from datetime import datetime, timedelta
    
    # 1. Xác định ngày T-1 (Dưới định dạng YYYYMMDD để khớp với folder SFTP)
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
    
    # 2. Kiểm tra xem đã sync ngày yesterday chưa
    exists = db.query(SyncLog).filter(SyncLog.folder_name == yesterday).first()
    
    if exists:
        return {"success": True, "need_sync": False, "message": f"Dữ liệu ngày {yesterday} đã tồn tại."}
    
    # 3. Nếu chưa có, kiểm tra xem có đang chạy sync không
    if import_status["running"]:
        return {"success": True, "need_sync": True, "message": "Hệ thống đang thực hiện đồng bộ tự động..."}
    
    # 4. Kích hoạt sync ngầm (Tự động quét toàn bộ gap bao gồm cả T-1)
    background_tasks.add_task(sync_worker, db, None)
    
    return {
        "success": True, 
        "need_sync": True, 
        "message": f"Phát hiện thiếu dữ liệu ngày {yesterday}. Đang tự động nạp dữ liệu từ WinSCP...",
        "target_date": yesterday
    }

enrich_status = {"running": False, "processed": 0, "total": 0, "percent": 0, "done": False, "error": None}

def do_enrich(db_session: Session, df: pd.DataFrame):
    global enrich_status
    try:
        # Tìm cột mã KH
        code_col = None
        for col in df.columns:
            if str(col).strip().lower() in ['ma_kh', 'ma_crm_cms', 'mã crm/cms', 'mã kh']:
                code_col = col
                break
        
        if not code_col:
            enrich_status = {"running": False, "processed": 0, "total": 0, "percent": 0, "done": True, "error": "Không tìm thấy cột mã khách hàng."}
            return

        # 3. Chuẩn bị mapping cột
        mapping = {
            'dia_chi': ['dia_chi', 'địa chỉ', 'dia_chi_kh'],
            'dien_thoai': ['dien_thoai', 'điện thoại', 'dien_thoai_lh', 'sdt', 'số điện thoại'],
            'nguoi_lien_he': ['nguoi_lien_he', 'người liên hệ', 'ho_ten_lh'],
            'so_hop_dong': ['so_hop_dong', 'số hợp đồng', 'so_hd'],
            'thoi_han_hop_dong': ['thoi_han_hop_dong', 'ngày bắt đầu', 'ngay_bd'],
            'thoi_han_ket_thuc': ['thoi_han_ket_thuc', 'ngày kết thúc', 'ngay_kt']
        }
        
        col_map = {}
        for target, aliases in mapping.items():
            for col in df.columns:
                if str(col).strip().lower() in aliases:
                    col_map[target] = col
                    break

        def format_val(val):
            if pd.isna(val) or str(val).lower() == 'nan':
                return None
            if isinstance(val, (int, float)):
                from datetime import datetime
                try:
                    if val > 30000 and val < 60000:
                        dt = datetime.fromordinal(datetime(1900, 1, 1).toordinal() + int(val) - 2)
                        return dt.strftime('%d/%m/%Y')
                except: pass
            return str(val).strip()

        total = len(df)
        enrich_status = {"running": True, "processed": 0, "total": total, "percent": 0, "done": False, "error": None}
        
        for index, row in df.iterrows():
            ma = "".join(str(row[code_col]).split()) if pd.notna(row[code_col]) else None
            if ma:
                customer = db_session.query(Customer).filter(Customer.ma_crm_cms == ma).first()
                if customer:
                    if 'dia_chi' in col_map: customer.dia_chi = format_val(row[col_map['dia_chi']])
                    if 'dien_thoai' in col_map: customer.dien_thoai = format_val(row[col_map['dien_thoai']])
                    if 'nguoi_lien_he' in col_map: customer.nguoi_lien_he = format_val(row[col_map['nguoi_lien_he']])
                    if 'so_hop_dong' in col_map: customer.so_hop_dong = format_val(row[col_map['so_hop_dong']])
                    if 'thoi_han_hop_dong' in col_map: customer.thoi_han_hop_dong = format_val(row[col_map['thoi_han_hop_dong']])
                    if 'thoi_han_ket_thuc' in col_map: customer.thoi_han_ket_thuc = format_val(row[col_map['thoi_han_ket_thuc']])
            
            processed = index + 1
            if processed % 50 == 0 or processed == total:
                db_session.commit()
                enrich_status["processed"] = processed
                enrich_status["percent"] = int(processed * 100 / total)

        enrich_status["done"] = True
        enrich_status["running"] = False
        enrich_status["message"] = f"Đã cập nhật thành công {total} dòng dữ liệu."
    except Exception as e:
        logger.error(f"Enrich Error: {e}")
        enrich_status = {"running": False, "processed": 0, "total": 0, "percent": 0, "done": True, "error": str(e)}
    finally:
        db_session.close()

@router.post("/enrich-customers")
async def trigger_enrich_customers(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    global enrich_status
    if enrich_status["running"]:
        return {"success": False, "message": "Hệ thống đang thực hiện một tiến trình import khác."}
    
    try:
        contents = await file.read()
        import io
        df = pd.read_excel(io.BytesIO(contents))
        
        # Auto header detection
        if df.iloc[0:3, 0].isna().sum() >= 2:
             df = pd.read_excel(io.BytesIO(contents), skiprows=2)
             
        background_tasks.add_task(do_enrich, SessionLocal(), df)
        return {"success": True, "message": "Đang bắt đầu quá trình làm giàu dữ liệu..."}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get("/enrich-status")
async def get_enrich_status():
    return enrich_status

@router.get("/template-enrich")
async def download_template_enrich():
    """Tạo và trả về file Excel mẫu để làm giàu dữ liệu."""
    import io
    from fastapi.responses import StreamingResponse
    
    # Tạo dữ liệu mẫu
    data = {
        "Mã CRM/CMS": ["123456789", "987654321"],
        "Địa chỉ": ["Số 1 Hùng Vương, Huế", "Số 2 Lê Lợi, Huế"],
        "Điện thoại": ["0905123456", "0905654321"],
        "Người liên hệ": ["Nguyễn Văn A", "Trần Thị B"],
        "Số hợp đồng": ["HD/2026/001", "HD/2026/002"],
        "Ngày bắt đầu": ["01/01/2026", "01/02/2026"],
        "Ngày kết thúc": ["31/12/2026", "31/12/2026"]
    }
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Sheet1')
        
        # Định dạng một chút cho đẹp
        workbook = writer.book
        worksheet = writer.sheets['Sheet1']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#003E7E',
            'font_color': 'white',
            'border': 1
        })
        
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            worksheet.set_column(col_num, col_num, 20)

    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Mau_Cap_Nhat_Thong_Tin_KH.xlsx"}
    )
