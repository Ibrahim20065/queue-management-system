let myTicket = null;
let myCounterId = null;
let statusInterval = null;

function loadServices() {
    fetch('/api/services')
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('service-select');
            if (!data || data.length === 0) {
                select.innerHTML = '<option value="">No active counters</option>';
                return;
            }

            let html = '<option value="">Select a service...</option>';
            let currentCounter = '';

            data.forEach(item => {
                if (item.counter_name !== currentCounter) {
                    if (currentCounter !== '') html += '</optgroup>';
                    html += `<optgroup label="${item.counter_name}">`;
                    currentCounter = item.counter_name;
                }
                html += `<option value="${item.service}" data-counter-id="${item.counter_id}">${item.service}</option>`;
            });

            html += '</optgroup>';
            select.innerHTML = html;
        })
        .catch(() => {
            document.getElementById('service-select').innerHTML =
                '<option value="">Could not load services</option>';
        });
}

function joinQueue() {
    const btn = document.getElementById('join-btn');
    const errorMsg = document.getElementById('error-msg');
    const customerName = document.getElementById('customer-name').value.trim();
    const serviceSelect = document.getElementById('service-select');
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const service = serviceSelect.value;
    const counterId = selectedOption ? selectedOption.getAttribute('data-counter-id') : null;

    if (!customerName) {
        errorMsg.textContent = 'Please enter your name';
        errorMsg.classList.remove('hidden');
        return;
    }

    if (!service || !counterId) {
        errorMsg.textContent = 'Please select a service';
        errorMsg.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Joining...';
    errorMsg.classList.add('hidden');

    fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer_name: customerName,
            service: service,
            counter_id: parseInt(counterId)
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            errorMsg.textContent = data.error;
            errorMsg.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Join Queue';
            return;
        }

        myTicket = data.ticket_number;
        myCounterId = parseInt(counterId);

        document.getElementById('join-section').classList.add('hidden');
        document.getElementById('ticket-section').classList.remove('hidden');
        document.getElementById('ticket-display').textContent = myTicket;
        document.getElementById('customer-name-display').textContent = `Name: ${data.customer_name}`;
        document.getElementById('service-display').textContent = `Service: ${data.service}`;
        document.getElementById('counter-display').textContent = `Counter: ${data.counter_name}`;

        updateStatus();
        statusInterval = setInterval(updateStatus, 5000);
    })
    .catch(() => {
        errorMsg.textContent = 'Something went wrong. Please try again.';
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Join Queue';
    });
}

function updateStatus() {
    if (!myTicket || !myCounterId) return;

    fetch(`/api/status/${myCounterId}/${myTicket}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) return;

            document.getElementById('position-display').textContent = data.position;
            document.getElementById('serving-display').textContent = data.current_serving || '--';
            document.getElementById('wait-display').textContent =
                data.estimated_wait > 0 ? `~${data.estimated_wait} min` : 'Soon';

            const statusMsg = document.getElementById('status-msg');

            if (data.status === 'serving') {
                statusMsg.textContent = "🎉 It's your turn! Please proceed to " + data.counter_name;
                clearInterval(statusInterval);
            } else if (data.position === 1) {
                statusMsg.textContent = 'You are next!';
            } else {
                statusMsg.textContent = `${data.position - 1} person(s) ahead of you`;
            }
        });
}

loadServices();