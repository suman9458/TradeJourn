# 🚀 TradeJourn — Production Deployment & Go-Live Master Checklist
> **Document Purpose:** This persistent checklist tracks all configuration items, external service credentials, and infrastructure hardening required before deploying TradeJourn to production for high-volume trading users.
> 
> *When you are ready to go live, refer directly to this list or prompt: `"I am ready to go live, give me the deployment checklist."`*

---

## 📋 Quick Status Matrix

| Component | Current Development State | Required for High-Volume Production | Priority |
| :--- | :--- | :--- | :--- |
| **Twilio SMS OTP** | Dev Mode (Console logs + 1-click UI auto-fill) | Live Twilio Account credentials in `.env` | 🔴 High |
| **Email SMTP OTP** | Dev Fallback | SendGrid / Brevo / AWS SES SMTP credentials | 🟡 Medium |
| **Database** | Zero-config in-memory MongoDB Server | MongoDB Atlas Cluster (M10+ recommended) | 🔴 High |
| **JWT Secrets** | Hardcoded development fallback key | Cryptographically random 64-character secret | 🔴 High |
| **CORS / Client URL**| `http://localhost:5173` | Production domain (e.g. `https://tradejourn.com`) | 🔴 High |
| **AI Trading Coach** | Local user key or empty fallback | Production Google Gemini / OpenAI API Key | 🟡 Medium |
| **Environment Mode**| `NODE_ENV=development` | `NODE_ENV=production` | 🔴 High |
| **Process Manager** | `nodemon` / `npm run dev` | `PM2` clustering or Docker container | 🟢 Medium |

---

## 1. 📱 Twilio SMS OTP System (Stored Configuration)

The OTP system has been engineered with a multi-channel architecture (`server/services/otpService.js` and `server/models/OtpToken.js`). When deployed to production, it automatically sends real SMS codes to traders' phones upon entering these keys.

### Credentials Required in `.env`:
```env
# Twilio Console: https://console.twilio.com
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### Steps to Activate Live Twilio:
1. Create or log into your account at [console.twilio.com](https://console.twilio.com).
2. Copy your **Account SID** and **Auth Token** from the dashboard.
3. Purchase an SMS-enabled phone number (or configure an Alphanumeric Sender ID if supported in your region).
4. Paste the 3 keys into `server/.env`.
5. When `NODE_ENV=production` is set, development OTP hints are automatically hidden from API responses, and every OTP is dispatched via Twilio SMS.

---

## 2. 📧 Transactional Email & Email OTP Backup

If traders reset their passwords via email or if SMS is unavailable:

### Credentials in `.env`:
```env
# Example using SendGrid, Brevo, or Gmail SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key
EMAIL_FROM="TradeJourn Security" <no-reply@yourdomain.com>
```

---

## 3. 🗄️ Database: MongoDB Atlas (Large User Scale)

Currently, the server boots a zero-config in-memory database if no URI is provided. For real users and permanent trade data persistence, connect to a cloud MongoDB Atlas cluster.

### Action Items:
1. Create a free or dedicated cluster on [cloud.mongodb.com](https://cloud.mongodb.com).
2. Set up a Database User with read/write access.
3. Whitelist your production server IP (or `0.0.0.0/0` with secure credentials).
4. Paste into `server/.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/tradejourn?retryWrites=true&w=majority&maxPoolSize=50
```
5. **Connection Pooling**: Notice `maxPoolSize=50` added to handle concurrent requests from hundreds of active traders smoothly.

---

## 4. 🔒 Security & JWT Session Hardening

### Generate a Production Secret:
Run this command in terminal to generate a secure 48-byte cryptographic random string:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste it into `server/.env`:
```env
JWT_SECRET=your_generated_cryptographic_hex_string_here
JWT_EXPIRE=30d
NODE_ENV=production
```

### CORS Security:
Prevent unauthorized third-party websites from making API calls to your trading backend:
```env
CLIENT_URL=https://tradejourn.com
```

---

## 5. 🤖 Google Gemini AI Trading Coach

To enable high-speed AI playbook audits, trade reviews, and psychological feedback for all users:
1. Visit [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Generate an API key.
3. Paste into `server/.env`:
```env
GEMINI_API_KEY=AIzaSyYourProductionGeminiKeyHere
```

---

## 6. 🌐 Frontend Build & Reverse Proxy (Nginx / Cloudflare)

### Build the Optimized Frontend Bundle:
```bash
npm --prefix client run build
```
This produces an ultra-fast minified production build in `client/dist`.

### Example Nginx Reverse Proxy Configuration:
```nginx
server {
    listen 80;
    server_name tradejourn.com www.tradejourn.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tradejourn.com;

    ssl_certificate /etc/letsencrypt/live/tradejourn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tradejourn.com/privkey.pem;

    # Serve Vite React Frontend
    location / {
        root /var/www/tradejourn/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API to Node Backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 7. 🚀 Process Management (PM2 Clustering)

To run the backend resiliently on multi-core servers with auto-restart on crashes:
```bash
npm install -g pm2
pm2 start server/server.js --name "tradejourn-api" -i max
pm2 save
pm2 startup
```

---

## 8. 🛡️ Verification Checklist Before Opening to Traders

- [ ] `NODE_ENV=production` set in environment.
- [ ] MongoDB Atlas connected and verified with indexes (`users`, `trades`, `otptokens`).
- [ ] `JWT_SECRET` updated to long random key.
- [ ] `TWILIO_*` credentials tested with a live mobile number.
- [ ] `SMTP_*` email tested with a test recipient.
- [ ] SSL certificate active (HTTPS padlock in browser).
- [ ] Demo terminal button verified or restricted to guest tier as desired.
- [ ] Terms & Conditions verified and acceptance checkbox active.

---
*Created by TradeJourn Automated DevOps & Security System. Keep this file updated as new third-party integrations are added.*
