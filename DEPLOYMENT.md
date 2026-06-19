# CrowdCity Production Deployment Guide

This document describes the steps required to deploy the CrowdCity platform in a production environment.

---

## 1. Supabase Cloud Configuration

### Database Schema Setup
1. Log into your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** in your project.
3. Paste and run the DDL schema script from [supabase/schema.sql](file:///c:/Users/dhanu/OneDrive/Desktop/CrowdCity%20AI/supabase/schema.sql).
4. Next, paste and run the index schema from [supabase/indexes.sql](file:///c:/Users/dhanu/OneDrive/Desktop/CrowdCity%20AI/supabase/indexes.sql) to set up production indexes.

### Storage Buckets Setup
1. Go to the **Storage** section in Supabase.
2. Create a new bucket named `issue-images`.
3. Set the bucket privacy toggle to **Public**.
4. In the **Policies** section of the bucket, create the following policies:
   * **Insert Policy**: Allow uploads from `authenticated` users only.
   * **Select Policy**: Allow `public` access for everyone.

---

## 2. Environment Configuration

Create a `.env` file in the project root containing production values (avoid committing this file to version control):

```env
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://crowdcity.yourdomain.com

# Get these from console.groq.com
GROQ_API_KEY=gsk_your_live_production_groq_api_key

# Get these from Supabase Project Settings -> API
SUPABASE_URL=https://your-live-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Containerized Deployment (Docker Compose)

The easiest way to deploy the system is using Docker and Docker Compose.

```bash
# 1. Clone your repository and navigate into the root directory
cd crowdcity

# 2. Build and launch containers in detached (background) mode
docker compose up -d --build

# 3. Check logs to ensure successful startup
docker compose logs -f

# 4. To stop the containers
docker compose down
```

The logs will be persisted on the host system under the `./logs` directory with rolling daily file rotation.

---

## 4. Alternate Systemd & PM2 Daemon Deployment

If you are deploying directly onto a Linux VM (Ubuntu/Debian) without Docker:

### Install PM2
```bash
sudo npm install -g pm2
```

### Start Server via PM2
```bash
# Start server as process daemon
NODE_ENV=production PM2_HOME=/var/pm2 pm2 start server/server.js --name "crowdcity"

# Generate systemd startup scripts to run on boot
pm2 startup systemd
pm2 save
```

---

## 5. Nginx Reverse Proxy Setup (with Let's Encrypt TLS)

Install Nginx on your production VM and configure a reverse proxy at `/etc/nginx/sites-available/crowdcity`:

```nginx
server {
    listen 80;
    server_name crowdcity.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and obtain an SSL certificate:

```bash
# Enable config
sudo ln -s /etc/nginx/sites-available/crowdcity /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install certbot and request SSL certificates
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d crowdcity.yourdomain.com
```

---

## 6. Daily Database Backups

Because Supabase has automatic backups on paid tiers, you can rely on their infrastructure. However, for manual CLI-based raw SQL backups, you can configure a daily cron job using pg_dump:

```bash
# Create backup cron script (e.g. /home/ubuntu/backup.sh)
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DB_CONN="postgresql://postgres:[password]@db.[supabase-ref].supabase.co:5432/postgres"
mkdir -p $BACKUP_DIR
pg_dump $DB_CONN > $BACKUP_DIR/db_backup_$(date +%F).sql
find $BACKUP_DIR -type f -mtime +14 -delete # keep 14 days of backups
```

Make it executable and add to crontab:
```bash
chmod +x /home/ubuntu/backup.sh
crontab -e
# Add line: 0 2 * * * /home/ubuntu/backup.sh (Runs daily at 2:00 AM)
```
