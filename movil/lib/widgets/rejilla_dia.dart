import 'package:flutter/material.dart';

import '../api/modelos.dart';
import '../formato.dart';
import '../tema.dart';

/// El día como calendario: las horas bajando por la izquierda y una columna
/// por especialista. Se ve de un vistazo qué está ocupado y qué queda libre,
/// que es justo lo que hay que saber cuando una clienta pregunta por WhatsApp.
class RejillaDia extends StatelessWidget {
  const RejillaDia({
    super.key,
    required this.fecha,
    required this.citas,
    required this.especialistas,
    required this.horario,
    required this.alTocarCita,
    required this.alTocarHueco,
  });

  final DateTime fecha;
  final List<Cita> citas;
  final List<Especialista> especialistas;
  final HorarioDia horario;
  final ValueChanged<Cita> alTocarCita;

  /// Minuto del día donde se tocó, ya redondeado a la media hora.
  final ValueChanged<int> alTocarHueco;

  /// Un minuto = un píxel y pico: una hora ocupa 68, que es lo que hace falta
  /// para que quepa el nombre y el servicio sin apretar.
  static const _escala = 1.13;
  static const _anchoHoras = 46.0;
  static const _altoMinimo = 40.0;

  /// La rejilla arranca en la apertura, pero si hay una cita fuera de horario
  /// —pasa— se estira para que no quede escondida.
  (int, int) get _rango {
    var desde = horario.desdeMin;
    var hasta = horario.hastaMin;

    for (final cita in citas) {
      final inicio = cita.inicio.hour * 60 + cita.inicio.minute;
      final fin = inicio + cita.duracionMin;
      if (inicio < desde) desde = inicio;
      if (fin > hasta) hasta = fin;
    }

    // Siempre en horas completas, para que las líneas cuadren con el reloj.
    desde = (desde ~/ 60) * 60;
    hasta = ((hasta + 59) ~/ 60) * 60;
    if (hasta <= desde) hasta = desde + 60;
    return (desde, hasta);
  }

  @override
  Widget build(BuildContext context) {
    final (desde, hasta) = _rango;
    final alto = (hasta - desde) * _escala;
    final horas = [for (var m = desde; m <= hasta; m += 60) m];

    // Solo las especialistas que trabajan hoy o que ya tienen algo puesto.
    final columnas = especialistas.isEmpty
        ? <Especialista>[]
        : especialistas.toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(0, 4, 12, 96),
      child: SizedBox(
        height: alto + 24,
        child: Stack(
          children: [
            // Líneas de hora y sus rótulos.
            for (final minuto in horas)
              Positioned(
                top: (minuto - desde) * _escala,
                left: 0,
                right: 0,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: _anchoHoras,
                      child: Transform.translate(
                        offset: const Offset(0, -7),
                        child: Text(
                          _rotuloHora(minuto),
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Marca.textoSuave.withValues(alpha: 0.75),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Container(height: 1, color: Marca.borde)),
                  ],
                ),
              ),

            // Media hora, más tenue: ayuda a calcular sin llenar de líneas.
            for (var m = desde + 30; m < hasta; m += 60)
              Positioned(
                top: (m - desde) * _escala,
                left: _anchoHoras + 8,
                right: 0,
                child: Container(
                  height: 1,
                  color: Marca.borde.withValues(alpha: 0.45),
                ),
              ),

            // Las columnas del equipo.
            Positioned.fill(
              left: _anchoHoras + 8,
              child: Row(
                children: [
                  for (final persona in columnas)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: _Columna(
                          persona: persona,
                          citas: citas
                              .where((c) => c.especialistaId == persona.id)
                              .toList(),
                          desde: desde,
                          escala: _escala,
                          altoMinimo: _altoMinimo,
                          alTocarCita: alTocarCita,
                          alTocarHueco: alTocarHueco,
                        ),
                      ),
                    ),
                  if (columnas.isEmpty) const Expanded(child: SizedBox.shrink()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _rotuloHora(int minuto) {
    final h = (minuto ~/ 60) % 24;
    final doce = h % 12 == 0 ? 12 : h % 12;
    return '$doce ${h < 12 ? 'am' : 'pm'}';
  }
}

class _Columna extends StatelessWidget {
  const _Columna({
    required this.persona,
    required this.citas,
    required this.desde,
    required this.escala,
    required this.altoMinimo,
    required this.alTocarCita,
    required this.alTocarHueco,
  });

  final Especialista persona;
  final List<Cita> citas;
  final int desde;
  final double escala;
  final double altoMinimo;
  final ValueChanged<Cita> alTocarCita;
  final ValueChanged<int> alTocarHueco;

  @override
  Widget build(BuildContext context) {
    final color = Marca.desdeHex(persona.color);

    return Stack(
      children: [
        // El fondo vacío también sirve: se toca para agendar a esa hora.
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapUp: (detalle) {
              final minuto = desde + (detalle.localPosition.dy / escala).round();
              alTocarHueco((minuto ~/ 30) * 30);
            },
          ),
        ),
        for (final cita in citas)
          Positioned(
            top: ((cita.inicio.hour * 60 + cita.inicio.minute) - desde) * escala,
            left: 0,
            right: 0,
            height: (cita.duracionMin * escala).clamp(altoMinimo, 600.0),
            child: _Bloque(
              cita: cita,
              color: color,
              compacto: cita.duracionMin * escala < 58,
              alTocar: () => alTocarCita(cita),
            ),
          ),
      ],
    );
  }
}

class _Bloque extends StatelessWidget {
  const _Bloque({
    required this.cita,
    required this.color,
    required this.compacto,
    required this.alTocar,
  });

  final Cita cita;
  final Color color;
  final bool compacto;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final atenuada = cita.cancelada;
    final fondo = cita.atendida
        ? color.withValues(alpha: 0.10)
        : color.withValues(alpha: 0.18);

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: atenuada ? Marca.borde.withValues(alpha: 0.5) : fondo,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border(
                left: BorderSide(color: atenuada ? Marca.textoSuave : color, width: 3),
              ),
            ),
            padding: EdgeInsets.fromLTRB(7, compacto ? 3 : 5, 6, 3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (cita.porConfirmar)
                      Padding(
                        padding: const EdgeInsets.only(right: 4, top: 1),
                        child: Icon(
                          Icons.schedule,
                          size: 11,
                          color: Marca.alerta,
                        ),
                      ),
                    Expanded(
                      child: Text(
                        cita.clientaNombre,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          height: 1.15,
                          decoration: atenuada ? TextDecoration.lineThrough : null,
                        ),
                      ),
                    ),
                  ],
                ),
                if (!compacto) ...[
                  const SizedBox(height: 1),
                  Expanded(
                    child: Text(
                      cita.resumenServicios,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        height: 1.2,
                        color: Marca.texto,
                      ),
                    ),
                  ),
                  Text(
                    '${hora(cita.inicio)} · ${duracion(cita.duracionMin)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 10.5, color: Marca.textoSuave),
                  ),
                ] else
                  Expanded(
                    child: Text(
                      cita.resumenServicios,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Marca.textoSuave),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
