import sqlite3

for path in ['smartnest.db', 'backend/smartnest.db']:
    print(f"\n================ {path} ================")
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        for tbl in ['users', 'homes', 'rooms', 'devices']:
            try:
                rows = cursor.execute(f'SELECT * FROM {tbl}').fetchall()
                print(f"Table {tbl}: {len(rows)} rows")
                for r in rows:
                    print("  ", r)
            except Exception as e:
                print(f"Table {tbl} error:", e)
    except Exception as e:
        print("Conn error:", e)
