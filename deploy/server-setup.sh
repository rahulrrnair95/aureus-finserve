#!/usr/bin/env bash
# One-time setup of an Ubuntu 22.04 VPS for the Aureus Finserve website (run as root):
#   Java 21, SQL Server 2022 Express, Caddy (web server + free automatic HTTPS), firewall, database, service.
# Usage:  sudo bash server-setup.sh aureusfinserve.com
set -euo pipefail

DOMAIN="${1:-aureusfinserve.com}"
APP_USER=aureus
APP_DIR=/opt/aureus
SECRETS="$APP_DIR/backend/config/secrets.yml"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n==> %s\n' "$*"; }
rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
. /etc/os-release
[ "${VERSION_ID:-}" = "22.04" ] || echo "WARNING: tested on Ubuntu 22.04, this is $PRETTY_NAME"

log "System packages"
apt-get update -y
apt-get install -y curl gnupg ca-certificates apt-transport-https software-properties-common ufw openssl unzip

log "Swap (SQL Server + Java need headroom on small servers)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Java 21"
if ! java -version 2>&1 | grep -q '"21'; then
  apt-get install -y openjdk-21-jre-headless || {
    curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg
    echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb jammy main" > /etc/apt/sources.list.d/adoptium.list
    apt-get update -y && apt-get install -y temurin-21-jre
  }
fi

log "SQL Server 2022 Express"
if [ ! -x /opt/mssql/bin/sqlservr ]; then
  curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg
  curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2022.list \
    | sed 's#deb \[#deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg #; s#^deb http#deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] http#' \
    > /etc/apt/sources.list.d/mssql-server-2022.list
  curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
    | sed 's#deb \[#deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg #; s#^deb http#deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] http#' \
    > /etc/apt/sources.list.d/mssql-release.list
  apt-get update -y
  apt-get install -y mssql-server
  ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev
fi

mkdir -p "$APP_DIR/backend/config" "$APP_DIR/frontend"
if [ ! -f "$SECRETS" ]; then
  SA_PW="Sa$(rand 20)9!"
  DB_PW="Db$(rand 20)7!"
  ADMIN_PW="Ad$(rand 14)@7"
  CRYPTO_KEY=$(openssl rand -base64 32)
  HMAC_KEY=$(openssl rand -base64 48)
  log "Configuring SQL Server (Express edition, listens on localhost only)"
  MSSQL_PID=Express ACCEPT_EULA=Y MSSQL_SA_PASSWORD="$SA_PW" /opt/mssql/bin/mssql-conf -n setup accept-eula
  /opt/mssql/bin/mssql-conf set network.ipaddress 127.0.0.1 || true
  /opt/mssql/bin/mssql-conf set memory.memorylimitmb 2048 || true
  systemctl restart mssql-server
  systemctl enable mssql-server
  sleep 15

  log "Creating database AureusFinserve and login aureus_app"
  sed "s/ChangeMe@2026/$DB_PW/" "$(dirname "$0")/create-database.sql" > /tmp/create-database.sql
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PW" -b -i /tmp/create-database.sql
  rm -f /tmp/create-database.sql

  log "Writing $SECRETS"
  cat > "$SECRETS" <<EOF
# LOCAL SECRETS of the live server - do not share. Loaded by application.yml (spring.config.import).
# SQL Server 'sa' password (maintenance only): $SA_PW
server:
  # only Caddy on this server talks to the backend
  address: 127.0.0.1
spring:
  datasource:
    url: jdbc:sqlserver://localhost:1433;databaseName=AureusFinserve;encrypt=true;trustServerCertificate=true
    username: aureus_app
    password: "$DB_PW"
  mail:
    host: smtp.gmail.com
    port: 587
    username: rahulrrnair95@gmail.com
    password: "PASTE-GMAIL-APP-PASSWORD-HERE"
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
      mail.smtp.connectiontimeout: 10000
      mail.smtp.timeout: 10000
      mail.smtp.writetimeout: 10000
app:
  # true shows OTPs on screen (testing only). Set false once e-mail (or SMS) delivers OTPs.
  dev-mode: true
  frontend-url: https://$DOMAIN
  crypto:
    key: "$CRYPTO_KEY"
    hmac-key: "$HMAC_KEY"
  seed:
    sample-data: false
    admin-email: admin@aureusfinserve.in
    admin-password: "$ADMIN_PW"
  mail:
    enabled: false
    notify-to: rahulrrnair95@gmail.com
EOF
  echo "$ADMIN_PW" > /root/aureus-admin-password.txt
  chmod 600 /root/aureus-admin-password.txt
fi

log "App user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 700 "$APP_DIR/backend/config"; chmod 600 "$SECRETS"
chmod 755 "$APP_DIR" "$APP_DIR/frontend"

log "Backend service"
cp "$(dirname "$0")/aureus-backend.service" /etc/systemd/system/aureus-backend.service
systemctl daemon-reload
systemctl enable aureus-backend

log "Caddy (HTTPS web server)"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
sed "s/aureusfinserve.com/$DOMAIN/g" "$(dirname "$0")/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

log "Firewall: SSH, HTTP, HTTPS only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Done"
echo "Admin login: admin@aureusfinserve.in / $(cat /root/aureus-admin-password.txt)  (also in /root/aureus-admin-password.txt)"
echo "Next: run deploy.ps1 on your PC to upload the website and backend."
