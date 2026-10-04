# Copies today's morning report (ops/reports/YYYY-MM-DD.md, written and pushed
# by the "Site Operations - Daily" cloud routine) to E:\FinancialReports\.
# Run by the Windows scheduled task "FRI Morning Report" at 08:00 JST and
# hourly until noon; also when the PC wakes after a missed run. Reads straight
# from origin/master with `git show`, so the local working tree is untouched.
$ErrorActionPreference = "Stop"
# git prints UTF-8; without this PowerShell decodes it with the console code
# page (cp932 on this PC) and Vietnamese text turns into mojibake.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dest = "E:\FinancialReports"
$log = Join-Path $dest "_fetch.log"
New-Item -ItemType Directory -Force $dest | Out-Null

$jst = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Tokyo Standard Time")
$date = $jst.ToString("yyyy-MM-dd")
$out = Join-Path $dest "$date.md"
if (Test-Path $out) { exit 0 }

try {
  git -C $repo fetch --quiet origin master 2>$null
  $content = git -C $repo show "origin/master:ops/reports/$date.md" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $content) {
    Add-Content $log "$(Get-Date -Format s) $date not published yet"
    exit 0
  }
  [System.IO.File]::WriteAllText($out, ($content -join "`n"), (New-Object System.Text.UTF8Encoding $true))
  Add-Content $log "$(Get-Date -Format s) $date copied"
} catch {
  Add-Content $log "$(Get-Date -Format s) $date error: $_"
}
