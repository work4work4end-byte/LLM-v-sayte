#Requires -Version 5.1
# Дополняет ~/.hermes/.env ключами сайта и Telegram (не затирает OLLAMA и др.)
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$WslDistro = "Ubuntu-24.04"
)

$envFile = Join-Path $RepoRoot ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Not found: $envFile"
  exit 1
}

$drive = $RepoRoot.Substring(0, 1).ToLower()
$rest = $RepoRoot.Substring(2) -replace '\\', '/'
$wslRoot = "/mnt/$drive/$rest"

Write-Host "Syncing Hermes env in WSL ($WslDistro)..."
wsl -d $WslDistro -e bash -lc "cd '$wslRoot' && node scripts/sync-hermes-env.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done."
