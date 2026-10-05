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
    [string]$Servidor,

    # Por defecto se compila solo para ARM64, que es lo que llevan todos los
    # teléfonos de los últimos años: 22 MB en vez de 58. Con -Universal sale
    # un APK que funciona también en teléfonos viejos de 32 bits.
    [switch]$Universal,

    # El "client ID de tipo web" del proyecto de Google, para "Entrar con
    # Google". Si no se pasa, se busca GOOGLE_CLIENT_ID en el .env de la
    # raíz; si tampoco está, el APK sale sin los botones de Google en vez de
    # salir con botones que fallan.
    [string]$ClienteGoogle
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

$arquitectura = if ($Universal) { 'todos los procesadores' } else { 'ARM64' }
Write-Host "Compilando contra $Servidor ($arquitectura)..." -ForegroundColor Yellow

if (-not $ClienteGoogle) {
    $archivoEnv = Join-Path $PSScriptRoot '..\.env'
    if (Test-Path $archivoEnv) {
        $linea = Select-String -Path $archivoEnv -Pattern '^GOOGLE_CLIENT_ID=' | Select-Object -First 1
        if ($linea) { $ClienteGoogle = ($linea.Line -replace '^GOOGLE_CLIENT_ID=', '').Trim('"', "'", ' ') }
    }
}

if ($ClienteGoogle) {
    Write-Host "Con entrar con Google." -ForegroundColor Yellow
} else {
    Write-Host "Sin entrar con Google: falta GOOGLE_CLIENT_ID." -ForegroundColor DarkYellow
}

# Java escribe avisos en stderr y, con ErrorActionPreference en 'Stop',
# PowerShell los toma por fallos y aborta un build que salió bien. Lo que
# dice de verdad si funcionó es el código de salida.
$ErrorActionPreference = 'Continue'
$definiciones = @("--dart-define=SERVIDOR=$Servidor")
if ($ClienteGoogle) { $definiciones += "--dart-define=GOOGLE_CLIENT_ID=$ClienteGoogle" }

if ($Universal) {
    & $flutter build apk --release @definiciones
} else {
    & $flutter build apk --release --target-platform android-arm64 @definiciones
}
$codigo = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($codigo -ne 0) { throw "La compilación falló (código $codigo)." }

$apk = Join-Path $PSScriptRoot 'build\app\outputs\flutter-apk\app-release.apk'
$peso = [math]::Round((Get-Item $apk).Length / 1MB, 1)

Write-Host ""
Write-Host "Listo: $apk ($peso MB)" -ForegroundColor Green
Write-Host "Pásaselo al equipo y que lo abran desde el teléfono." -ForegroundColor Green
