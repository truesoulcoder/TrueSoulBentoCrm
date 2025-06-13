<#
.SYNOPSIS
  Supabase Schema Restore Script for Windows
.DESCRIPTION
  Restores database schema from a backup file
.EXAMPLE
  .\restore_schema.ps1 -DbPassword "your_password" -BackupFile "supabase\backups\schema_backup_20250612194115.sql"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DbPassword,
    
    [Parameter(Mandatory=$true)]
    [ValidateScript({Test-Path $_ -PathType Leaf})]
    [string]$BackupFile
)

Write-Host "Restoring schema from $BackupFile..."

$env:PGPASSWORD = $DbPassword

# First drop all existing objects (careful!)
& psql.exe `
    -h lefvtgqockzqkasylzwb.supabase.co `
    -p 5432 `
    -U postgres `
    -d postgres `
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" `
    -w

# Then restore from backup
& psql.exe `
    -h lefvtgqockzqkasylzwb.supabase.co `
    -p 5432 `
    -U postgres `
    -d postgres `
    -f $BackupFile `
    -w

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore completed successfully" -ForegroundColor Green
} else {
    Write-Host "Restore failed" -ForegroundColor Red
    exit 1
}
