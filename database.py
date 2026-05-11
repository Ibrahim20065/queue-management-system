import sqlite3

def get_db():
    conn = sqlite3.connect('queue.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS queues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            is_open INTEGER DEFAULT 1,
            current_serving INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queue_id INTEGER NOT NULL,
            ticket_number INTEGER NOT NULL,
            customer_name TEXT DEFAULT 'Guest',
            service TEXT DEFAULT 'General',
            status TEXT DEFAULT 'waiting',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (queue_id) REFERENCES queues (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queue_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            FOREIGN KEY (queue_id) REFERENCES queues (id)
        )
    ''')

    conn.commit()
    conn.close()