from flask import Flask, render_template, request, jsonify
from database import get_db, init_db

app = Flask(__name__)

@app.after_request
def add_no_cache(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

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
@app.route('/api/services')
def get_all_services():
    conn = get_db()
    cursor = conn.cursor()
    counters = cursor.execute('SELECT * FROM counters WHERE is_open = 1').fetchall()
    result = []
    for counter in counters:
        services = cursor.execute(
            'SELECT * FROM services WHERE counter_id = ?', (counter['id'],)
        ).fetchall()
        for service in services:
            result.append({
                'counter_id': counter['id'],
                'counter_name': counter['name'],
                'service': service['service_name']
            })
    conn.close()
    return jsonify(result)

@app.route('/api/join', methods=['POST'])
def join_queue():
    data = request.get_json()
    customer_name = data.get('customer_name', 'Guest').strip()
    service = data.get('service', 'General').strip()
    counter_id = data.get('counter_id')

    if not customer_name:
        return jsonify({'error': 'Please enter your name'}), 400
    if not counter_id:
        return jsonify({'error': 'Please select a service'}), 400

    conn = get_db()
    cursor = conn.cursor()

    counter = cursor.execute(
        'SELECT * FROM counters WHERE id = ? AND is_open = 1', (counter_id,)
    ).fetchone()

    if not counter:
        conn.close()
        return jsonify({'error': 'This counter is no longer active'}), 400

    last = cursor.execute(
        'SELECT MAX(ticket_number) as max FROM customers WHERE counter_id = ?',
        (counter_id,)
    ).fetchone()

    ticket_number = (last['max'] or 0) + 1

    ticket_number = (last['max'] or 0) + 1

# Generate service prefix code
    prefix_map = {
    'account': 'ACC',
    'loan': 'LON',
    'deposit': 'DEP',
    'card': 'CRD',
    'mortgage': 'MRT',
    'foreign': 'FX',
    'internet': 'INT',
    'fund': 'FND',
    'fixed': 'FXD',
    'general': 'GEN',
    'inquiry': 'GEN',
}
    service_lower = service.lower()
    prefix = 'GEN'
    for key, val in prefix_map.items():
        if key in service_lower:
            prefix = val
            break
    ticket_code = f"{prefix}-{str(ticket_number).zfill(3)}"

    cursor.execute(
    'INSERT INTO customers (counter_id, ticket_number, ticket_code, customer_name, service, status) VALUES (?, ?, ?, ?, ?, ?)',
    (counter_id, ticket_number, ticket_code, customer_name, service, 'waiting')
)
    conn.commit()

    position = cursor.execute(
        'SELECT COUNT(*) as pos FROM customers WHERE counter_id = ? AND status = "waiting" AND ticket_number <= ?',
        (counter_id, ticket_number)
    ).fetchone()['pos']

    waiting_ahead = position - 1
    estimated_wait = waiting_ahead * 5

    conn.close()
    return jsonify({
        'ticket_number': ticket_number,
        'ticket_code': ticket_code,
        'position': position,
        'customer_name': customer_name,
        'service': service,
        'counter_name': counter['name'],
        'estimated_wait': estimated_wait
    })

@app.route('/api/status/<int:counter_id>/<int:ticket_number>')
def get_status(counter_id, ticket_number):
    conn = get_db()
    cursor = conn.cursor()

    counter = cursor.execute(
        'SELECT * FROM counters WHERE id = ?', (counter_id,)
    ).fetchone()

    if not counter:
        conn.close()
        return jsonify({'error': 'Counter not found'}), 404

    customer = cursor.execute(
        'SELECT * FROM customers WHERE ticket_number = ? AND counter_id = ?',
        (ticket_number, counter_id)
    ).fetchone()

    if not customer:
        conn.close()
        return jsonify({'error': 'Ticket not found'}), 404

    position = cursor.execute(
        'SELECT COUNT(*) as pos FROM customers WHERE counter_id = ? AND status = "waiting" AND ticket_number <= ?',
        (counter_id, ticket_number)
    ).fetchone()['pos']

    waiting_ahead = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE counter_id = ? AND status = "waiting" AND ticket_number < ?',
        (counter_id, ticket_number)
    ).fetchone()['cnt']

    estimated_wait = waiting_ahead * 5

    conn.close()
    return jsonify({
        'ticket_number': ticket_number,
        'ticket_code': customer['ticket_code'],
        'customer_name': customer['customer_name'],
        'service': customer['service'],
        'status': customer['status'],
        'position': position,
        'current_serving': counter['current_serving'],
        'counter_name': counter['name'],
        'estimated_wait': estimated_wait
    })

# ── Staff APIs ──────────────────────────────────────
@app.route('/api/counters', methods=['GET'])
def get_counters():
    conn = get_db()
    cursor = conn.cursor()

    counters = cursor.execute('SELECT * FROM counters WHERE is_open = 1').fetchall()
    result = []

    for counter in counters:
        services = cursor.execute(
            'SELECT * FROM services WHERE counter_id = ?', (counter['id'],)
        ).fetchall()

        customers = cursor.execute(
            'SELECT * FROM customers WHERE counter_id = ? ORDER BY ticket_number',
            (counter['id'],)
        ).fetchall()

        serving = cursor.execute(
            'SELECT * FROM customers WHERE counter_id = ? AND status = "serving"',
            (counter['id'],)
        ).fetchone()

        done_count = cursor.execute(
            'SELECT COUNT(*) as cnt FROM customers WHERE counter_id = ? AND status = "done"',
            (counter['id'],)
        ).fetchone()['cnt']

        result.append({
            'id': counter['id'],
            'name': counter['name'],
            'current_serving': counter['current_serving'],
            'serving_customer': dict(serving) if serving else None,
            'customers': [dict(c) for c in customers],
            'services': [s['service_name'] for s in services],
            'done_count': done_count
        })

    conn.close()
    return jsonify(result)

@app.route('/api/create-counter', methods=['POST'])
def create_counter():
    data = request.get_json()
    name = data.get('name', 'Counter').strip()
    services = data.get('services', ['General Service'])

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('INSERT INTO counters (name) VALUES (?)', (name,))
    counter_id = cursor.lastrowid

    for service in services:
        if service.strip():
            cursor.execute(
                'INSERT INTO services (counter_id, service_name) VALUES (?, ?)',
                (counter_id, service.strip())
            )

    conn.commit()
    conn.close()
    return jsonify({'message': f'Counter "{name}" created successfully', 'counter_id': counter_id})

@app.route('/api/next/<int:counter_id>', methods=['POST'])
def call_next(counter_id):
    conn = get_db()
    cursor = conn.cursor()

    counter = cursor.execute(
        'SELECT * FROM counters WHERE id = ? AND is_open = 1', (counter_id,)
    ).fetchone()

    if not counter:
        conn.close()
        return jsonify({'error': 'Counter not found'}), 400

    cursor.execute(
        'UPDATE customers SET status = "done" WHERE counter_id = ? AND status = "serving"',
        (counter_id,)
    )

    next_customer = cursor.execute(
        'SELECT * FROM customers WHERE counter_id = ? AND status = "waiting" ORDER BY ticket_number LIMIT 1',
        (counter_id,)
    ).fetchone()

    if not next_customer:
        conn.close()
        return jsonify({'message': 'No more customers in queue'})

    cursor.execute(
        'UPDATE customers SET status = "serving" WHERE id = ?',
        (next_customer['id'],)
    )
    cursor.execute(
        'UPDATE counters SET current_serving = ? WHERE id = ?',
        (next_customer['ticket_number'], counter_id)
    )
    conn.commit()
    conn.close()
    return jsonify({
        'now_serving': next_customer['ticket_number'],
        'customer_name': next_customer['customer_name'],
        'service': next_customer['service']
    })

@app.route('/api/close-counter/<int:counter_id>', methods=['POST'])
def close_counter(counter_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE counters SET is_open = 0 WHERE id = ?', (counter_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Counter closed'})

@app.route('/api/analytics')
def get_analytics():
    conn = get_db()
    cursor = conn.cursor()

    total_served = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE status = "done"'
    ).fetchone()['cnt']

    total_waiting = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE status = "waiting"'
    ).fetchone()['cnt']

    popular_service = cursor.execute(
        'SELECT service, COUNT(*) as cnt FROM customers GROUP BY service ORDER BY cnt DESC LIMIT 1'
    ).fetchone()

    active_counters = cursor.execute(
        'SELECT COUNT(*) as cnt FROM counters WHERE is_open = 1'
    ).fetchone()['cnt']

    conn.close()
    return jsonify({
        'total_served': total_served,
        'total_waiting': total_waiting,
        'popular_service': popular_service['service'] if popular_service else 'N/A',
        'active_counters': active_counters
    })

@app.route('/api/display')
def get_display():
    conn = get_db()
    cursor = conn.cursor()

    counters = cursor.execute('SELECT * FROM counters WHERE is_open = 1').fetchall()
    result = []

    tickets_today = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers'
    ).fetchone()['cnt']

    total_waiting = cursor.execute(
        'SELECT COUNT(*) as cnt FROM customers WHERE status = "waiting"'
    ).fetchone()['cnt']

    for counter in counters:
        serving = cursor.execute(
            'SELECT * FROM customers WHERE counter_id = ? AND status = "serving"',
            (counter['id'],)
        ).fetchone()

        waiting_count = cursor.execute(
            'SELECT COUNT(*) as cnt FROM customers WHERE counter_id = ? AND status = "waiting"',
            (counter['id'],)
        ).fetchone()['cnt']

        next_customers = cursor.execute(
            'SELECT * FROM customers WHERE counter_id = ? AND status = "waiting" ORDER BY ticket_number LIMIT 4',
            (counter['id'],)
        ).fetchall()

        result.append({
            'id': counter['id'],
            'name': counter['name'],
            'current_serving': counter['current_serving'],
            'serving': dict(serving) if serving else None,
            'waiting_count': waiting_count,
            'next_customers': [dict(c) for c in next_customers],
            'status': 'busy' if serving else 'open'
        })

    conn.close()
    return jsonify({
        'counters': result,
        'tickets_today': tickets_today,
        'total_waiting': total_waiting
    })

# ── Start ───────────────────────────────────────────
@app.route('/api/qr')
def generate_qr():
    import qrcode
    import io
    import base64
    from flask import request as flask_request

    url = flask_request.args.get('url', 'https://meridian-bank.com')

    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#00e5cc", back_color="#0d1520")

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f'<img src="data:image/png;base64,{img_base64}" style="border-radius:8px;width:120px;height:120px;">'