let queueInterval = null;

function showMessage(msg, isError = false) {
    const el = document.getElementById('control-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.color = isError ? '#e53e3e' : '#38a169';
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function addService() {
    const list = document.getElementById('services-list');
    const div = document.createElement('div');
    div.className = 'service-item';
    div.innerHTML = `
        <input type="text" placeholder="e.g. Loan Consultation" class="service-input" />
        <button class="remove-service-btn" onclick="removeService(this)">✕</button>
    `;
    list.appendChild(div);
}

function removeService(btn) {
    const list = document.getElementById('services-list');
    if (list.children.length > 1) {
        btn.parentElement.remove();
    }
}

function createQueue() {
    const name = document.getElementById('queue-name').value.trim() || 'Main Queue';
    const inputs = document.querySelectorAll('.service-input');
    const services = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(s => s.length > 0);

    if (services.length === 0) {
        showMessage('Please add at least one service', true);
        return;
    }

    fetch('/api/create-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, services })
    })
    .then(res => res.json())
    .then(data => {
        showMessage(data.message);
        loadQueue();
    })
    .catch(() => showMessage('Failed to create queue', true));
}

function callNext() {
    fetch('/api/next', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showMessage(data.error, true);
        } else if (data.message) {
            showMessage(data.message);
        } else {
            showMessage(`Now serving ${data.customer_name} — ${data.service}`);
        }
        loadQueue();
    })
    .catch(() => showMessage('Failed to call next', true));
}

function closeQueue() {
    if (!confirm('Are you sure you want to close the queue?')) return;
    fetch('/api/close-queue', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        showMessage(data.message);
        document.getElementById('serving-display').textContent = '--';
        document.getElementById('serving-details').classList.add('hidden');
        document.getElementById('queue-list').innerHTML = '<p class="empty-msg">No active queue</p>';
        document.getElementById('queue-name-display').textContent = 'Queue';
    })
    .catch(() => showMessage('Failed to close queue', true));
}

function loadQueue() {
    fetch('/api/queue')
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('serving-display').textContent = '--';
            document.getElementById('serving-details').classList.add('hidden');
            document.getElementById('queue-list').innerHTML = '<p class="empty-msg">No active queue</p>';
            document.getElementById('queue-name-display').textContent = 'Queue';
            return;
        }

        document.getElementById('queue-name-display').textContent = data.queue_name;
        document.getElementById('serving-display').textContent = data.current_serving || '--';

        if (data.serving_customer) {
            document.getElementById('serving-details').classList.remove('hidden');
            document.getElementById('serving-name').textContent = `Name: ${data.serving_customer.customer_name}`;
            document.getElementById('serving-service').textContent = `Service: ${data.serving_customer.service}`;
        } else {
            document.getElementById('serving-details').classList.add('hidden');
        }

        const waiting = data.customers.filter(c => c.status === 'waiting');
        const serving = data.customers.filter(c => c.status === 'serving');
        const done = data.customers.filter(c => c.status === 'done');

        if (data.customers.length === 0) {
            document.getElementById('queue-list').innerHTML = '<p class="empty-msg">Queue is empty</p>';
            return;
        }

        let html = '';

        serving.forEach(c => {
            html += `<div class="queue-item serving">
                <div>
                    <span class="ticket-badge serving-badge">🔔 #${c.ticket_number}</span>
                    <span class="customer-detail">${c.customer_name}</span>
                </div>
                <span class="queue-status">${c.service}</span>
            </div>`;
        });

        waiting.forEach((c, i) => {
            html += `<div class="queue-item waiting">
                <div>
                    <span class="ticket-badge">#${c.ticket_number}</span>
                    <span class="customer-detail">${c.customer_name}</span>
                </div>
                <div style="text-align:right">
                    <span class="queue-status">${c.service}</span>
                    <span class="position-badge">Position ${i + 1}</span>
                </div>
            </div>`;
        });

        if (done.length > 0) {
            html += `<div class="queue-item done-summary">
                <span>${done.length} customer(s) served</span>
            </div>`;
        }

        document.getElementById('queue-list').innerHTML = html;
    });
}

loadQueue();
queueInterval = setInterval(loadQueue, 5000);