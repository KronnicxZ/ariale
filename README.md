# Arialé Studio

Sistema de gestión para el estudio: agenda, clientas, ventas, cobros, compras,
gastos y reportes, con manicura, pedicura y depilación en el mismo catálogo.

La app tiene **tres puertas de entrada**, cada una con su sesión:

| Zona | Ruta | Entra con | Qué puede hacer |
| --- | --- | --- | --- |
| Panel | `/panel` | Correo y contraseña | Todo: agenda, clientas, dinero, catálogo, ajustes |
| Especialista | `/agenda/<slug>` | PIN de 4 dígitos | Solo su agenda del día y agendar citas |
| Clienta | `/reservar` | Su número de teléfono | Reservar, ver su historial y sus bonos |

## Arrancar en local

```bash
npm install
cp .env.example .env      # y cambia SESSION_SECRET
npx prisma migrate dev    # crea dev.db en la raíz
npm run seed              # datos de ejemplo con el catálogo real
npm run dev
```

Abre <http://localhost:3000>.

**Accesos de ejemplo** (los crea el seed):

Cada una del equipo entra con su cuenta y las dos ven la misma agenda:

- Alejandra (uñas y pies): `alejandra@arialestudio.com` / `alejandra2026`
- Arianny (depilación): `arianny@arialestudio.com` / `arianny2026`
- Agenda de la especialista: `/agenda/alejandra` con PIN `1234`
- Zona clienta: `/reservar` con cualquier teléfono del seed, por ejemplo `04241112233`

## Cómo está hecho

- **Next.js 16** (App Router) + **React 19**, con Server Components y Server Actions.
  No hay API REST propia: los formularios llaman directo a las acciones.
- **TypeScript**, **Tailwind v4** y **shadcn/ui** sobre Radix.
- **Prisma 7** con driver adapter. En local corre sobre SQLite vía libSQL.
- **Recharts** para los gráficos; **date-fns** con `@date-fns/tz` para la zona
  horaria del salón (`America/Caracas` por defecto).
- Sesiones con **JWT firmado en cookie httpOnly** (`jose`), contraseñas con `bcryptjs`.

### La app gira alrededor de la agenda

`/panel` es **Hoy**: la agenda del día como protagonista, con la próxima cita
resaltada, la tira de la semana para saltar de día y un botón grande de
agendar. El dinero aparece resumido en tres cifras que llevan a Reportes; el
análisis a fondo (gráficos, ranking de servicios, reparto por categoría) vive
en `/panel/reportes`, no en la portada.

Está pensada **primero para el móvil**: barra inferior con Hoy, Agenda,
Clientas y Cobrar; acciones principales a ancho completo al alcance del
pulgar; y los accesos secundarios al final de cada pantalla, sin competir con
lo que se usa a diario.

### Decisiones que conviene conocer

**El dinero se guarda en centavos de dólar** (enteros). Nunca en coma flotante.
Los bolívares se calculan al mostrar, con la tasa del día, y el importe en Bs.
nunca se persiste: si la tasa cambia, los históricos siguen siendo correctos.

**La tasa BCV se consulta sola** y se cachea una fila por día en `ExchangeRate`.
Si no hay internet se usa la última conocida y se marca como desactualizada.
Desde *Mi negocio → Moneda* se puede pasar a modo manual.

**Las ventas se reconocen por fecha de venta y los cobros por fecha de pago.**
Por eso "Ventas" y "Cobrado" pueden no coincidir en un mismo periodo: esa
diferencia es justamente la cartera por cobrar.

**Una cuenta por cobrar es una venta con saldo y fecha de vencimiento.** No hay
una tabla aparte, así no hay dos sitios donde el mismo saldo pueda desincronizarse.
Lo mismo con las cuentas por pagar y las compras.

**Los precios y duraciones se congelan al agendar.** Si mañana subes el precio de
un servicio, las citas ya agendadas mantienen el que se pactó.

**Los huecos libres se revalidan al guardar**, no solo al mostrarlos: entre que
la clienta ve los horarios y pulsa confirmar, alguien pudo tomar el suyo.

**Los recordatorios no se envían solos.** La app arma el mensaje y abre WhatsApp
(`wa.me`) con un toque. Cero costo, cero API de Meta, y siempre controlas qué se
dice. Están en `/panel/recordatorios`.

### Depilación

Además del catálogo, la depilación tiene su propio modelo:

- Cada servicio lleva **zona corporal**, **método** (cera, azúcar, hilo, láser)
  y **cada cuántos días conviene repetir**.
- Los **bonos** (`/panel/bonos`) son paquetes de N sesiones prepagadas. Al cobrar
  una cita puedes descontar la sesión del bono en vez de cobrarla.
- Con el ciclo de cada servicio, la app calcula **a quién le toca repetir** y lo
  saca en Recordatorios y en la ficha de la clienta.
- Los servicios pueden marcarse como que **requieren prueba de sensibilidad**, y
  las alergias de la clienta se resaltan al abrir su cita.

## Estructura

```
prisma/schema.prisma        Modelo de datos
prisma/seed.ts              Datos de ejemplo (catálogo y precios reales)
src/actions/                Server Actions, agrupadas por dominio
src/data/                   Consultas de lectura y cálculo de métricas
src/lib/                    Dinero, fechas, tasa BCV, sesiones, huecos libres
src/components/booking/     Asistente de reserva, compartido por las tres zonas
src/components/panel/       Piezas del panel (KPIs, filtros, agenda)
src/app/panel/              Panel administrativo
src/app/agenda/[slug]/      Zona de la especialista (móvil)
src/app/reservar/           Zona de la clienta (móvil, pública)
```

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run seed         # recarga los datos de ejemplo (borra los actuales)
npm run db:migrate   # nueva migración tras tocar el schema
npm run db:studio    # explorador visual de la base de datos
npm run lint
```

## Desplegar en Vercel

SQLite no sirve en Vercel porque el sistema de archivos es efímero. Hay dos
caminos; el esquema es el mismo, solo cambia el adaptador.

### Opción A — Turso (libSQL, el cambio más corto)

Ya usamos el driver de libSQL, así que no hay que tocar código:

1. Crea una base en [turso.tech](https://turso.tech) y copia su URL y token.
2. En Vercel define `DATABASE_URL` (`libsql://…`), `DATABASE_AUTH_TOKEN`,
   `SESSION_SECRET` y `NEXT_PUBLIC_APP_URL`.
3. `npx prisma migrate deploy` apuntando a esa base.

### Opción B — Postgres (Neon, Supabase o Vercel Postgres)

1. En `prisma/schema.prisma` cambia `provider = "sqlite"` por `"postgresql"`.
2. `npm i @prisma/adapter-pg pg` y en `src/lib/db.ts` sustituye `PrismaLibSql`
   por `new PrismaPg({ connectionString: process.env.DATABASE_URL })`.
3. Borra `prisma/migrations` y regenera con `npx prisma migrate dev --name init`.
4. Define las variables de entorno en Vercel y `npx prisma migrate deploy`.

En ambos casos, después del primer despliegue crea la usuaria administradora
(el seed sirve, o `npx tsx prisma/seed.ts` contra la base de producción) y
actualiza `NEXT_PUBLIC_APP_URL` con el dominio real, porque de ahí salen los
enlaces de reserva que se comparten por WhatsApp.
