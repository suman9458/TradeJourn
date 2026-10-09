# TRADING COMMAND CENTER (TradeJourn MERN)

A scalable, institutional-grade **MERN Stack** (MongoDB, Express, React, Node.js) trading journal, execution analytics, and psychology audit platform designed for discretionary forex and CFD traders at high user volume.

---

## 🌟 Architecture & Highlights

- **MongoDB & Mongoose**:
  - High-performance compound indexes (`userId + date`, `userId + result`, `userId + setupRating`, `userId + session`, `userId + emotion`).
  - Server-side Aggregation Pipelines for KPIs, setup win rates, and mistake costs capable of handling hundreds of thousands of trades across multiple users.
  - **Zero-Config Hybrid Database Connection**: Connects to MongoDB Atlas or local MongoDB when configured in `server/.env`, and automatically falls back to an embedded in-memory MongoDB server for instant local testing with zero setup.
- **Express.js & Node.js REST API**:
  - Multi-tenant data isolation with JWT authentication and bcrypt password hashing.
  - Enterprise security with `helmet`, `cors`, `compression`, and `express-rate-limit`.
  - Comprehensive endpoints for trades, analytics, equity curves, reviews, playbook rules, goals, and AI coaching.
- **Modern React & Vite Frontend**:
  - Dark-mode financial terminal aesthetic inspired by Bloomberg and TradingView.
  - Bespoke Vanilla CSS design system with CSS custom properties, glassmorphism, responsive CSS Grid, and custom animations.
  - Interactive SVG Cumulative R Equity Curve with hover tooltips and peak R tracking.
  - Real-time Discipline Score preview in the Quick Add Trade modal.
  - Dual AI Coach: Strict grounded deterministic audit (no hallucination) + Live OpenAI GPT-4o interactive chat.
  - Searchable, filterable database views with quick chips (Winners, Losers, Early Exits, Mistakes, Sessions) and one-click CSV export.

---

## 📁 Project Structure

```text
TradeJourn/
├── client/                     # Frontend (React 18 + Vite)
│   ├── src/
│   │   ├── components/         # Modular React components
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── KPICards.jsx
│   │   │   ├── SummaryCards.jsx
│   │   │   ├── EquityChart.jsx
│   │   │   ├── AnalyticsView.jsx
│   │   │   ├── EarlyExitsView.jsx
│   │   │   ├── AICoachView.jsx
│   │   │   ├── ReviewsView.jsx
│   │   │   ├── PlaybookView.jsx
│   │   │   ├── GoalsView.jsx
│   │   │   ├── TradesTableView.jsx
│   │   │   ├── QuickAddTradeModal.jsx
│   │   │   ├── AuthModal.jsx
│   │   │   └── SettingsModal.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx # JWT Auth & Demo Trader mode
│   │   ├── services/
│   │   │   └── api.js          # Centralized API service
│   │   ├── App.jsx             # Main dashboard assembly
│   │   ├── index.css           # Vanilla CSS Design System
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js          # Vite with /api reverse proxy
├── server/                     # Backend (Node.js + Express + Mongoose)
│   ├── config/
│   │   └── db.js               # Hybrid Mongo connection
│   ├── controllers/            # Business logic & aggregations
│   │   ├── authController.js
│   │   ├── tradeController.js
│   │   ├── analyticsController.js
│   │   ├── reviewController.js
│   │   ├── playbookController.js
│   │   ├── goalController.js
│   │   └── aiController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   └── errorHandler.js     # Centralized error handler
│   ├── models/                 # Mongoose schemas
│   │   ├── User.js
│   │   ├── Trade.js
│   │   ├── Playbook.js
│   │   └── Goal.js
│   ├── routes/                 # Express REST endpoints
│   ├── utils/
│   │   └── seedData.js         # Realistic demo trader dataset
│   ├── .env.example
│   ├── package.json
│   └── server.js               # Main Express entry point
├── package.json                # Monorepo concurrent runner
└── README.md
```

---

## 🚀 Getting Started

### 1. Install Dependencies

From the project root:

```bash
npm install
npm run install:all
```

*(On Windows PowerShell, use `npm.cmd run install:all`)*

### 2. Configure Environment (Optional)

In `server/.env`:

```env
PORT=5000
NODE_ENV=development
# Leave blank for automated zero-config in-memory MongoDB, or provide your Atlas URI:
MONGODB_URI=
JWT_SECRET=super_secret_trading_command_center_jwt_token_2026_secure
JWT_EXPIRE=30d
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=
```

### 3. Run Development Servers Concurrently

Run both the backend API and frontend client with a single command:

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

*(The application automatically boots in Demo Mode with 10 realistic Forex & CFD trades pre-populated so you can test all charts, analytics, and reviews immediately without manual setup).*

---

## 🔒 Security & Scale Considerations

1. **Multi-Tenancy**: Every trade, rule, and goal is strictly scoped by `userId` to ensure data isolation.
2. **Database Indexing**: Compound indexes on `{ userId: 1, date: -1 }`, `{ userId: 1, result: 1 }`, and `{ userId: 1, setupRating: 1 }` prevent full collection scans.
3. **Response Compression**: Gzip/Brotli compression enabled for API responses.
4. **Rate Limiting**: Protects against brute-force attacks and abuse.
5. **Anti-Hallucination AI**: The coaching engine is strictly grounded in actual user records.
