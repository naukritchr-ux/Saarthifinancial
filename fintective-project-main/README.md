# Saarthi Finance Hub - Python & React Stack (Migrated)

This directory contains the migrated Python/React stack of the Saarthi Finance module. All logic has been ported from Node.js Express to Python Flask, while keeping the exact same high-visual React frontend.

---

## Folder Structure

* **`backend/`**: Python Flask REST API connected to the MySQL `crm_db` database.
* **`frontend/`**: Vite React Application matching the premium, high-visual dark-theme UI.

---

## Setup & Running Instructions

### 1. Run the Python Backend API
Make sure you have Python installed, then open a terminal and run:

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the Flask API server
python app.py
```

The server will start on [http://localhost:5000](http://localhost:5000). On startup, it will check the database configuration and automatically seed dummy tables (if using `'seed'`) or import local CRM database SQL dumps (if using real databases).

### 2. Run the React Frontend Development Server
Open a second terminal and run:

```bash
# Navigate to the frontend directory
cd ../frontend

# Install dependencies (since node_modules was excluded during copy)
npm install

# Start the Vite React development server
npm run dev
```

Open the local address printed by Vite (typically [http://localhost:5173](http://localhost:5173)) in your browser to view the application running completely on the Python stack!
