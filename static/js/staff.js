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
            container.innerHTML = '<p class="staff-empty-msg">No active counters — create one above</p>';
            return;
        }

        container.innerHTML = data.map(counter => {
            const waiting = counter.customers.filter(c => c.status === 'waiting');
            const serving = counter.customers.filter(c => c.status === 'serving');

            let queueHtml = '';

            serving.forEach(c => {
                queueHtml += `<div class="staff-queue-item is-serving">
                    <span class="staff-queue-ticket">🔔 ${c.ticket_code || '#' + c.ticket_number}</span>
                    <span class="staff-queue-customer">${c.customer_name}</span>
                    <span class="staff-queue-service">${c.service}</span>
                </div>`;
            });

            waiting.forEach((c, i) => {
                queueHtml += `<div class="staff-queue-item">
                    <span class="staff-queue-ticket">${c.ticket_code || '#' + c.ticket_number}</span>
                    <span class="staff-queue-customer">${c.customer_name}</span>
                    <div style="text-align:right">
                        <span class="staff-queue-service">${c.service}</span>
                        <span class="staff-queue-pos" style="display:block">Position ${i + 1}</span>
                    </div>
                </div>`;
            });

            if (counter.done_count > 0) {
                queueHtml += `<p class="staff-done-summary">${counter.done_count} customer(s) served</p>`;
            }

            if (counter.customers.length === 0) {
                queueHtml = '<p class="staff-empty-msg" style="padding:8px 0">No customers yet</p>';
            }

            return `
                <div class="staff-counter-card">
                    <div class="staff-counter-header">
                        <span class="staff-counter-title">${counter.name}</span>
                        <div class="staff-counter-actions">
                            <button class="staff-btn-next" onclick="callNext(${counter.id})">Call Next</button>
                            <button class="staff-btn-close" onclick="closeCounter(${counter.id})">Close</button>
                        </div>
                    </div>
                    <div class="staff-counter-body">
                        <div class="staff-counter-serving">
                            <span class="staff-serving-label">NOW SERVING</span>
                            <span class="staff-serving-number">${counter.current_serving || '--'}</span>
                            ${counter.serving_customer ? `<span class="staff-serving-name">${counter.serving_customer.customer_name} — ${counter.serving_customer.service}</span>` : ''}
                        </div>
                        <div class="staff-service-tags">
                            ${counter.services.map(s => `<span class="staff-service-tag">${s}</span>`).join('')}
                        </div>
                        <div class="staff-queue-list">${queueHtml}</div>
                    </div>
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