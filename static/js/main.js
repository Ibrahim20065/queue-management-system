let myTicket = null;
let statusInterval = null;

function joinQueue() {
    const btn = document.getElementById('join-btn');
    const errorMsg = document.getElementById('error-msg');

    btn.disabled = true;
    btn.textContent = 'Joining...';
    errorMsg.classList.add('hidden');

    fetch('/api/join', { method: 'POST' })
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