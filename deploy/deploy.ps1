# Builds the website + backend on this PC and uploads them to the VPS.
#
# First time (sets up the server, then deploys):
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server 203.0.113.10 -Setup
# Every later update:
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server 203.0.113.10
#
# Uses the SSH key ~/.ssh/aureus_vps (its public half must be added to the server when you create it).
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [string]$User = "root",
    [string]$Key = "$env:USERPROFILE\.ssh\aureus_vps",
    [string]$Domain = "aureusfinserve.com",
    [switch]$Setup,
    [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = "$User@$Server"
$sshArgs = @("-i", $Key, "-o", "StrictHostKeyChecking=accept-new")

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Yellow }
function Ssh([string]$cmd) {
    & ssh @sshArgs $target $cmd
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed ($LASTEXITCODE): $cmd" }
}
function Scp([string]$from, [string]$to) {
    & scp @sshArgs $from "${target}:$to"
    if ($LASTEXITCODE -ne 0) { throw "Upload failed: $from" }
}

Step "Checking SSH access to $target"
Ssh "echo connected to `$(hostname)"

if ($Setup) {
    Step "Uploading setup files"
    Ssh "mkdir -p /root/aureus-setup"
    Scp "$root\deploy\server-setup.sh" "/root/aureus-setup/server-setup.sh"
    Scp "$root\deploy\Caddyfile" "/root/aureus-setup/Caddyfile"
    Scp "$root\deploy\aureus-backend.service" "/root/aureus-setup/aureus-backend.service"
    Scp "$root\database\create-database.sql" "/root/aureus-setup/create-database.sql"
    Step "Running server setup (10-15 minutes the first time)"
    Ssh "sed -i 's/\r$//' /root/aureus-setup/*.sh /root/aureus-setup/Caddyfile /root/aureus-setup/*.service /root/aureus-setup/*.sql && bash /root/aureus-setup/server-setup.sh $Domain"
}

if (-not $SkipBuild) {
    Step "Building backend"
    Push-Location "$root\backend"
    & .\mvnw.cmd -q -DskipTests package
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Backend build failed" }
    Pop-Location
    Step "Building website"
    Push-Location "$root\frontend"
    & npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Website build failed" }
    Pop-Location
}

Step "Uploading backend"
Scp "$root\backend\target\aureus-backend-1.0.0.jar" "/tmp/aureus-backend.jar"

Step "Uploading website"
$tar = Join-Path $env:TEMP "aureus-frontend.tar.gz"
if (Test-Path $tar) { Remove-Item $tar }
& tar -czf $tar -C "$root\frontend\dist" .
if ($LASTEXITCODE -ne 0) { throw "Could not package the website" }
Scp $tar "/tmp/aureus-frontend.tar.gz"

Step "Installing and restarting"
Ssh "set -e; install -o aureus -g aureus -m 644 /tmp/aureus-backend.jar /opt/aureus/backend/aureus-backend.jar; rm -rf /opt/aureus/frontend.new && mkdir -p /opt/aureus/frontend.new && tar -xzf /tmp/aureus-frontend.tar.gz -C /opt/aureus/frontend.new && rm -rf /opt/aureus/frontend.old && (mv /opt/aureus/frontend /opt/aureus/frontend.old || true) && mv /opt/aureus/frontend.new /opt/aureus/frontend && chown -R aureus:aureus /opt/aureus/frontend && chmod -R a+rX /opt/aureus/frontend; rm -f /tmp/aureus-backend.jar /tmp/aureus-frontend.tar.gz; systemctl restart aureus-backend"

Step "Waiting for the backend to start (first start loads ~900 funds: up to 2 minutes)"
Ssh "for i in `$(seq 1 60); do curl -fs -o /dev/null http://127.0.0.1:8080/api/public/site && echo 'backend is up' && exit 0; sleep 5; done; echo 'backend did not answer - check: journalctl -u aureus-backend -n 100'; exit 1"

Write-Host "`nDeployed. Open https://$Domain (HTTPS works once the GoDaddy DNS points to $Server)." -ForegroundColor Green
if ($Setup) { Write-Host "Admin password: ssh -i $Key $target cat /root/aureus-admin-password.txt" }
