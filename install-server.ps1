# DestekOfis - Windows sunucu kurulumu (gecici; Faz 1'de Windows servisi + setup.exe ile degisecek)
# PowerShell'i yönetici olarak çalıştırın.
param(
  [int]$Port = 5123,
  [string]$InstallDir = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 22 veya daha yeni bir sürüm bulunamadı. Önce Node.js kurun.' }
$major = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($major -lt 22) { throw "Node.js 22 veya daha yeni bir sürüm gerekli. Bulunan: $major" }

New-NetFirewallRule -DisplayName 'Hukuk Ofisi Merkezi' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
$taskName = 'Hukuk Ofisi Merkezi Server'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$InstallDir\start-server.cmd`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Write-Host "Kurulum tamamlandı. Port: $Port"
Write-Host "Server adresini görmek için: ipconfig"
Write-Host "Client adresi örneği: http://SERVER-IP:$Port"
Write-Host "İlk giriş: admin / Ofis2026! (sistem ilk girişte yeni parola ister)"
