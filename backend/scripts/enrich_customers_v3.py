import pandas as pd
import sqlite3
import os
from datetime import datetime

# Paths
db_path = r'd:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db'
excel_path = r'd:\Antigravity - Project\KHHH - Antigravity - V3.0\archive\data\2026_07.04- DANH SÁCH RÀ SOÁT BÀN GIAO KHHH.xlsx'

def format_excel_date(val):
    if pd.isna(val) or val == 0:
        return ""
    if isinstance(val, (int, float)):
        # Convert Excel serial date
        try:
            return pd.to_datetime(val, unit='D', origin='1899-12-30').strftime('%d/%m/%Y')
        except:
            return str(val)
    if isinstance(val, datetime):
        return val.strftime('%d/%m/%Y')
    return str(val).strip()

def enrich_data():
    print(f"Starting enrichment from: {excel_path}")
    
    # 1. Read Excel
    xl = pd.ExcelFile(excel_path)
    sheet_name = 'CT KH' if 'CT KH' in xl.sheet_names else xl.sheet_names[0]
    df = xl.parse(sheet_name, skiprows=2)
    
    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]
    
    # Map columns
    # We need: Mã CRM/CMS, Dia_chi, Dien_thoai, Nguoi_lien_he, so_hop_dong, Thoi_han_hop_dong, Thoi_han_ket_thuc
    required_cols = ["Mã CRM/CMS", "Dia_chi", "Dien_thoai", "Nguoi_lien_he", "so_hop_dong", "Thoi_han_hop_dong", "Thoi_han_ket_thuc"]
    
    # Filter only rows with Mã CRM/CMS
    df = df[df["Mã CRM/CMS"].notna()]
    
    # 2. Connect to DB
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    count = 0
    updated_count = 0
    
    for _, row in df.iterrows():
        raw_ma = str(row["Mã CRM/CMS"]).strip()
        # Remove any hidden characters or spaces
        ma_kh = "".join(raw_ma.split())
        
        dia_chi = str(row.get("Dia_chi", "")).strip() if pd.notna(row.get("Dia_chi")) else ""
        dien_thoai = str(row.get("Dien_thoai", "")).strip() if pd.notna(row.get("Dien_thoai")) else ""
        nguoi_lien_he = str(row.get("Nguoi_lien_he", "")).strip() if pd.notna(row.get("Nguoi_lien_he")) else ""
        so_hop_dong = str(row.get("so_hop_dong", "")).strip() if pd.notna(row.get("so_hop_dong")) else ""
        
        # Format dates
        th_bd = format_excel_date(row.get("Thoi_han_hop_dong"))
        th_kt = format_excel_date(row.get("Thoi_han_ket_thuc"))
        
        # Check if customer exists - aggressive matching
        cursor.execute("SELECT ma_crm_cms FROM customers WHERE TRIM(ma_crm_cms) = ?", (ma_kh,))
        exists = cursor.fetchone()
        
        if not exists:
            # Try partial match if exact fails
            cursor.execute("SELECT ma_crm_cms FROM customers WHERE ma_crm_cms LIKE ?", (f"%{ma_kh}%",))
            exists = cursor.fetchone()
        
        if exists:
            db_ma = exists[0]
            # Update
            cursor.execute("""
                UPDATE customers 
                SET dia_chi = ?, dien_thoai = ?, nguoi_lien_he = ?, so_hop_dong = ?, 
                    thoi_han_hop_dong = ?, thoi_han_ket_thuc = ?, updated_at = CURRENT_TIMESTAMP
                WHERE ma_crm_cms = ?
            """, (dia_chi, dien_thoai, nguoi_lien_he, so_hop_dong, th_bd, th_kt, db_ma))
            updated_count += 1
        
        count += 1
        if count % 100 == 0:
            print(f"Processed {count} rows...")

    conn.commit()
    conn.close()
    
    print(f"Finished! Total Excel rows processed: {count}")
    print(f"Total customers enriched in DB: {updated_count}")

if __name__ == "__main__":
    enrich_data()
