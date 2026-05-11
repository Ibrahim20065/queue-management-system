import sqlite3

def get_db():
    conn = sqlite3.connect('queue.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS counters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            is_open INTEGER DEFAULT 1,
            current_serving INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            counter_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            FOREIGN KEY (counter_id) REFERENCES counters (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            counter_id INTEGER NOT NULL,
            ticket_number INTEGER NOT NULL,
            customer_name TEXT DEFAULT 'Guest',
            service TEXT DEFAULT 'General',
            status TEXT DEFAULT 'waiting',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (counter_id) REFERENCES counters (id)
        )
    ''')

    conn.commit()
    conn.close()