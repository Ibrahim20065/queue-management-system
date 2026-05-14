# Queue Management System

A real-time queue management web app built for the Shortcut Asia Internship Challenge 2026.

## What it does

A digital queuing system that eliminates physical queues. Customers join a queue from their phone or browser and see their position update in real time. Staff manage the queue from a dedicated dashboard.

## Features

### Customer Side
- Join a queue with one click and get a ticket number instantly
- See your position and who is currently being served
- Position updates automatically every 5 seconds — no refreshing needed
- QR code on the page so anyone can scan and join from their phone

### Staff Side
- Create and close queues
- See the full queue list in real time
- Call the next customer with one click
- See how many customers have been served

## Tech Stack

- **Backend:** Python, Flask
- **Database:** SQLite
- **Frontend:** HTML, CSS, JavaScript
- **Hosting:** Railway

## How to run locally

1. Clone the repo
2. Install dependencies: `pip install -r requirements.txt`
3. Run the app: `python app.py`
4. Open `http://127.0.0.1:5000` for the customer page
5. Open `http://127.0.0.1:5000/staff` for the staff dashboard

## Live Demo

## Live Demo

[Click here to open the app](https://queue-management-system-rzia.onrender.com)

**Staff Dashboard:** https://queue-management-system-rzia.onrender.com/staff

**Display Wall:** https://queue-management-system-rzia.onrender.com/display