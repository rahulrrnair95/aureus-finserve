# Putting aureusfinserve.com live on a VPS

Everything runs on one small Ubuntu server: the website, the Java backend, SQL Server Express and the Caddy web
server (free, automatic HTTPS certificate). Cost: about ₹700–1,700 a month for the server.

## 1. Buy the VPS

- Provider in India (Mumbai / Bangalore), for example Hostinger VPS (KVM 2), AWS Lightsail (Mumbai) or DigitalOcean (Bangalore).
- **Ubuntu 22.04**, at least **4 GB RAM** (8 GB is comfortable), 2 vCPU, 50 GB+ disk.
- When it asks for an **SSH key**, paste this public key (it lets the deploy script log in; it is not a password):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPYPcJX6TDX2ahljy+u9OxbCh5yspzGTK8Qgd2x2pNcn aureus-deploy
```

  (The private half is on this PC at `%USERPROFILE%\.ssh\aureus_vps` - keep it safe, never share it.)
- Note the server's **public IPv4 address** (e.g. `203.0.113.10`).

## 2. Point the domain at the server (GoDaddy)

GoDaddy → My Products → aureusfinserve.com → **DNS** → Manage DNS:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | your server IP | 600 seconds |
| CNAME | `www` | `aureusfinserve.com` | 1 hour |

Delete any other **A** record for `@` (GoDaddy's "Parked" record) and turn off domain **Forwarding** if it is on.
DNS changes usually take 10–60 minutes.

## 3. Set up and deploy (from this PC)

From the project folder (`D:\Aureus Finserve`):

```powershell
# first time: installs everything on the server, then uploads the site (10-15 minutes)
powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server YOUR.SERVER.IP -Setup

# every later update of the website / backend
powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server YOUR.SERVER.IP
```

The first run prints the **admin password** for `admin@aureusfinserve.in` (a new one, different from this PC's).
Once DNS points to the server, Caddy gets the HTTPS certificate by itself and https://aureusfinserve.com is live.

On first start the server's database loads the website content, all funds (from AMFI) and NFOs - no sample clients.
Team members, AMC list and content come from the same first-start data as this PC.

## 4. After going live

- **E-mail alerts:** on the server, edit `/opt/aureus/backend/config/secrets.yml` (Gmail app password under
  `spring.mail.password`, `app.mail.enabled: true`), then `systemctl restart aureus-backend`.
- **Dev mode:** `app.dev-mode: true` shows login OTPs on screen - anyone could log in as any user. Set it to `false`
  in the same file once OTP e-mails work, then restart.
- **Logs:** `journalctl -u aureus-backend -f` (backend), `/var/log/caddy/aureusfinserve.log` (web).
- **Daily updates** (NAVs, scheme details, new schemes, NFOs) run on the server by themselves - it is always on.
- **Backups:** take the provider's automatic snapshot/backup option, or back up the SQL Server database regularly.

## Files

| File | What it is |
|---|---|
| `server-setup.sh` | one-time server setup (run by `deploy.ps1 -Setup`) |
| `Caddyfile` | web server: HTTPS, website, `/api` → backend |
| `aureus-backend.service` | keeps the backend running and restarts it after a crash or reboot |
| `deploy.ps1` | builds on this PC and uploads to the server |
