# La base de datos del estudio

## Lo primero: ya es real

Todo lo que se guarda en la app va a un archivo, `dev.db`, en esta carpeta.
No es una simulación: cada cita, cada cobro y cada gasto queda escrito ahí y
sigue estando después de apagar la computadora. Ahora mismo ocupa menos de
un mega.

Lo que **no** es todavía es *segura* ni *accesible desde fuera*. Eso son dos
problemas distintos y se arreglan por separado.

---

## Antes de usarla de verdad

### 1. Borra los datos de ejemplo

Las ocho clientas, las citas y las ventas que ves ahora son inventadas.

```powershell
npm run limpiar
```

Se lleva el movimiento inventado y **conserva lo que costó ajustar**: la
configuración del negocio, el horario, las cuentas de Alejandra y Arianny,
el catálogo de servicios con sus precios, los bonos y las categorías de
gasto. Pide confirmación escribiendo "borrar".

### 2. Nunca vuelvas a correr `npm run seed`

Ese comando borra todo y reescribe los datos de ejemplo. Ya está protegido:
si encuentra citas o ventas se planta y no toca nada. Solo obedece con
`npm run seed -- --forzar`, que es una frase que no se escribe sin querer.

---

## Respaldos

```powershell
npm run respaldo
```

Copia la base a `respaldos\ariale-2026-09-03-0014.db`. Como es un solo
archivo, restaurar es copiarlo de vuelta encima de `dev.db` con la app
apagada. Guarda los treinta últimos y borra los más viejos.

Hazlo **una vez por semana** mientras la base viva en la computadora, y
guarda una copia fuera de la máquina —Drive, un pendrive—. Un disco que se
rompe se lleva el archivo y no hay vuelta atrás.

---

## Ver y ajustar los datos a mano

```powershell
npm run db:studio
```

Abre una tabla en el navegador donde se ve y se edita todo: clientas,
citas, ventas, precios. Sirve para arreglar un dato que quedó mal sin tener
que buscar la pantalla correspondiente.

Con cuidado: aquí no hay red de seguridad. Borrar una venta desde aquí no
avisa de que la cita se queda huérfana. Para el día a día, la app.

---

## Sacarla de la computadora

Hoy la base vive en una sola máquina. Eso significa dos cosas: si esa
máquina se rompe, se pierde todo; y la app del teléfono solo funciona
dentro del wifi del salón, con la computadora encendida.

La salida natural es **Turso**: es el mismo motor de base de datos que ya
usamos (libSQL), alojado por ellos. Su plan gratuito da 500 bases y 9 GB,
que para un estudio de dos personas no se acaba nunca.

Lo importante: **no hay que cambiar código**. La app ya lee la dirección de
la base desde el entorno.

### Pasos

1. Crea la cuenta en <https://turso.tech> e instala su herramienta.

2. Crea la base y súbele lo que ya tienes:

   ```powershell
   turso db create ariale
   turso db shell ariale < respaldos\el-ultimo.sql
   ```

   Para generar ese `.sql` a partir del archivo actual:

   ```powershell
   sqlite3 dev.db .dump > respaldos\el-ultimo.sql
   ```

3. Pide la dirección y la llave:

   ```powershell
   turso db show ariale --url
   turso db tokens create ariale
   ```

4. Ponlas en `.env`:

   ```properties
   DATABASE_URL="libsql://ariale-tuusuario.turso.io"
   DATABASE_AUTH_TOKEN="el-token-largo"
   ```

5. Arranca y comprueba que los datos están ahí. Nada más.

A partir de ahí los respaldos los hace Turso, y `npm run respaldo` te dirá
que ya no hace falta.

### Y después, el panel en internet

Con la base en Turso, publicar el panel en Vercel es el último paso: se
suben las mismas dos variables más `SESSION_SECRET`, y la app del teléfono
pasa a apuntar a `https://…` en vez de a la IP del salón. Entonces funciona
desde cualquier sitio, con datos móviles, sin depender de que la
computadora esté encendida.

Ver [movil/INSTALAR.md](movil/INSTALAR.md) para recompilar el APK con la
dirección nueva.
