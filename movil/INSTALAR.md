# Instalar Arialé Studio en los teléfonos del equipo

La app se instala **una sola vez** en cada teléfono, con un archivo APK.
No hace falta Play Store, ni cuenta de desarrollador, ni pagar nada.

Hay dos papeles distintos:

- **Tú** (una vez): preparas el APK.
- **El equipo** (una vez cada una): lo instala tocando un enlace.

---

## 1. Antes que nada: ¿dónde va a vivir el panel?

La app del teléfono no guarda datos: los pide al panel. Así que lo primero
es decidir en qué dirección va a estar ese panel.

**Opción A — en internet (recomendada).** Publicas el panel en Vercel y la
app apunta a `https://…`. Funciona desde cualquier sitio, con datos móviles,
desde la casa de la clienta o desde el salón.

> Ojo: la base de datos actual es un archivo SQLite. En Vercel ese archivo se
> borra en cada despliegue, así que hay que mover la base a **Turso** (es
> libSQL, el mismo motor; solo cambia la dirección de conexión). Es un cambio
> de configuración, no de código.

**Opción B — en la computadora del salón.** Dejas `npm run dev` corriendo en
la PC del estudio y la app apunta a `http://192.168.x.x:3000`, la IP de esa
PC en el wifi del local. Más simple, pero solo funciona dentro del salón y
con la computadora encendida.

> Para saber la IP: `ipconfig` en la terminal, y busca "Dirección IPv4" del
> adaptador que uses (Ethernet o Wi-Fi). Antes de compilar, abre esa
> dirección **desde el navegador del teléfono**: si no carga, es el
> Firewall de Windows o una VPN activa, no la app.

Anota la dirección que elijas: la vas a usar en el paso 3.

---

## 2. Preparar tu computadora (solo la primera vez)

1. Instala **Android Studio** desde <https://developer.android.com/studio>.
   Son unos 10 GB; se usa solo para compilar, nadie más lo necesita.
2. **Ábrelo una vez y termina el asistente de bienvenida.** Este paso es el
   que descarga de verdad el *Android SDK*; con instalar el programa no
   basta. Al terminar debe existir la carpeta
   `C:UsersTU_USUARIOAppDataLocalAndroidSdk`.
3. Acepta las licencias desde la terminal, en la carpeta del proyecto:

   ```powershell
   .\flutter\bin\flutter.bat doctor --android-licenses
   ```

4. Comprueba que todo está en verde:

   ```powershell
   .\flutter\bin\flutter.bat doctor
   ```

### Crear la llave de firma (solo la primera vez)

Android exige que la app vaya firmada. La llave es tuya y **no se sube al
repositorio**: si la pierdes, no podrás publicar actualizaciones sobre la
misma app y habría que desinstalar y volver a instalar.

```powershell
keytool -genkey -v -keystore $HOME\ariale-studio.jks -keyalg RSA `
  -keysize 2048 -validity 10000 -alias ariale
```

Te pedirá una contraseña y algunos datos. Luego crea el archivo
`movil\android\key.properties` con lo que acabas de usar:

```properties
storeFile=C:/Users/TU_USUARIO/ariale-studio.jks
storePassword=la-que-pusiste
keyAlias=ariale
keyPassword=la-que-pusiste
```

Guarda una copia del `.jks` y de esas contraseñas en un sitio seguro.
Si no creas la llave, el APK igual se construye (firmado con la llave de
pruebas), pero conviene tener la propia desde el principio.

---

## 3. Construir el APK

Desde la carpeta `movil`:

```powershell
.\construir-apk.ps1 -Servidor "https://ariale.vercel.app"
```

(o la dirección que hayas elegido en el paso 1).

Al terminar te dice dónde quedó el archivo:

```
movil\build\app\outputs\flutter-apk\app-release.apk
```

Ese archivo, de unos 25 MB, es la app.

---

## 4. Pasárselo al equipo

Lo más cómodo es subirlo a **GitHub Releases** y compartir el enlace:

1. En <https://github.com/KronnicxZ/ariale/releases> → *Draft a new release*.
2. Ponle una versión (`v1.0`), arrastra el `app-release.apk` y publica.
3. Copia el enlace del archivo y mándalo por WhatsApp al grupo del equipo.

También sirve mandar el APK directo por WhatsApp, pero a veces lo comprime o
lo bloquea; el enlace es más fiable.

---

## 5. Lo que hace cada una en su teléfono

1. Abre el enlace y descarga el archivo.
2. Lo toca. Android avisa: *"Por seguridad, tu teléfono no permite instalar
   apps de esta fuente"*. Toca **Configuración → Permitir de esta fuente**.
3. **Instalar** → **Abrir**.
4. Entra con su correo y su contraseña.

Ya está. Queda en el teléfono con la florecita dorada, se llama
**Arialé Studio** y se abre como cualquier otra app.

> Android puede mostrar un aviso de Play Protect diciendo que no reconoce la
> app. Es normal en apps que no vienen de la tienda: **Instalar de todos
> modos**.

---

## Actualizar la app más adelante

Cuando cambies algo:

1. Sube el número de versión en `pubspec.yaml` (`version: 0.1.0+1` → `0.2.0+2`).
2. Vuelve a correr `.\construir-apk.ps1`.
3. Publica el nuevo APK y avisa al equipo.

Al instalar encima, se actualiza y **no se pierde nada**: los datos están en
el panel, no en el teléfono. Eso sí, hay que usar la misma llave de firma.

---

## Si algo no funciona

**"No pudimos conectar con el servidor."**
La app no alcanza el panel. Comprueba que el panel está encendido y que la
dirección es la correcta. En la pantalla de acceso, abajo, hay un enlace
discreto para **cambiar la dirección del servidor** sin recompilar nada.

**"Tu sesión caducó."**
La sesión dura 180 días. Solo hay que entrar de nuevo.

**La app abre pero no se ve nada.**
Baja para refrescar. Si sigue vacío, casi siempre es que la fecha del
teléfono está mal o que el panel se quedó sin responder.
