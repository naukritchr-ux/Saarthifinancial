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

---

## Production Deployment & Environment Configuration

### Backend (Render / Production)
* **Production Command**: Run the Flask backend using Gunicorn:
  ```bash
  gunicorn app:app
  ```
  Or with workers:
  ```bash
  gunicorn -w 4 -b 0.0.0.0:$PORT app:app
  ```
* **Environment Variables**:
  * `API_KEY`: Secret API key to authenticate all frontend and API client requests.
  * `ADMIN_API_KEY`: Admin-level secret API key required for sensitive operations (e.g., `/api/sync/prune`, `/api/sync/ghost-report`). Defaults to `API_KEY` if not set.
  * `SAARTHI_API_TOKEN`: Optional bearer token passed in `Authorization: Bearer <token>` when syncing from `api.sarthi360.in`.
  * `ENFORCE_API_KEY`: Set to `true` (default in production) to require `X-API-Key`.

### Frontend (Vercel / Production)
* **`VITE_API_URL`**: Set directly to your deployed Render backend URL (e.g., `https://fintective-backend.onrender.com/api`).
  > **Note**: Avoid relying on Vercel catch-all rewrites for long-running calls (such as `/api/finance/sync-saarthi` or reports), as serverless gateway timeouts can drop the connection prematurely.
* **`VITE_API_KEY`**: Must exactly match the backend `API_KEY`. Passed automatically via the `X-API-Key` header with `fetchWithApiKey`.

