# Nize Logistics - Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Render account (for backend)
- PostgreSQL database (Render provides free tier)

---

## Backend Deployment (Render)

### 1. Prepare Database
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "PostgreSQL"
3. Name: `nize-logistics-db`
4. Region: `Frankfurt` (or closest to you)
5. Plan: `Free`
6. Click "Create Database"
7. Copy the **Internal Database URL** (starts with `postgresql://`)

### 2. Deploy Backend
1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository
5. Configure:
   - **Name**: `nize-logistics-api`
   - **Region**: `Frankfurt`
   - **Branch**: `main`
   - **Root Directory**: `apps/backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

6. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=<paste Internal Database URL from step 1>
   JWT_SECRET=<generate a random 64-character string>
   PAYSTACK_SECRET_KEY=<your paystack secret key>
   PAYSTACK_PUBLIC_KEY=<your paystack public key>
   FRONTEND_URL=<will add after frontend deployment>
   ```

7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Copy your backend URL (e.g., `https://nize-logistics-api.onrender.com`)

### 3. Initialize Database
1. Go to your backend service in Render
2. Click "Shell" tab
3. Run:
   ```bash
   psql $DATABASE_URL < init-db.sql
   ```
4. Verify tables created successfully

### 4. Create Super Admin
In Render Shell:
```bash
node -e "
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const hash = await bcrypt.hash('admin123', 10);
  await client.query(
    'INSERT INTO users (email, password, role, full_name) VALUES ($1, $2, $3, $4)',
    ['admin@nizelogistics.com', hash, 'super_admin', 'Super Admin']
  );
  console.log('Super admin created!');
  await client.end();
})();
"
```

---

## Frontend Deployment (Vercel)

### 1. Deploy to Vercel
1. Go to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=<your backend URL from Render>
   NEXT_PUBLIC_SOCKET_URL=<your backend URL from Render>
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=<your paystack public key>
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your VAPID key or leave as is>
   ```

6. Click "Deploy"
7. Wait for deployment (3-5 minutes)
8. Copy your frontend URL (e.g., `https://nize-logistics.vercel.app`)

### 2. Update Backend CORS
1. Go back to Render backend service
2. Go to "Environment" tab
3. Update `FRONTEND_URL` environment variable with your Vercel URL
4. Click "Save Changes" (will trigger redeploy)

---

## Post-Deployment Setup

### 1. Test the Application
1. Visit your Vercel URL
2. Try to login with super admin:
   - Email: `admin@nizelogistics.com`
   - Password: `admin123`
3. Change the password immediately

### 2. Invite Admin Users
1. Login as super admin
2. Go to Admin Dashboard
3. Click "Invite Admin"
4. Enter email and send invite

### 3. Configure Paystack Webhook
1. Go to [Paystack Dashboard](https://dashboard.paystack.com/)
2. Settings → Webhooks
3. Add webhook URL: `<your-backend-url>/api/paystack/webhook`
4. Copy webhook secret
5. Add to Render environment variables: `PAYSTACK_WEBHOOK_SECRET`

---

## Environment Variables Reference

### Backend (.env)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=your-64-char-random-string
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_WEBHOOK_SECRET=...
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## Troubleshooting

### Backend not connecting to database
- Check `DATABASE_URL` is correct
- Verify database is running in Render
- Check backend logs in Render

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings in backend
- Verify `FRONTEND_URL` in backend matches Vercel URL

### Paystack payments not working
- Check live API keys (not test)
- Verify webhook is configured
- Check webhook secret matches

### Socket.io not connecting
- Verify `NEXT_PUBLIC_SOCKET_URL` matches backend URL
- Check browser console for errors
- Ensure backend allows WebSocket connections

---

## Free Tier Limits

### Render (Backend)
- ✅ 750 hours/month free
- ✅ 512 MB RAM
- ⚠️ Spins down after 15 min inactivity (cold starts)
- ✅ PostgreSQL 1GB storage

### Vercel (Frontend)
- ✅ 100 GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Auto SSL certificates
- ✅ Global CDN

---

## Production Checklist

- [ ] Backend deployed to Render
- [ ] Database initialized with schema
- [ ] Super admin account created
- [ ] Frontend deployed to Vercel
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] Paystack webhook configured
- [ ] Test login works
- [ ] Test order creation works
- [ ] Test payment flow works
- [ ] Test real-time updates work
- [ ] Change default passwords
- [ ] Set up monitoring/alerts

---

## Monitoring

### Render Logs
- Backend logs: `Logs` tab in Render service
- Real-time logs: `Events` tab

### Vercel Logs
- Deployment logs: Click on deployment
- Runtime logs: `Functions` tab

### Database Monitoring
- Render: `Metrics` tab in PostgreSQL service
- Check connection pool usage
- Monitor storage usage

---

## Backup & Recovery

### Database Backup
```bash
# In Render Shell
pg_dump $DATABASE_URL > backup.sql
```

### Restore Database
```bash
# In Render Shell
psql $DATABASE_URL < backup.sql
```

---

## Support

- **Backend Issues**: Check Render logs
- **Frontend Issues**: Check Vercel logs and browser console
- **Database Issues**: Check Render PostgreSQL metrics
- **Payment Issues**: Check Paystack dashboard

---

## Next Steps

1. Set up custom domain (optional)
2. Configure email service for notifications
3. Set up error monitoring (Sentry, etc.)
4. Configure backup schedule
5. Set up staging environment
