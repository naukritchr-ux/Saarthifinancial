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

## Running Tests Safely

Fintective separates read-only tests from tests that write to the database (`@pytest.mark.writes_db`).

### 1. Default Safety Guard
When running tests against your default development or live CRM database (`.env`), any test that performs database writes (`INSERT`, `UPDATE`, `DELETE`, or modifying API endpoints) is **automatically skipped** with the following message:
```text
Skipped: this test writes data and the configured database is not a test/staging database.
```
Read-only tests against the database continue to run normally.

### 2. Running Write Tests Against a Staging/Test Database
To run the full suite including write tests, configure a staging or test database whose name **strictly ends in `_staging` or `_test`**:

1. **Create the staging database copy in MySQL**:
   ```sql
   CREATE DATABASE crm_db_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   -- Dump schema and bootstrap tables into crm_db_staging
   ```
2. **Set `TEST_DATABASE_URL`**:
   Provide the connection URL pointing to the staging database via environment variable:
   ```bash
   # Windows PowerShell
   $env:TEST_DATABASE_URL="mysql://db_user:db_password@localhost:3306/crm_db_staging"
   python -m pytest

   # Linux / macOS
   TEST_DATABASE_URL="mysql://db_user:db_password@localhost:3306/crm_db_staging" python -m pytest
   ```
   When `FLASK_TESTING=true` and `TEST_DATABASE_URL` is set, `backend/db.py` uses **only** `TEST_DATABASE_URL` and ignores all other production DB variables. Because the database name ends in `_staging` or `_test`, the write tests will execute safely without touching production data.


