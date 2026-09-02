# Arialé Studio — app del equipo

La app de Android del estudio. Es el mismo panel que la web, escrito en
Flutter y pensado para el pulgar: agenda, clientas, caja y reportes.

No guarda datos: todo lo pide al panel por `/api/v1/*` con un token Bearer.
La base de datos y las reglas de negocio viven en un solo sitio, el proyecto
Next.js de la carpeta de arriba.

## Cómo está organizada

```
lib/
  main.dart          Arranque y puerta de entrada (sesión o acceso)
  tema.dart          Colores, tipografías y estilos de la marca
  formato.dart       Dinero, fechas y los mensajes de WhatsApp
  sesion.dart        Cliente de la API y catálogo al alcance de todos
  api/
    cliente.dart     Peticiones HTTP, token guardado y errores legibles
    modelos.dart     Los datos que devuelve la API, uno a uno
  widgets/           Piezas que se repiten: tarjetas, avisos, barras
  pantallas/         Una por pantalla; las cuatro de la barra y el resto
```

Las cuatro pestañas de abajo son el día a día — **Hoy**, **Agenda**,
**Clientas**, **Cobrar** — y **Más** guarda lo que se consulta de vez en
cuando: ventas, gastos, compras, proveedores, recordatorios, reportes,
catálogo, equipo y los datos del negocio.

## Trabajar en ella

```powershell
..\flutter\bin\flutter.bat pub get
..\flutter\bin\flutter.bat run --dart-define=SERVIDOR=http://10.0.2.2:3000
```

En el emulador de Android, `10.0.2.2` es la computadora anfitriona; en un
teléfono real hay que poner la IP de la PC en el wifi del salón. Sin
`--dart-define` la app usa esos valores por defecto, y la dirección también
se puede cambiar desde la pantalla de acceso.

El panel tiene que estar corriendo (`npm run dev` en la carpeta de arriba).

Antes de subir cambios:

```powershell
..\flutter\bin\flutter.bat analyze
```

## Publicarla en los teléfonos del equipo

Ver [INSTALAR.md](INSTALAR.md).

## Mensajes a las clientas

Nada se envía solo. La app arma el texto y abre WhatsApp para que la dueña
lo lea y pulse enviar. Las plantillas están en `formato.dart`, en `Mensajes`,
y son las mismas que usa la web.
