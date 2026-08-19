#Requires -Version 5.1
<#
.SYNOPSIS
  Копирует skill kontrol-materialov в Hermes (WSL Ubuntu).

.DESCRIPTION
  Hermes на этом ПК запускается через WSL. Skill кладётся в ~/.hermes/skills/
#>
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$WslDistro = "Ubuntu"
)

$skillSrc = Join-Path $RepoRoot "skill\kontrol-materialov"
$skillDest = "~/.hermes/skills/kontrol-materialov"

if (-not (Test-Path (Join-Path $skillSrc "SKILL.md"))) {
  Write-Error "SKILL.md not found at $skillSrc"
  exit 1
}

Write-Host "Installing skill to WSL ($WslDistro)..."
# Windows path -> WSL /mnt/c/...
$drive = $skillSrc.Substring(0, 1).ToLower()
$rest = $skillSrc.Substring(2) -replace '\\', '/'
$wslSrc = "/mnt/$drive/$rest"
$cmd = "mkdir -p ~/.hermes/skills && rm -rf ~/.hermes/skills/kontrol-materialov && cp -r '$wslSrc' ~/.hermes/skills/ && echo 'OK: skill installed to ~/.hermes/skills/kontrol-materialov'"

wsl -d $WslDistro -e bash -lc $cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy config/telegram-users.example.json -> config/telegram-users.json"
Write-Host "  2. Copy .env.example -> .env and set AGENT_API_TOKEN"
Write-Host "  3. Restart Hermes gateway: wsl -d Ubuntu -e bash -lc 'systemctl --user restart hermes-gateway'"
