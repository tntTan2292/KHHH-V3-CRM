import sqlite3
conn = sqlite3.connect('data/database/khhh_v3.db')
print(conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='nhan_su'").fetchone()[0])
