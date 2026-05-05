import sqlite3
import sys

# Force UTF-8 for file writing
DB_PATH = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"
LOG_FILE = r"backend\scripts\diag_result.txt"

def diagnose():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("--- DIAGNOSING CUM TD01 ---\n")
        
        cursor.execute("SELECT id, code, name FROM hierarchy_nodes WHERE code = 'TD01'")
        root = cursor.fetchone()
        if not root:
            f.write("Error: Node TD01 not found!\n")
            return
        
        root_id, root_code, root_name = root
        f.write(f"Root Node: ID={root_id}, Code={root_code}, Name={root_name}\n")

        cursor.execute("SELECT id, code, name, parent_id FROM hierarchy_nodes")
        all_nodes = cursor.fetchall()
        
        def get_desc(pid):
            d = [n for n in all_nodes if n[3] == pid]
            res = list(d)
            for child in d:
                res.extend(get_desc(child[0]))
            return res
        
        descendants = get_desc(root_id)
        f.write(f"Total descendant nodes found: {len(descendants)}\n")
        
        f.write("\nCheck Mapping for each child:\n")
        f.write(f"{'Code':<15} | {'Name':<30} | {'Trans Count':<15} | {'PointID Count'}\n")
        f.write("-" * 75 + "\n")
        
        for nid, code, name, _ in descendants:
            cursor.execute("SELECT count(*) FROM transactions WHERE ma_dv_chap_nhan = ?", (code,))
            trans_count = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM transactions WHERE ma_dv_chap_nhan = ? AND point_id = ?", (code, nid))
            mapped_count = cursor.fetchone()[0]
            if trans_count > 0:
                f.write(f"{code:<15} | {name[:30]:<30} | {trans_count:<15} | {mapped_count}\n")

        cursor.execute("SELECT count(*) FROM transactions WHERE ma_dv_chap_nhan LIKE '%TD%'")
        f.write(f"\nTransactions with code LIKE 'TD': {cursor.fetchone()[0]}\n")

        f.write("\nTop 10 unmapped codes in entire DB:\n")
        cursor.execute("""
            SELECT ma_dv_chap_nhan, count(*) 
            FROM transactions 
            WHERE point_id IS NULL OR point_id = '' 
            GROUP BY ma_dv_chap_nhan 
            ORDER BY count(*) DESC 
            LIMIT 10
        """)
        for row in cursor.fetchall():
            f.write(f"Code: {row[0]} | Count: {row[1]}\n")

    conn.close()

if __name__ == "__main__":
    diagnose()
