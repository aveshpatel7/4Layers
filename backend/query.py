import sqlite3
conn = sqlite3.connect('smartnest.db')
c = conn.cursor()
c.execute("SELECT node_id, room_id, current_state FROM devices")
for row in c.fetchall(): print(row)
