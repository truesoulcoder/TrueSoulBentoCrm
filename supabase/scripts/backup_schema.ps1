<#
.SYNOPSIS
  Supabase Schema Backup Script for Windows
.DESCRIPTION
  Creates timestamped schema backups of your Supabase database
.EXAMPLE
  .\backup_schema.ps1 -DbPassword "your_password"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DbPassword
)

$BackupDir = "supabase\backups"
$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$BackupFile = "$BackupDir\schema_backup_$Timestamp.sql"

# Create backup directory if it doesn't exist
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "Backing up schema to $BackupFile..."

& pg_dump.exe `
    -h lefvtgqockzqkasylzwb.supabase.co `
    -p 5432 `
    -U postgres `
    -d postgres `
    --schema-only `
    --no-owner `
    --no-privileges `
    -f $BackupFile `
    -w

$env:PGPASSWORD = $DbPassword

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully" -ForegroundColor Green
    Write-Host "File saved to: $BackupFile"
} else {
    Write-Host "Backup failed" -ForegroundColor Red
    exit 1
}
