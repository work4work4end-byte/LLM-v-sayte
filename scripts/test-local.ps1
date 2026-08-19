#Requires -Version 5.1
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$Token = $env:AGENT_API_TOKEN
)

Set-Location $RepoRoot

Write-Host "=== 1. Mapping check ===" -ForegroundColor Cyan
if (Test-Path "config\telegram-users.json") {
  node scripts/check-mapping.mjs
} else {
  Write-Host "WARN: config/telegram-users.json not found. Copy from config/telegram-users.example.json" -ForegroundColor Yellow
}

Write-Host "`n=== 2. Unit tests ===" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 3. API health (needs site running + token) ===" -ForegroundColor Cyan
if (-not $Token) {
  Write-Host "SKIP: set AGENT_API_TOKEN in .env or env var" -ForegroundColor Yellow
  exit 0
}

$headers = @{ "X-Agent-Token" = $Token }
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/agent/health" -Headers $headers -UseBasicParsing -TimeoutSec 5
  Write-Host "health: $($r.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "health FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  -> Site agent API may not be implemented yet (option 1 from setup)"
  Write-Host "  -> Or run: cd ..\kontrol-materialov && npm run dev"
}

Write-Host "`n=== 4. CLI smoke ===" -ForegroundColor Cyan
node scripts/site-api.mjs health 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "CLI health failed (expected until site API exists)" -ForegroundColor Yellow
}

Write-Host "`nDone."
