import 'package:flutter/material.dart';

import '../api/modelos.dart';
import '../formato.dart';
import '../tema.dart';

/// Etiqueta de estado de una cita o una venta.
class Etiqueta extends StatelessWidget {
  const Etiqueta(this.texto, {super.key, required this.color});

  final String texto;
  final Color color;

  factory Etiqueta.cita(String estado) {
    final (texto, color) = switch (estado) {
      'PENDING' => ('Por confirmar', Marca.alerta),
      'CONFIRMED' => ('Confirmada', Marca.exito),
      'ATTENDED' => ('Atendida', Marca.dorado),
      'CANCELLED' => ('Cancelada', Marca.textoSuave),
      'NO_SHOW' => ('No asistió', Marca.error),
      _ => (estado, Marca.textoSuave),
    };
    return Etiqueta(texto, color: color);
  }

  factory Etiqueta.venta(String estado) {
    final (texto, color) = switch (estado) {
      'PAID' => ('Pagado', Marca.exito),
      'PARTIAL' => ('Parcial', Marca.alerta),
      'PENDING' => ('Pendiente', Marca.error),
      'CANCELLED' => ('Anulada', Marca.textoSuave),
      _ => (estado, Marca.textoSuave),
    };
    return Etiqueta(texto, color: color);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        texto,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

/// Aviso que solo aparece cuando hay algo que atender.
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
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icono, size: 18, color: color),
              const SizedBox(width: 10),
              Expanded(child: Text(texto, style: const TextStyle(fontSize: 14))),
              if (alTocar != null)
                const Icon(Icons.arrow_forward, size: 16, color: Marca.textoSuave),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 44),
      decoration: BoxDecoration(
        border: Border.all(color: Marca.borde),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          Icon(icono, size: 34, color: Marca.textoSuave.withValues(alpha: 0.5)),
          const SizedBox(height: 12),
          Text(titulo, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          if (descripcion != null) ...[
            const SizedBox(height: 6),
            Text(
              descripcion!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Marca.textoSuave, fontSize: 13.5),
            ),
          ],
          if (accion != null) ...[const SizedBox(height: 16), accion!],
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
            const Icon(Icons.cloud_off, size: 38, color: Marca.textoSuave),
            const SizedBox(height: 14),
            Text(
              mensaje,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Marca.textoSuave, fontSize: 14),
            ),
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
      height: 82,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: dias.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final dia = dias[i];
          final activo = dia.dia == diaActivo;
          final esHoy = dia.dia == hoy;

          return Material(
            color: activo ? Marca.dorado : Marca.tarjeta,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: () => alElegir(dia.dia),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 68,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: activo ? Marca.dorado : Marca.borde),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      esHoy ? 'HOY' : _nombres[dia.diaSemana].toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: activo ? Marca.negro.withValues(alpha: 0.7) : Marca.textoSuave,
                      ),
                    ),
                    Text(
                      '${dia.numero}',
                      style: cifra(21, color: activo ? Marca.negro : Marca.texto),
                    ),
                    Text(
                      dia.citas > 0 ? '${dia.citas} cita${dia.citas == 1 ? '' : 's'}' : 'Libre',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: dia.citas > 0 ? FontWeight.w600 : FontWeight.w400,
                        color: activo
                            ? Marca.negro.withValues(alpha: 0.7)
                            : dia.citas > 0
                                ? Marca.dorado
                                : Marca.textoSuave.withValues(alpha: 0.7),
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

/// Una cita en la lista del día. Es la pieza más usada de la app.
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
      opacity: cita.cancelada || cita.atendida ? 0.65 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: Marca.tarjeta,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: esProxima ? Marca.dorado : Marca.borde,
            width: esProxima ? 2 : 1,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: alTocar,
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 66,
                    child: Column(
                      children: [
                        Text(hora(cita.inicio), style: cifra(15)),
                        const SizedBox(height: 2),
                        Text(
                          duracion(cita.duracionMin),
                          style: const TextStyle(fontSize: 11, color: Marca.textoSuave),
                        ),
                        if (esProxima) ...[
                          const SizedBox(height: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: Marca.dorado.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text(
                              'Ahora',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: Marca.negro,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    width: 3,
                    height: 52,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                cita.clientaNombre,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                  decoration:
                                      cita.cancelada ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Etiqueta.cita(cita.estado),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          cita.resumenServicios,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13.5, color: Marca.textoSuave),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${cita.especialistaNombre} · ${dinero(cita.totalCentavos)}'
                          '${cita.cobrada ? ' · cobrada' : ''}',
                          style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
                        ),
                        if (cita.nota != null && cita.nota!.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.sticky_note_2_outlined,
                                  size: 13, color: Marca.textoSuave),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  cita.nota!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontStyle: FontStyle.italic,
                                    color: Marca.textoSuave,
                                  ),
                                ),
                              ),
                            ],
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
                    icon: const Icon(Icons.chat_bubble_outline, size: 20),
                    color: Marca.exito,
                    style: IconButton.styleFrom(
                      backgroundColor: Marca.exito.withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
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
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    etiqueta,
                    style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
                  ),
                  const SizedBox(height: 2),
                  Text(valor, style: cifra(24, color: colorValor)),
                  if (apoyo != null)
                    Text(
                      apoyo!,
                      style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
                    ),
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
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: titulo(21)),
          if (apoyo != null)
            Text(
              apoyo!,
              style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
            ),
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
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              rotulo,
              style: TextStyle(
                fontSize: 13.5,
                color: destacado ? Marca.texto : Marca.textoSuave,
                fontWeight: destacado ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            valor,
            textAlign: TextAlign.right,
            style: cifra(destacado ? 16 : 14, color: color),
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
      padding: const EdgeInsets.symmetric(vertical: 7),
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
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(width: 10),
              Text(dinero(valor), style: cifra(13.5)),
            ],
          ),
          if (apoyo != null)
            Text(apoyo!, style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: fraccion,
              minHeight: 7,
              backgroundColor: Marca.borde,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ],
      ),
    );
  }
}
