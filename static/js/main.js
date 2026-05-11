let myTicket = null;
let statusInterval = null;

function loadServices() {
    fetch('/api/queue')
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('service-select');
            if (data.error || !data.services || data.services.length === 0) {
                select.innerHTML = '<option value="General Service">General Service</option>';
                return;
            }
            select.innerHTML = data.services
                .map(s => `<option value="${s}">${s}</option>`)
                .join('');
        })
        .catch(() => {
            document.getElementById('service-select').innerHTML =
                '<option value="General Service">General Service</option>';
        });
}

function joinQueue() {
    const btn = document.getElementById('join-btn');
    const errorMsg = document.getElementById('error-msg');
    const customerName = document.getElementById('customer-name').value.trim();
    const service = document.getElementById('service-select').value;

    if (!customerName) {
        errorMsg.textContent = 'Please enter your name';
        errorMsg.classList.remove('hidden');
        return;
    }

    if (!service) {
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
        body: JSON.stringify({ customer_name: customerName, service: service })
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

        document.getElementById('join-section').classList.add('hidden');
        document.getElementById('ticket-section').classList.remove('hidden');
        document.getElementById('ticket-display').textContent = myTicket;
        document.getElementById('customer-name-display').textContent = `Name: ${data.customer_name}`;
        document.getElementById('service-display').textContent = `Service: ${data.service}`;

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
    if (!myTicket) return;

    fetch(`/api/status/${myTicket}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) return;

            document.getElementById('position-display').textContent = data.position;
            document.getElementById('serving-display').textContent = data.current_serving || '--';
            document.getElementById('wait-display').textContent =
                data.estimated_wait > 0 ? `~${data.estimated_wait} min` : 'Soon';

            const statusMsg = document.getElementById('status-msg');

            if (data.status === 'serving') {
                statusMsg.textContent = "🎉 It's your turn! Please proceed.";
                clearInterval(statusInterval);
            } else if (data.position === 1) {
                statusMsg.textContent = 'You are next!';
            } else {
                statusMsg.textContent = `${data.position - 1} person(s) ahead of you`;
            }
        });
}

loadServices();