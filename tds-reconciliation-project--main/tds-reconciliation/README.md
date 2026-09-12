# Saarthi TDS Reconciliation System

A full-stack financial reconciliation platform designed to match and reconcile TDS (Tax Deducted at Source) records across Form 26AS data, internal accounting books (TDS Dues), and Tally ledgers.

---

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
  - [1. Backend (`tds-api`)](#1-backend-tds-api)
  - [2. Frontend (`tds-ui`)](#2-frontend-tds-ui)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Running in Development Mode](#running-in-development-mode)
- [API Overview](#api-overview)

---

## Features

- **3-Way TDS Reconciliation:** Matches entries between Form 26AS, Company Books, and Tally exports by TAN and Financial Year.
- **Smart Status Flagging:** Identifies Matched, Mismatched, Missing in 26AS, Missing in Books, and Under/Over-deductions.
- **Batch Data Ingestion:** Upload and parse CSV / Excel files for Form 26AS and Tally ledger reports.
- **Follow-Up Management:** Track communication, notes, accountant contacts, and next follow-up dates for mismatched deductions.
- **Audit & History:** Maintain upload batch history, manual edit audit logs, and status transitions.
- **Multi-Database Support:** Supports Managed MySQL (e.g., Aiven Cloud MySQL with SSL) and local offline SQLite.

---

## Prerequisites

- **Node.js**: `v18.x` or higher (v20+ recommended)
- **npm**: `v9.x` or higher
- **Database (choose one):**
  - **MySQL**: 8.0+ (Local or Cloud Managed like Aiven MySQL)
  - **SQLite**: Local offline database (no external service required)

---

## Project Structure

```text
tds-reconciliation/
├── tds-api/                      # Express.js REST API Backend
│   ├── config/
│   │   └── db.js                 # Unified MySQL/SQLite database adapter
│   ├── controllers/
│   │   ├── followupController.js # Follow-up management logic
│   │   └── tds26asController.js  # 26AS, Books & Tally reconciliation controllers
│   ├── middleware/
│   │   ├── apiKey.js             # API key security validation middleware
│   │   ├── asyncHandler.js       # Express async route wrapper
│   │   ├── errorHandler.js       # Centralised error handler
│   │   └── validator.js          # Request payload validators
│   ├── routes/
│   │   ├── followupRoutes.js     # Follow-up routes (/api/followups)
│   │   ├── tds26asRoutes.js      # Reconciliation & dues routes (/api/tds-26as)
│   │   └── uploads.js            # File upload routes
│   ├── services/
│   │   └── tdsReconciliationService.js # Reconciliation business logic
│   ├── schema_mysql.sql          # MySQL database schema definition
│   ├── schema_sqlite.sql         # SQLite database schema definition
│   ├── .env.example              # Template for API environment variables
│   ├── package.json
│   └── server.js                 # API server entrypoint
│
└── tds-ui/                       # React + Vite Frontend
    ├── src/
    │   ├── api/                  # Axios/Fetch API client functions
    │   ├── components/           # Reusable UI components & layouts
    │   ├── context/              # React context providers
    │   ├── pages/
    │   │   ├── Dashboard/        # Overview & key reconciliation metrics
    │   │   ├── DataImport/       # File upload & batch management
    │   │   ├── FollowUp/         # Client communication & follow-up tracking
    │   │   ├── ImportHistory/    # Historical import logs
    │   │   └── TdsReconciliation/# Reconciliation grid & manual resolution
    │   ├── App.jsx               # Main React application component
    │   ├── main.jsx              # Vite entrypoint
    │   └── index.css             # Tailwind CSS styles
    ├── .env                      # Frontend environment config
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## Installation & Setup

### 1. Backend (`tds-api`)

1. Open a terminal and navigate to the `tds-api` directory:
   ```bash
   cd tds-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your database credentials and API key.

---

### 2. Frontend (`tds-ui`)

1. Open a new terminal and navigate to the `tds-ui` directory:
   ```bash
   cd tds-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (if needed):
   Create or verify `.env` in `tds-ui`:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_API_KEY=your_secure_api_key_here
   ```

---

## Database Setup

The backend automatically executes the appropriate schema script on startup:

- **MySQL Mode (`DB_TYPE=mysql`)**:
  - Automatically loads and executes [schema_mysql.sql](file:///c:/Users/ADMIN/Downloads/finance_Saarthi/tds-reconciliation-project--main/tds-reconciliation/tds-api/schema_mysql.sql) upon server boot.
  - If connecting to Aiven Cloud or SSL-enabled MySQL, ensure `DB_SSL=true` and point `DB_CA_PATH` to your `ca.pem` certificate.

- **SQLite Mode (`DB_TYPE=sqlite`)**:
  - Automatically initializes `local.db` using [schema_sqlite.sql](file:///c:/Users/ADMIN/Downloads/finance_Saarthi/tds-reconciliation-project--main/tds-reconciliation/tds-api/schema_sqlite.sql) with zero manual setup.

---

## Environment Variables

### Backend (`tds-api/.env`)

Refer to [tds-api/.env.example](file:///c:/Users/ADMIN/Downloads/finance_Saarthi/tds-reconciliation-project--main/tds-reconciliation/tds-api/.env.example):

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the Express server | `5000` |
| `DB_TYPE` | Database driver (`mysql` or `sqlite`) | `mysql` |
| `DB_HOST` | Database hostname | `localhost` |
| `DB_USER` | Database username | `root` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DB_NAME` | Database schema name | `defaultdb` |
| `DB_PORT` | Database port number | `3306` (or Aiven port) |
| `DB_SSL` | Enable SSL for DB connection | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Reject untrusted SSL certs | `false` |
| `DB_CA_PATH` | Path to SSL Certificate Authority bundle | `./ca.pem` |
| `API_KEY` | Secret token expected in `X-API-Key` header | `your-secure-api-key-here` |
| `ALLOWED_ORIGINS` | Comma-delimited list of allowed CORS origins | `http://localhost:5173,http://localhost:3000` |

---

## Running in Development Mode

### Start the API Server
```bash
cd tds-api
npm run dev
```
> The API will start on `http://localhost:5000` with nodemon live reloading.

### Start the Frontend UI
```bash
cd tds-ui
npm run dev
```
> The UI development server will start on `http://localhost:5173`.

---

## API Overview

All protected API endpoints require the `X-API-Key` header matching `API_KEY` in your `.env`.

- `GET /health` — Health check endpoint (public)
- `GET /api/tds-26as/summary` — Fetch summary stats across all financial years
- `GET /api/tds-26as/reconciliation` — Fetch reconciliation results by FY and filter status
- `POST /api/tds-26as/upload-26as` — Upload Form 26AS dataset (CSV/Excel)
- `POST /api/tds-26as/upload-tally` — Upload Tally ledger dataset (CSV/Excel)
- `GET /api/followups` — Retrieve follow-up action items
- `POST /api/followups` — Log a new follow-up interaction
