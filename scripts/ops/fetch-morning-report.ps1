# Copies today's morning report (ops/reports/YYYY-MM-DD.md) and the day's
# copy-paste posts file (ops/posts/YYYY-MM-DD.md), both written and pushed by
# the "Site Operations - Daily" cloud routine, to E:\FinancialReports\ (the
# posts file under E:\FinancialReports\posts\).
# Run by the Windows scheduled task "FRI Morning Report" at 07:30 JST (the
# ops routine fires 22:05 UTC = 07:05 JST and pushes by ~07:20) and hourly
# until noon; also when the PC wakes after a missed run. Reads straight
# from origin/master with `git show`, so the local working tree is untouched.
$ErrorActionPreference = "Stop"
# git prints UTF-8; without this PowerShell decodes it with the console code
# page (cp932 on this PC) and Vietnamese text turns into mojibake.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dest = "E:\FinancialReports"
$log = Join-Path $dest "_fetch.log"
New-Item -ItemType Directory -Force $dest | Out-Null
New-Item -ItemType Directory -Force (Join-Path $dest "posts") | Out-Null

$jst = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Tokyo Standard Time")
$date = $jst.ToString("yyyy-MM-dd")

# Each entry: the path in the repo and where it lands on E:.
$files = @(
  @{ src = "ops/reports/$date.md"; out = (Join-Path $dest "$date.md"); label = "$date" },
  @{ src = "ops/posts/$date.md"; out = (Join-Path $dest "posts\$date.md"); label = "$date posts" }
)
$pending = @($files | Where-Object { -not (Test-Path $_.out) })
if ($pending.Count -eq 0) { exit 0 }

try {
  git -C $repo fetch --quiet origin master 2>$null
  foreach ($f in $pending) {
    $content = git -C $repo show "origin/master:$($f.src)" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $content) {
      Add-Content $log "$(Get-Date -Format s) $($f.label) not published yet"
      continue
    }
    [System.IO.File]::WriteAllText($f.out, ($content -join "`n"), (New-Object System.Text.UTF8Encoding $true))
    Add-Content $log "$(Get-Date -Format s) $($f.label) copied"
  }
} catch {
  Add-Content $log "$(Get-Date -Format s) $date error: $_"
}
