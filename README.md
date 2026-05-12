# 💎 Silver Palace — Jewelry Management System

> Enterprise-grade POS, inventory, and wholesale management for silver jewelry shops.
> Built for scale: 50,000+ products, multi-role, Docker-ready.

---

## ✨ Features

| Module | Description |
|---|---|
| **POS Terminal** | Scan QR/SKU → Cart → Checkout → Receipt |
| **Inventory** | 50k+ products, weight-based, QR labels per item |
| **Live Pricing** | Retail & wholesale auto-computed from silver gram price |
| **QR Codes** | Auto-generated per product, scannable at POS |
| **Customers** | Retail walk-ins & wholesale accounts with credit limits |
| **Sales** | Full invoice history, returns, payment tracking |
| **Reports** | Daily revenue, cashier breakdown, stock analytics |
| **Role-based** | owner / manager / cashier / wholesaler / viewer |

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your values

# 2. Start all services
docker compose up -d

# 3. Open the app
open http://localhost
```

The app will be available at **http://localhost**

---

## 🛠️ Local Development

### Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 🏗️ Architecture

```
silver-shop/
├── frontend/           React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/        Axios API layer
│   │   ├── components/ Reusable UI + Layout
│   │   ├── context/    Auth state (React Context)
│   │   └── pages/      Dashboard, POS, Products, Customers, Sales, Reports, Settings
│   ├── Dockerfile      Multi-stage build (Node → Nginx)
│   └── nginx.conf      SPA routing + API proxy
│
├── backend/            Node.js + Express + Mongoose
│   ├── src/
│   │   ├── models/     User, Product, Customer, Sale, SilverPrice
│   │   ├── controllers/Auth, Product, Customer, Sale, SilverPrice
│   │   ├── middlewares/JWT auth + role-based authorization
│   │   ├── routes/     All API routes
│   │   └── utils/      JWT, pricing engine, QR generator
│   └── Dockerfile      Production Node Alpine image
│
├── docker-compose.yml  MongoDB + Backend + Frontend + DB Admin
├── mongo-init.js       DB initialization + indexes
└── .env.example        Environment variables template
```

---

## 🔐 Default Roles

| Role | Access |
|---|---|
| `owner` | Full access to everything |
| `manager` | Products, POS, Customers, Reports, Silver price |
| `cashier` | POS terminal, view products/customers |
| `wholesaler` | View wholesale-available products only |
| `viewer` | Read-only product listing |

---

## 📡 API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register user |
| POST | `/api/auth/signin` | Login |
| GET  | `/api/products` | List products (paginated, filtered) |
| GET  | `/api/products/scan/:query` | POS scan by SKU/barcode |
| POST | `/api/products` | Create product (auto QR) |
| GET  | `/api/silver/active` | Current silver price |
| POST | `/api/silver` | Update silver price |
| POST | `/api/sales` | POS checkout |
| GET  | `/api/sales/report/daily` | Daily report |
| GET  | `/api/customers` | List customers |

---

## 🐳 Docker Services

| Service | Port | Description |
|---|---|---|
| `frontend` | 80 | React app via Nginx |
| `backend` | 5000 (internal) | Express API |
| `mongo` | 27017 | MongoDB 7.0 |
| `mongo-express` | 8081 | DB admin UI (--profile tools) |

### Run DB admin UI
```bash
docker compose --profile tools up -d
# Visit http://localhost:8081
```

---

## ⚙️ Environment Variables

See `.env.example` for all configurable options.

Key variables:
- `JWT_SECRET` — Change in production!
- `SILVER_GRAM_PRICE` — Default silver price (update via Settings page)
- `SHOP_TAX_RATE` — Tax rate (e.g. 0.08 = 8%)
- `APP_PORT` — External port for the app (default: 80)

---

## 📦 Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, React Router v6, Axios, Recharts, React Hot Toast

**Backend:** Node.js, Express, Mongoose, JWT, bcryptjs, QRCode, express-validator

**Infrastructure:** Docker, Nginx, MongoDB 7.0

---

© Silver Palace Jewelry Management System · Enterprise Edition
