# Construye el APK de Arialé Studio listo para instalar en los teléfonos.
#
#   .\construir-apk.ps1 -Servidor "https://ariale.vercel.app"
#
# El APK sale en build\app\outputs\flutter-apk\app-release.apk.
# Ese archivo es el que se le pasa al equipo por WhatsApp o por un enlace.

param(
    # Dirección del panel. La app la trae puesta de fábrica; igual se puede
    # cambiar desde la pantalla de acceso si algún día cambia el servidor.
    [Parameter(Mandatory = $true)]
    [string]$Servidor
)

$ErrorActionPreference = 'Stop'
$flutter = Join-Path $PSScriptRoot '..\flutter\bin\flutter.bat'

if (-not (Test-Path $flutter)) {
    throw "No encontré Flutter en $flutter"
}

if ($Servidor -notmatch '^https?://') {
    throw "La dirección debe empezar por http:// o https:// (recibí: $Servidor)"
}

# Sin barra final: la app concatena las rutas directamente.
$Servidor = $Servidor.TrimEnd('/')

Write-Host "Compilando contra $Servidor ..." -ForegroundColor Yellow

& $flutter build apk --release "--dart-define=SERVIDOR=$Servidor"
if ($LASTEXITCODE -ne 0) { throw "La compilación falló." }

$apk = Join-Path $PSScriptRoot 'build\app\outputs\flutter-apk\app-release.apk'
$peso = [math]::Round((Get-Item $apk).Length / 1MB, 1)

Write-Host ""
Write-Host "Listo: $apk ($peso MB)" -ForegroundColor Green
Write-Host "Pásaselo al equipo y que lo abran desde el teléfono." -ForegroundColor Green
