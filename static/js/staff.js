let queueInterval = null;

function showMessage(msg, isError = false) {
    const el = document.getElementById('control-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.color = isError ? '#e53e3e' : '#38a169';
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function createQueue() {
    fetch('/api/create-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Main Queue' })
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
            showMessage(`Now serving ticket #${data.now_serving}`);
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
        document.getElementById('queue-list').innerHTML = '<p class="empty-msg">No active queue</p>';
    })
    .catch(() => showMessage('Failed to close queue', true));
}

function loadQueue() {
    fetch('/api/queue')
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('serving-display').textContent = '--';
            document.getElementById('queue-list').innerHTML = '<p class="empty-msg">No active queue</p>';
            return;
        }

        document.getElementById('serving-display').textContent = 
            data.current_serving || '--';

        const waiting = data.customers.filter(c => c.status === 'waiting');
        const serving = data.customers.filter(c => c.status === 'serving');
        const done = data.customers.filter(c => c.status === 'done');

        if (data.customers.length === 0) {
            document.getElementById('queue-list').innerHTML = 
                '<p class="empty-msg">Queue is empty</p>';
            return;
        }

        let html = '';

        if (serving.length > 0) {
            serving.forEach(c => {
                html += `<div class="queue-item serving">
                    <span class="ticket-badge serving-badge">🔔 #${c.ticket_number}</span>
                    <span class="queue-status">Serving</span>
                </div>`;
            });
        }

        if (waiting.length > 0) {
            waiting.forEach((c, i) => {
                html += `<div class="queue-item waiting">
                    <span class="ticket-badge">#${c.ticket_number}</span>
                    <span class="queue-status">Position ${i + 1}</span>
                </div>`;
            });
        }

        if (done.length > 0) {
            html += `<div class="queue-item done-summary">
                <span>${done.length} customer(s) served</span>
            </div>`;
        }

        document.getElementById('queue-list').innerHTML = html;
    })
    .catch(() => {
        document.getElementById('queue-list').innerHTML = 
            '<p class="empty-msg">Could not load queue</p>';
    });
}

loadQueue();
queueInterval = setInterval(loadQueue, 5000);