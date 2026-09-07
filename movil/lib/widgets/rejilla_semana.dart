import 'package:flutter/material.dart';

import '../formato.dart';
import '../tema.dart';

/// Una cita vista desde la semana: lo justo para pintarla.
///
/// No trae precio ni teléfono ni nada más: en una rejilla de siete días no
/// cabe, y quien quiere el detalle toca el bloque.
class CitaSemana {
  const CitaSemana({
    required this.id,
    required this.dia,
    required this.inicio,
    required this.fin,
    required this.clienta,
    required this.servicios,
    required this.color,
    required this.porConfirmar,
  });

  final String id;

  /// "2026-09-11", el día del estudio.
  final String dia;
  final DateTime inicio;
  final DateTime fin;
  final String clienta;
  final String servicios;
  final Color color;
  final bool porConfirmar;

  int get desdeMin => inicio.hour * 60 + inicio.minute;
  int get hastaMin => fin.hour * 60 + fin.minute;

  factory CitaSemana.desdeJson(Map<String, dynamic> j, Map<String, Color> colores) {
    final inicio = DateTime.parse(j['inicio'] as String).toLocal();
    return CitaSemana(
      id: j['id'] as String,
      dia: j['dia'] as String,
      inicio: inicio,
      fin: DateTime.parse(j['fin'] as String).toLocal(),
      clienta: j['clienta'] as String? ?? '',
      servicios: j['servicios'] as String? ?? '',
      color: colores[j['especialistaId']] ?? Marca.dorado,
      porConfirmar: j['estado'] == 'PENDING',
    );
  }
}

/// La semana entera, siete columnas y las horas bajando por la izquierda.
///
/// En la vista de día hay que ir tocando día por día para saber cuándo queda
/// un rato libre. Aquí se ve de un vistazo, que es lo que hace falta cuando
/// una clienta pregunta "¿tienes algo esta semana?".
///
/// No cabe el nombre entero en una columna de cincuenta píxeles, y está
/// bien: el bloque dice la hora y de quién es por el color, y al tocarlo se
/// abre la cita.
class RejillaSemana extends StatelessWidget {
  const RejillaSemana({
    super.key,
    required this.dias,
    required this.citas,
    required this.hoy,
    required this.seleccionado,
    required this.desdeMin,
    required this.hastaMin,
    required this.alTocarCita,
    required this.alTocarDia,
  });

  /// Los siete días, de lunes a domingo.
  final List<DateTime> dias;
  final List<CitaSemana> citas;
  final DateTime hoy;
  final DateTime seleccionado;

  /// El tramo de horas que se pinta, en minutos desde medianoche.
  final int desdeMin;
  final int hastaMin;

  final ValueChanged<String> alTocarCita;
  final ValueChanged<DateTime> alTocarDia;

  static const _anchoHoras = 40.0;
  static const _altoCabecera = 46.0;

  /// Una hora, 56 píxeles: entra la jornada entera en una pantalla sin tener
  /// que arrastrar, que es de lo que va esta vista.
  static const _porHora = 56.0;

  static const _nombres = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  @override
  Widget build(BuildContext context) {
    final horas = (hastaMin - desdeMin) / 60;
    final alto = horas * _porHora;

    return LayoutBuilder(
      builder: (context, medidas) {
        final anchoDia = (medidas.maxWidth - _anchoHoras) / 7;

        return Column(
          children: [
            SizedBox(
              height: _altoCabecera,
              child: Row(
                children: [
                  const SizedBox(width: _anchoHoras),
                  for (final d in dias)
                    SizedBox(
                      width: anchoDia,
                      child: _Cabecera(
                        fecha: d,
                        inicial: _nombres[d.weekday - 1],
                        esHoy: claveDia(d) == claveDia(hoy),
                        elegido: claveDia(d) == claveDia(seleccionado),
                        alTocar: () => alTocarDia(d),
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                // Sitio arriba para que la primera hora no quede cortada por la
                // línea de la cabecera: el rótulo va un poco por encima de
                // su raya.
                padding: const EdgeInsets.only(top: 14, bottom: 16),
                child: SizedBox(
                  height: alto,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: _anchoHoras,
                        child: Stack(
                          children: [
                            for (var m = desdeMin; m < hastaMin; m += 60)
                              Positioned(
                                top: (m - desdeMin) / 60 * _porHora - 6,
                                right: 6,
                                child: Text(
                                  horaCorta(m),
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    color: Marca.textoTenue,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      for (final d in dias)
                        SizedBox(
                          width: anchoDia,
                          child: _Columna(
                            citas: citas.where((c) => c.dia == claveDia(d)).toList(),
                            desdeMin: desdeMin,
                            hastaMin: hastaMin,
                            porHora: _porHora,
                            alTocarCita: alTocarCita,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Cabecera extends StatelessWidget {
  const _Cabecera({
    required this.fecha,
    required this.inicial,
    required this.esHoy,
    required this.elegido,
    required this.alTocar,
  });

  final DateTime fecha;
  final String inicial;
  final bool esHoy;
  final bool elegido;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: alTocar,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            inicial,
            style: const TextStyle(fontSize: 10, color: Marca.textoTenue),
          ),
          const SizedBox(height: 2),
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: elegido
                  ? Marca.dorado
                  : esHoy
                      ? Marca.negro
                      : Colors.transparent,
            ),
            child: Text(
              '${fecha.day}',
              style: cifra(
                13,
                color: elegido
                    ? Marca.negro
                    : esHoy
                        ? Colors.white
                        : Marca.texto,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Columna extends StatelessWidget {
  const _Columna({
    required this.citas,
    required this.desdeMin,
    required this.hastaMin,
    required this.porHora,
    required this.alTocarCita,
  });

  final List<CitaSemana> citas;
  final int desdeMin;
  final int hastaMin;
  final double porHora;
  final ValueChanged<String> alTocarCita;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Las líneas de las horas, para que un bloque a media altura se pueda
        // situar sin contar píxeles.
        for (var m = desdeMin; m <= hastaMin; m += 60)
          Positioned(
            top: (m - desdeMin) / 60 * porHora,
            left: 0,
            right: 0,
            child: const Divider(height: 1, thickness: 0.5),
          ),
        Positioned.fill(
          left: 0,
          child: Container(
            decoration: const BoxDecoration(
              border: Border(left: BorderSide(color: Marca.borde, width: 0.5)),
            ),
          ),
        ),
        for (final c in citas)
          Positioned(
            top: (c.desdeMin - desdeMin) / 60 * porHora,
            left: 1.5,
            right: 1.5,
            // Un mínimo para que una cita de veinte minutos siga siendo
            // tocable con el dedo.
            height: ((c.hastaMin - c.desdeMin) / 60 * porHora).clamp(22.0, 600.0),
            child: _Bloque(cita: c, alTocar: () => alTocarCita(c.id)),
          ),
      ],
    );
  }
}

class _Bloque extends StatelessWidget {
  const _Bloque({required this.cita, required this.alTocar});

  final CitaSemana cita;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 1.5),
      child: Material(
        color: cita.color.withValues(alpha: cita.porConfirmar ? 0.16 : 0.3),
        borderRadius: BorderRadius.circular(5),
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(5),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(5),
              border: Border(left: BorderSide(color: cita.color, width: 2.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  hora(cita.inicio),
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                    color: Marca.texto,
                  ),
                ),
                Flexible(
                  child: Text(
                    primerNombre(cita.clienta),
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    style: const TextStyle(
                      fontSize: 9,
                      height: 1.15,
                      color: Marca.texto,
                    ),
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
