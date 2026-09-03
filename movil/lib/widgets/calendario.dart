import 'package:flutter/material.dart';

import '../formato.dart';
import '../tema.dart';

/// Lo que se sabe de un día sin abrirlo: cuántas citas hay y cuántas
/// esperan confirmación.
class ConteoDia {
  const ConteoDia({required this.citas, required this.porConfirmar});

  final int citas;
  final int porConfirmar;
}

/// Calendario de mes plegable. Arranca mostrando solo la semana —que es lo
/// que se mira noventa veces al día— y se abre al mes entero para saltar a
/// una fecha lejana.
class Calendario extends StatelessWidget {
  const Calendario({
    super.key,
    required this.seleccionado,
    required this.hoy,
    required this.conteos,
    required this.expandido,
    required this.alElegir,
    required this.alAlternar,
  });

  final DateTime seleccionado;
  final DateTime hoy;

  /// Indexado por "yyyy-MM-dd".
  final Map<String, ConteoDia> conteos;
  final bool expandido;
  final ValueChanged<DateTime> alElegir;
  final VoidCallback alAlternar;

  static const _iniciales = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  /// El lunes de la semana de una fecha. La semana empieza en lunes porque
  /// el domingo el estudio está cerrado y molesta verlo primero.
  static DateTime _lunesDe(DateTime fecha) {
    final dia = DateTime(fecha.year, fecha.month, fecha.day);
    return dia.subtract(Duration(days: dia.weekday - 1));
  }

  List<DateTime> get _dias {
    if (!expandido) {
      final lunes = _lunesDe(seleccionado);
      return [for (var i = 0; i < 7; i++) lunes.add(Duration(days: i))];
    }

    // El mes completo, cuadrado en semanas de lunes a domingo.
    final primero = DateTime(seleccionado.year, seleccionado.month, 1);
    final inicio = _lunesDe(primero);
    final ultimo = DateTime(seleccionado.year, seleccionado.month + 1, 0);
    final fin = _lunesDe(ultimo).add(const Duration(days: 6));
    final total = fin.difference(inicio).inDays + 1;
    return [for (var i = 0; i < total; i++) inicio.add(Duration(days: i))];
  }

  @override
  Widget build(BuildContext context) {
    final dias = _dias;

    return Column(
      children: [
        Row(
          children: [
            for (final inicial in _iniciales)
              Expanded(
                child: Center(
                  child: Text(
                    inicial,
                    style: micro(),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        for (var fila = 0; fila * 7 < dias.length; fila++)
          Row(
            children: [
              for (var i = fila * 7; i < fila * 7 + 7 && i < dias.length; i++)
                Expanded(
                  child: _Celda(
                    fecha: dias[i],
                    conteo: conteos[claveDia(dias[i])],
                    seleccionado: _mismoDia(dias[i], seleccionado),
                    esHoy: _mismoDia(dias[i], hoy),
                    otroMes: expandido && dias[i].month != seleccionado.month,
                    alTocar: () => alElegir(dias[i]),
                  ),
                ),
            ],
          ),
        // Tirador para abrir y cerrar el mes.
        InkWell(
          onTap: alAlternar,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: 24,
            width: double.infinity,
            child: Center(
              child: Container(
                width: 34,
                height: 4,
                decoration: BoxDecoration(
                  color: Marca.textoTenue.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static bool _mismoDia(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _Celda extends StatelessWidget {
  const _Celda({
    required this.fecha,
    required this.conteo,
    required this.seleccionado,
    required this.esHoy,
    required this.otroMes,
    required this.alTocar,
  });

  final DateTime fecha;
  final ConteoDia? conteo;
  final bool seleccionado;
  final bool esHoy;
  final bool otroMes;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final citas = conteo?.citas ?? 0;
    final colorTexto = seleccionado
        ? Marca.negro
        : otroMes
            ? Marca.textoTenue
            : esHoy
                ? Marca.dorado
                : Marca.texto;

    return InkWell(
      onTap: alTocar,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 2),
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              curve: Curves.easeOut,
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: seleccionado ? Marca.dorado : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${fecha.day}',
                style: cifra(
                  15,
                  color: colorTexto,
                  peso: seleccionado || esHoy ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(height: 2),
            // El número de citas, no puntos: si todos los días tienen algo,
            // los puntos no distinguen un día tranquilo de uno lleno.
            SizedBox(
              height: 13,
              child: citas == 0
                  ? (esHoy && !seleccionado
                      ? const _PuntoHoy()
                      : null)
                  : Text(
                      '$citas',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: otroMes
                            ? Marca.textoTenue
                            : (conteo?.porConfirmar ?? 0) > 0
                                ? Marca.alerta
                                : Marca.textoSuave,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// El día de hoy, cuando no tiene citas, se marca con un punto.
class _PuntoHoy extends StatelessWidget {
  const _PuntoHoy();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 4,
        height: 4,
        decoration: const BoxDecoration(color: Marca.dorado, shape: BoxShape.circle),
      ),
    );
  }
}
