from flask import Flask, render_template, request, jsonify
from database import get_db, init_db

app = Flask(__name__)

# ── Pages ──────────────────────────────────────────
@app.route('/')
def customer_page():
    return render_template('customer.html')

@app.route('/staff')
def staff_page():
    return render_template('staff.html')

@app.route('/display')
def display_page():
    return render_template('display.html')

# ── Customer APIs ───────────────────────────────────
@app.route('/api/join', methods=['POST'])
def join_queue():
    data = request.get_json()
    customer_name = data.get('customer_name', 'Guest').strip()
    service = data.get('service', 'General').strip()

    if not customer_name:
        return jsonify({'error': 'Please enter your name'}), 400

    conn = get_db()
    cursor = conn.cursor()

    queue = cursor.execute('SELECT * FROM queues WHERE is_open = 1').fetchone()
    if not queue:
        conn.close()
        return jsonify({'error': 'No active queue available'}), 400

    last = cursor.execute(
        'SELECT MAX(ticket_number) as max FROM customers WHERE queue_id = ?',
        (queue['id'],)
    ).fetchone()

    ticket_number = (last['max'] or 0) + 1

    cursor.execute(
        'INSERT INTO customers (queue_id, ticket_number, customer_name, service, status) VALUES (?, ?, ?, ?, ?)',
        (queue['id'], ticket_number, customer_name, service, 'waiting')
    )
    conn.commit()

    position = cursor.execute(
        'SELECT COUNT(*) as pos FROM customers WHERE queue_id = ? AND status = "waiting" AND ticket_number <= ?',
        (queue['id'], ticket_number)
    ).fetchone()['pos']

    conn.close()
    return jsonify({
        'ticket_number': ticket_number,
        'position': position,
        'customer_name': customer_name,
        'service': service
    })

@app.route('/api/status/<int:ticket_number>')
def get_status(ticket_number):
    conn = get_db()
    cursor = conn.cursor()

    queue = cursor.execute('SELECT * FROM queues WHERE is_open = 1').fetchone()
    if not queue:
        conn.close()
        return jsonify({'error': 'No active queue'}), 400

    customer = cursor.execute(
        'SELECT * FROM customers WHERE ticket_number = ? AND queue_id = ?',
        (ticket_number, queue['id'])
    ).fetchone()

    if not customer:
        conn.close()
        return jsonify({'error': 'Ticket not found'}), 404

    position = cursor.execute(
        'SELECT COUNT(*) as pos FROM customers WHERE queue_id = ? AND status = "waiting" AND ticket_number <= ?',
        (queue['id'], ticket_number)
    ).fetchone()['pos']

    waiting_ahead = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE queue_id = ? AND status = "waiting" AND ticket_number < ?',
        (queue['id'], ticket_number)
    ).fetchone()['cnt']

    estimated_wait = waiting_ahead * 5

    conn.close()
    return jsonify({
        'ticket_number': ticket_number,
        'customer_name': customer['customer_name'],
        'service': customer['service'],
        'status': customer['status'],
        'position': position,
        'current_serving': queue['current_serving'],
        'estimated_wait': estimated_wait
    })

# ── Staff APIs ──────────────────────────────────────
@app.route('/api/queue', methods=['GET'])
def get_queue():
    conn = get_db()
    cursor = conn.cursor()

    queue = cursor.execute('SELECT * FROM queues WHERE is_open = 1').fetchone()
    if not queue:
        conn.close()
        return jsonify({'error': 'No active queue'}), 400

    customers = cursor.execute(
        'SELECT * FROM customers WHERE queue_id = ? ORDER BY ticket_number',
        (queue['id'],)
    ).fetchall()

    services = cursor.execute(
        'SELECT * FROM services WHERE queue_id = ?',
        (queue['id'],)
    ).fetchall()

    serving = cursor.execute(
        'SELECT * FROM customers WHERE queue_id = ? AND status = "serving"',
        (queue['id'],)
    ).fetchone()

    conn.close()
    return jsonify({
        'queue_name': queue['name'],
        'current_serving': queue['current_serving'],
        'serving_customer': dict(serving) if serving else None,
        'customers': [dict(c) for c in customers],
        'services': [s['service_name'] for s in services]
    })

@app.route('/api/next', methods=['POST'])
def call_next():
    conn = get_db()
    cursor = conn.cursor()

    queue = cursor.execute('SELECT * FROM queues WHERE is_open = 1').fetchone()
    if not queue:
        conn.close()
        return jsonify({'error': 'No active queue'}), 400

    cursor.execute(
        'UPDATE customers SET status = "done" WHERE queue_id = ? AND status = "serving"',
        (queue['id'],)
    )

    next_customer = cursor.execute(
        'SELECT * FROM customers WHERE queue_id = ? AND status = "waiting" ORDER BY ticket_number LIMIT 1',
        (queue['id'],)
    ).fetchone()

    if not next_customer:
        conn.close()
        return jsonify({'message': 'No more customers in queue'})

    cursor.execute(
        'UPDATE customers SET status = "serving" WHERE id = ?',
        (next_customer['id'],)
    )
    cursor.execute(
        'UPDATE queues SET current_serving = ? WHERE id = ?',
        (next_customer['ticket_number'], queue['id'])
    )
    conn.commit()
    conn.close()
    return jsonify({
        'now_serving': next_customer['ticket_number'],
        'customer_name': next_customer['customer_name'],
        'service': next_customer['service']
    })

@app.route('/api/create-queue', methods=['POST'])
def create_queue():
    data = request.get_json()
    name = data.get('name', 'Main Queue')
    services = data.get('services', ['General Service'])

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE queues SET is_open = 0')
    cursor.execute('INSERT INTO queues (name) VALUES (?)', (name,))
    queue_id = cursor.lastrowid

    for service in services:
        if service.strip():
            cursor.execute(
                'INSERT INTO services (queue_id, service_name) VALUES (?, ?)',
                (queue_id, service.strip())
            )

    conn.commit()
    conn.close()
    return jsonify({'message': f'Queue "{name}" created successfully'})

@app.route('/api/close-queue', methods=['POST'])
def close_queue():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE queues SET is_open = 0')
    conn.commit()
    conn.close()
    return jsonify({'message': 'Queue closed'})

@app.route('/api/display', methods=['GET'])
def get_display():
    conn = get_db()
    cursor = conn.cursor()

    queue = cursor.execute('SELECT * FROM queues WHERE is_open = 1').fetchone()
    if not queue:
        conn.close()
        return jsonify({'error': 'No active queue'}), 400

    serving = cursor.execute(
        'SELECT * FROM customers WHERE queue_id = ? AND status = "serving"',
        (queue['id'],)
    ).fetchone()

    waiting_count = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE queue_id = ? AND status = "waiting"',
        (queue['id'],)
    ).fetchone()['cnt']

    next_customers = cursor.execute(
        'SELECT * FROM customers WHERE queue_id = ? AND status = "waiting" ORDER BY ticket_number LIMIT 3',
        (queue['id'],)
    ).fetchall()

    conn.close()
    return jsonify({
        'queue_name': queue['name'],
        'serving': dict(serving) if serving else None,
        'waiting_count': waiting_count,
        'next_customers': [dict(c) for c in next_customers]
    })

# ── Start ───────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)