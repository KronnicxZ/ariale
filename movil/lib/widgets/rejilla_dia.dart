import 'package:flutter/material.dart';

import '../api/modelos.dart';
import '../tema.dart';
import 'animar.dart';

/// El día como calendario: las horas bajando por la izquierda y una columna
/// por especialista. Se ve de un vistazo qué está ocupado y qué queda libre,
/// que es justo lo que hay que saber cuando una clienta pregunta por WhatsApp.
///
/// Se adapta al ancho que le den: reparte las columnas si caben, y si no
/// —muchas especialistas o un teléfono estrecho— las deja a un ancho mínimo
/// legible y el día se desliza de lado.
class RejillaDia extends StatelessWidget {
  const RejillaDia({
    super.key,
    required this.citas,
    required this.especialistas,
    required this.horario,
    required this.miEspecialistaId,
    required this.alTocarCita,
    required this.alTocarHueco,
  });

  final List<Cita> citas;
  final List<Especialista> especialistas;
  final HorarioDia horario;

  /// Para marcar cuál columna es la de quien tiene la sesión abierta.
  final String? miEspecialistaId;

  final ValueChanged<Cita> alTocarCita;

  /// Minuto del día donde se tocó, ya redondeado a la media hora.
  final void Function(int minuto, String especialistaId) alTocarHueco;

  /// Un minuto y pico por píxel: una hora ocupa 70, que es lo que hace falta
  /// para que quepa el nombre y el servicio sin apretar.
  static const _escala = 1.16;
  static const _anchoHoras = 46.0;
  static const _hueco = 10.0;

  /// Por debajo de esto una columna deja de leerse; a partir de ahí el día
  /// se desliza en vez de estrujarse.
  static const _minColumna = 116.0;
  static const _maxColumna = 260.0;
  static const _altoMinimo = 38.0;

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

    desde = (desde ~/ 60) * 60;
    hasta = ((hasta + 59) ~/ 60) * 60;
    if (hasta <= desde) hasta = desde + 60;
    return (desde, hasta);
  }

  @override
  Widget build(BuildContext context) {
    if (especialistas.isEmpty) return const SizedBox.shrink();

    final (desde, hasta) = _rango;
    final alto = (hasta - desde) * _escala;
    final horas = [for (var m = desde; m <= hasta; m += 60) m];

    return LayoutBuilder(
      builder: (context, medidas) {
        final paraColumnas = medidas.maxWidth - _anchoHoras - _hueco - 16;
        final reparto = paraColumnas / especialistas.length;
        final estrecho = reparto < _minColumna;
        final anchoColumna = estrecho
            ? _minColumna
            : reparto.clamp(_minColumna, _maxColumna);
        final anchoTotal =
            _anchoHoras + _hueco + anchoColumna * especialistas.length + 16;

        // En una tableta las columnas no se estiran sin fin: se quedan a un
        // ancho cómodo y el día se centra, en vez de dejar medio vacío.
        final sobraSitio = anchoTotal < medidas.maxWidth;

        final rejilla = SizedBox(
          width: anchoTotal,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Encabezado(
                especialistas: especialistas,
                anchoHoras: _anchoHoras,
                hueco: _hueco,
                anchoColumna: anchoColumna,
                miEspecialistaId: miEspecialistaId,
              ),
              SizedBox(
                height: alto + 24,
                child: Stack(
                  children: [
                    for (final minuto in horas)
                      Positioned(
                        top: (minuto - desde) * _escala,
                        left: 0,
                        right: 0,
                        child: _LineaHora(
                          minuto: minuto,
                          anchoHoras: _anchoHoras,
                          hueco: _hueco,
                        ),
                      ),
                    Positioned.fill(
                      left: _anchoHoras + _hueco,
                      child: Row(
                        children: [
                          for (final persona in especialistas)
                            SizedBox(
                              width: anchoColumna,
                              child: Padding(
                                padding: const EdgeInsets.only(right: 6),
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
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );

        final vertical = SingleChildScrollView(
          padding: const EdgeInsets.only(top: 4, bottom: 104),
          child: sobraSitio ? Center(child: rejilla) : rejilla,
        );

        // Solo se desliza de lado cuando de verdad hace falta.
        if (!estrecho) return vertical;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(width: anchoTotal, child: vertical),
        );
      },
    );
  }
}

/// Los nombres del equipo, alineados con sus columnas. Van dentro de la
/// rejilla para que sigan cuadrando aunque el día se deslice de lado.
class _Encabezado extends StatelessWidget {
  const _Encabezado({
    required this.especialistas,
    required this.anchoHoras,
    required this.hueco,
    required this.anchoColumna,
    required this.miEspecialistaId,
  });

  final List<Especialista> especialistas;
  final double anchoHoras;
  final double hueco;
  final double anchoColumna;
  final String? miEspecialistaId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(width: anchoHoras + hueco),
          for (final persona in especialistas)
            SizedBox(
              width: anchoColumna,
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 7),
                    decoration: BoxDecoration(
                      color: Marca.desdeHex(persona.color),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Flexible(
                    child: Text(
                      persona.id == miEspecialistaId
                          ? '${persona.nombre} (tú)'
                          : persona.nombre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _LineaHora extends StatelessWidget {
  const _LineaHora({
    required this.minuto,
    required this.anchoHoras,
    required this.hueco,
  });

  final int minuto;
  final double anchoHoras;
  final double hueco;

  @override
  Widget build(BuildContext context) {
    final h = (minuto ~/ 60) % 24;
    final doce = h % 12 == 0 ? 12 : h % 12;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: anchoHoras,
          child: Transform.translate(
            offset: const Offset(0, -6),
            child: Text(
              '$doce ${h < 12 ? 'am' : 'pm'}',
              textAlign: TextAlign.right,
              style: cifra(10.5, color: Marca.textoTenue, peso: FontWeight.w600),
            ),
          ),
        ),
        SizedBox(width: hueco),
        Expanded(
          child: Container(height: 0.7, color: Marca.borde.withValues(alpha: 0.8)),
        ),
      ],
    );
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
  final void Function(int minuto, String especialistaId) alTocarHueco;

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
              alTocarHueco((minuto ~/ 30) * 30, persona.id);
            },
          ),
        ),
        for (final (i, cita) in citas.indexed)
          Positioned(
            top: ((cita.inicio.hour * 60 + cita.inicio.minute) - desde) * escala,
            left: 0,
            right: 0,
            height: (cita.duracionMin * escala).clamp(altoMinimo, 600.0),
            child: Aparece(
              posicion: i,
              desplazamiento: 6,
              child: _Bloque(
                cita: cita,
                color: color,
                compacto: cita.duracionMin * escala < 56,
                // Un turno de media hora no deja sitio para el nombre y el
                // servicio sin que la tarjeta redondeada se los coma por
                // abajo: mejor mostrar solo el nombre, entero y legible.
                soloNombre: cita.duracionMin * escala < 44,
                alTocar: () => alTocarCita(cita),
              ),
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
    required this.soloNombre,
    required this.alTocar,
  });

  final Cita cita;
  final Color color;
  final bool compacto;

  /// Media hora no da ni para el nombre y el servicio a la vez: se enseña
  /// solo el nombre, centrado, en vez de que la tarjeta se lo coma.
  final bool soloNombre;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final atenuada = cita.cancelada;
    final fondo = atenuada
        ? Marca.borde.withValues(alpha: 0.55)
        : color.withValues(alpha: cita.atendida ? 0.09 : 0.14);

    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Material(
        color: fondo,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(10),
          hoverColor: color.withValues(alpha: 0.12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Filo de color: dice quién atiende sin ocupar sitio.
              Container(
                width: 3,
                decoration: BoxDecoration(
                  color: atenuada ? Marca.textoTenue : color,
                  borderRadius: const BorderRadius.horizontal(
                    left: Radius.circular(10),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(9, compacto ? 4 : 7, 8, 5),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: soloNombre
                        ? MainAxisAlignment.center
                        : MainAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (cita.porConfirmar)
                            Padding(
                              padding: const EdgeInsets.only(right: 5),
                              child: Container(
                                width: 5,
                                height: 5,
                                decoration: const BoxDecoration(
                                  color: Marca.alerta,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          Expanded(
                            child: Text(
                              cita.clientaNombre,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.25,
                                height: 1.15,
                                decoration:
                                    atenuada ? TextDecoration.lineThrough : null,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (!soloNombre) ...[
                        const SizedBox(height: 2),
                        Expanded(
                          child: Text(
                            cita.resumenServicios,
                            maxLines: compacto ? 1 : 3,
                            overflow: TextOverflow.ellipsis,
                            style: sutil(11.5, color: Marca.textoSuave),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
