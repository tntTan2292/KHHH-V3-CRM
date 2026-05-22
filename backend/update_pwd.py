from app.core.security import get_password_hash
import sqlite3

hash_pwd = get_password_hash('12345678')
conn = sqlite3.connect('../data/database/khhh_v3.db')
cur = conn.cursor()
cur.execute("UPDATE users SET hashed_password = ? WHERE username = '00007982'", (hash_pwd,))
conn.commit()
print('Password updated')
