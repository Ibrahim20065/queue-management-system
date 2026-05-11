let counters = [];

function showMessage(msg, isError = false) {
    const el = document.getElementById('control-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.color = isError ? '#e53e3e' : '#38a169';
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function addService(listId) {
    const list = document.getElementById(listId);
    const div = document.createElement('div');
    div.className = 'service-item';
    div.innerHTML = `
        <input type="text" placeholder="e.g. Loan Consultation" class="service-input" />
        <button class="remove-service-btn" onclick="removeService(this)">✕</button>
    `;
    list.appendChild(div);
}

function removeService(btn) {
    const list = btn.parentElement.parentElement;
    if (list.children.length > 1) {
        btn.parentElement.remove();
    }
}

function createCounter() {
    const name = document.getElementById('counter-name').value.trim();
    const servicesSelect = document.getElementById('counter-services');
    const services = Array.from(servicesSelect.selectedOptions).map(o => o.value);

    if (!name) {
        showMessage('Please select a counter name', true);
        return;
    }

    if (services.length === 0) {
        showMessage('Please select at least one service', true);
        return;
    }

    fetch('/api/create-counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, services })
    })
    .then(res => res.json())
    .then(data => {
        showMessage(data.message);
        document.getElementById('counter-name').value = '';
        Array.from(document.getElementById('counter-services').options).forEach(o => o.selected = false);
        loadCounters();
        loadAnalytics();
    })
    .catch(() => showMessage('Failed to create counter', true));
}

function callNext(counterId) {
    fetch(`/api/next/${counterId}`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showMessage(data.error, true);
        } else if (data.message) {
            showMessage(data.message);
        } else {
            showMessage(`Now serving ${data.customer_name} — ${data.service}`);
            playSound();
        }
        loadCounters();
        loadAnalytics();
    })
    .catch(() => showMessage('Failed to call next', true));
}

function closeCounter(counterId) {
    if (!confirm('Are you sure you want to close this counter?')) return;
    fetch(`/api/close-counter/${counterId}`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        showMessage(data.message);
        loadCounters();
        loadAnalytics();
    })
    .catch(() => showMessage('Failed to close counter', true));
}

function playSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
}

function loadCounters() {
    fetch('/api/counters')
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('counters-container');

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-msg">No active counters — create one above</p>';
            return;
        }

        container.innerHTML = data.map(counter => {
            const waiting = counter.customers.filter(c => c.status === 'waiting');
            const serving = counter.customers.filter(c => c.status === 'serving');

            let queueHtml = '';
            serving.forEach(c => {
                queueHtml += `<div class="queue-item serving">
                    <div>
                        <span class="ticket-badge serving-badge">🔔 #${c.ticket_number}</span>
                        <span class="customer-detail">${c.customer_name}</span>
                    </div>
                    <span class="queue-status">${c.service}</span>
                </div>`;
            });

            waiting.forEach((c, i) => {
                queueHtml += `<div class="queue-item waiting">
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

            if (counter.done_count > 0) {
                queueHtml += `<div class="queue-item done-summary">
                    <span>${counter.done_count} customer(s) served</span>
                </div>`;
            }

            if (counter.customers.length === 0) {
                queueHtml = '<p class="empty-msg">No customers yet</p>';
            }

            return `
                <div class="counter-card">
                    <div class="counter-header">
                        <h3>${counter.name}</h3>
                        <div class="counter-actions">
                            <button class="btn-success" onclick="callNext(${counter.id})">Call Next</button>
                            <button class="btn-danger" onclick="closeCounter(${counter.id})">Close</button>
                        </div>
                    </div>
                    <div class="counter-serving">
                        <span class="counter-serving-label">Now Serving</span>
                        <span class="counter-serving-number">${counter.current_serving || '--'}</span>
                        ${counter.serving_customer ? `
                        <span class="counter-serving-name">
                            ${counter.serving_customer.customer_name} — ${counter.serving_customer.service}
                        </span>` : ''}
                    </div>
                    <div class="counter-services">
                        ${counter.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
                    </div>
                    <div class="counter-queue">${queueHtml}</div>
                </div>
            `;
        }).join('');
    });
}

function loadAnalytics() {
    fetch('/api/analytics')
    .then(res => res.json())
    .then(data => {
        document.getElementById('stat-served').textContent = data.total_served;
        document.getElementById('stat-waiting').textContent = data.total_waiting;
        document.getElementById('stat-popular').textContent = data.popular_service;
        document.getElementById('stat-counters').textContent = data.active_counters;
    });
}

loadCounters();
loadAnalytics();
setInterval(() => { loadCounters(); loadAnalytics(); }, 5000);