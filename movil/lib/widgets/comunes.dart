import 'package:flutter/material.dart';

import '../api/modelos.dart';
import '../formato.dart';
import '../tema.dart';

/// Etiqueta de estado de una cita o una venta. Plana y pequeña: informa,
/// no grita.
class Etiqueta extends StatelessWidget {
  const Etiqueta(this.texto, {super.key, required this.color});

  final String texto;
  final Color color;

  factory Etiqueta.cita(String estado) {
    final (texto, color) = switch (estado) {
      'PENDING' => ('Por confirmar', Marca.alerta),
      'CONFIRMED' => ('Confirmada', Marca.exito),
      'ATTENDED' => ('Atendida', Marca.textoSuave),
      'CANCELLED' => ('Cancelada', Marca.textoSuave),
      'NO_SHOW' => ('No asistió', Marca.error),
      _ => (estado, Marca.textoSuave),
    };
    return Etiqueta(texto, color: color);
  }

  factory Etiqueta.venta(String estado) {
    final (texto, color) = switch (estado) {
      'PAID' => ('Pagado', Marca.exito),
      'PARTIAL' => ('Pagó una parte', Marca.alerta),
      'PENDING' => ('Sin pagar', Marca.error),
      'CANCELLED' => ('Anulada', Marca.textoSuave),
      _ => (estado, Marca.textoSuave),
    };
    return Etiqueta(texto, color: color);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        texto,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: color,
        ),
      ),
    );
  }
}

/// Aviso que solo aparece cuando hay algo que atender. Es una fila blanca
/// con su icono a color, como una celda de lista: se lee sin esfuerzo y no
/// tiñe media pantalla.
class Aviso extends StatelessWidget {
  const Aviso({
    super.key,
    required this.icono,
    required this.texto,
    required this.color,
    this.alTocar,
  });

  final IconData icono;
  final String texto;
  final Color color;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Marca.tarjeta,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
          child: Row(
            children: [
              Icon(icono, size: 19, color: color),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  texto,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (alTocar != null)
                const Icon(Icons.chevron_right, size: 20, color: Marca.textoTenue),
            ],
          ),
        ),
      ),
    );
  }
}

/// Estado vacío con una salida clara, nunca un callejón sin salida.
class Vacio extends StatelessWidget {
  const Vacio({
    super.key,
    required this.icono,
    required this.titulo,
    this.descripcion,
    this.accion,
  });

  final IconData icono;
  final String titulo;
  final String? descripcion;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 52),
      child: Column(
        children: [
          Icon(icono, size: 30, color: Marca.textoTenue),
          const SizedBox(height: 14),
          Text(
            titulo,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 16,
              letterSpacing: -0.3,
            ),
          ),
          if (descripcion != null) ...[
            const SizedBox(height: 6),
            Text(descripcion!, textAlign: TextAlign.center, style: sutil(13.5)),
          ],
          if (accion != null) ...[const SizedBox(height: 18), accion!],
        ],
      ),
    );
  }
}

/// Muestra el error de la API con un botón de reintento.
class ErrorConReintento extends StatelessWidget {
  const ErrorConReintento({super.key, required this.mensaje, required this.alReintentar});

  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 30, color: Marca.textoTenue),
            const SizedBox(height: 14),
            Text(mensaje, textAlign: TextAlign.center, style: sutil(14)),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: alReintentar,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tira de días con su número de citas. Se desliza con el pulgar.
class TiraDias extends StatelessWidget {
  const TiraDias({
    super.key,
    required this.dias,
    required this.diaActivo,
    required this.hoy,
    required this.alElegir,
  });

  final List<DiaResumen> dias;
  final String diaActivo;
  final String hoy;
  final ValueChanged<String> alElegir;

  static const _nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        itemCount: dias.length,
        separatorBuilder: (_, _) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final dia = dias[i];
          final activo = dia.dia == diaActivo;
          final esHoy = dia.dia == hoy;

          return Material(
            color: activo ? Marca.texto : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              onTap: () => alElegir(dia.dia),
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                width: 56,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      esHoy ? 'HOY' : _nombres[dia.diaSemana].toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: activo ? Colors.white70 : Marca.textoTenue,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${dia.numero}',
                      style: cifra(
                        20,
                        color: activo ? Colors.white : Marca.texto,
                        peso: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      dia.citas > 0 ? '${dia.citas}' : '—',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: activo
                            ? Colors.white70
                            : dia.citas > 0
                                ? Marca.textoSuave
                                : Marca.textoTenue,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Una cita en la lista del día. Es la pieza más usada de la app: hora a la
/// izquierda, nombre en negrita y el resto en gris, como una celda de iOS.
class TarjetaCita extends StatelessWidget {
  const TarjetaCita({
    super.key,
    required this.cita,
    required this.negocio,
    required this.prefijo,
    this.esProxima = false,
    this.alTocar,
  });

  final Cita cita;
  final String negocio;
  final String prefijo;
  final bool esProxima;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final color = Marca.desdeHex(cita.especialistaColor);

    return Opacity(
      opacity: cita.cancelada ? 0.5 : 1,
      child: Material(
        color: Marca.tarjeta,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: esProxima
                  ? Border.all(color: Marca.dorado, width: 1.5)
                  : null,
            ),
            padding: const EdgeInsets.fromLTRB(14, 13, 10, 13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 74,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(hora(cita.inicio), style: cifra(15.5)),
                      const SizedBox(height: 1),
                      Text(duracion(cita.duracionMin), style: sutil(11.5)),
                      if (esProxima) ...[
                        const SizedBox(height: 6),
                        Text(
                          'AHORA',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                            color: Marca.dorado,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            margin: const EdgeInsets.only(right: 7),
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Flexible(
                            child: Text(
                              cita.clientaNombre,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15.5,
                                letterSpacing: -0.3,
                                decoration:
                                    cita.cancelada ? TextDecoration.lineThrough : null,
                              ),
                            ),
                          ),
                          if (cita.porConfirmar) ...[
                            const SizedBox(width: 7),
                            Etiqueta.cita(cita.estado),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        cita.resumenServicios,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: sutil(13.5),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${cita.especialistaNombre} · ${dinero(cita.totalCentavos)}'
                        '${cita.cobrada ? ' · cobrada' : ''}',
                        style: sutil(12.5, color: Marca.textoTenue),
                      ),
                      if (cita.nota != null && cita.nota!.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(
                          cita.nota!,
                          style: sutil(12.5, color: Marca.textoSuave)
                              .copyWith(fontStyle: FontStyle.italic),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Escribir por WhatsApp',
                  onPressed: () => abrirWhatsApp(
                    cita.clientaTelefono,
                    Mensajes.citaConfirmada(
                      clienta: cita.clientaNombre,
                      cuando: cita.inicio,
                      servicios: cita.resumenServicios,
                      negocio: negocio,
                      totalCentavos: cita.totalCentavos,
                    ),
                    prefijo: prefijo,
                  ),
                  icon: const Icon(Icons.chat_bubble_outline, size: 19),
                  color: Marca.exito,
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tarjeta de cabecera de una lista: la cifra que resume todo y un apoyo.
class Cabecera extends StatelessWidget {
  const Cabecera({
    super.key,
    required this.etiqueta,
    required this.valor,
    this.apoyo,
    this.accion,
    this.colorValor,
  });

  final String etiqueta;
  final String valor;
  final String? apoyo;
  final Widget? accion;
  final Color? colorValor;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(etiqueta, style: sutil(12.5)),
                  const SizedBox(height: 3),
                  Text(valor, style: cifra(28, color: colorValor)),
                  if (apoyo != null) ...[
                    const SizedBox(height: 2),
                    Text(apoyo!, style: sutil(12.5, color: Marca.textoTenue)),
                  ],
                ],
              ),
            ),
            if (accion != null) accion!,
          ],
        ),
      ),
    );
  }
}

/// Título de sección dentro de una pantalla larga.
class Seccion extends StatelessWidget {
  const Seccion(this.rotulo, {super.key, this.apoyo});

  final String rotulo;
  final String? apoyo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 26, bottom: 10, left: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: titulo(19)),
          if (apoyo != null) ...[
            const SizedBox(height: 2),
            Text(apoyo!, style: sutil(12.5)),
          ],
        ],
      ),
    );
  }
}

/// Fila de dato: rótulo a la izquierda, valor a la derecha.
class FilaDato extends StatelessWidget {
  const FilaDato(this.rotulo, this.valor, {super.key, this.destacado = false, this.color});

  final String rotulo;
  final String valor;
  final bool destacado;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              rotulo,
              style: destacado
                  ? const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                    )
                  : sutil(14),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            valor,
            textAlign: TextAlign.right,
            style: cifra(destacado ? 16 : 14.5, color: color),
          ),
        ],
      ),
    );
  }
}

/// Barra proporcional para comparar categorías o servicios sin un gráfico.
class BarraProporcion extends StatelessWidget {
  const BarraProporcion({
    super.key,
    required this.rotulo,
    required this.valor,
    required this.maximo,
    required this.color,
    this.apoyo,
  });

  final String rotulo;
  final int valor;
  final int maximo;
  final Color color;
  final String? apoyo;

  @override
  Widget build(BuildContext context) {
    final fraccion = maximo <= 0 ? 0.0 : (valor / maximo).clamp(0.0, 1.0);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  rotulo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(dinero(valor), style: cifra(14)),
            ],
          ),
          if (apoyo != null) Text(apoyo!, style: sutil(11.5, color: Marca.textoTenue)),
          const SizedBox(height: 7),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: fraccion,
              minHeight: 5,
              backgroundColor: Marca.fondo,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ],
      ),
    );
  }
}
