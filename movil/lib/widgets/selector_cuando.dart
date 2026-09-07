import 'package:flutter/material.dart';

import '../iconos.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../tema.dart';

/// Elegir cuándo: la tira de días y la lista de horas.
///
/// Estaban dentro de "nueva cita" y ahora las usan dos pantallas —agendar y
/// mover una cita—, así que viven aquí. Son las mismas piezas a propósito:
/// mover una cita se tiene que sentir igual que agendarla.

class SelectorDia extends StatelessWidget {
  const SelectorDia({
    super.key,
    required this.dia,
    required this.desde,
    required this.hasta,
    required this.alElegir,
    this.conHueco,
  });

  final String dia;
  final String desde;
  final String hasta;
  final ValueChanged<String> alElegir;

  /// Los días con sitio. Nulo mientras no se sabe: todos encendidos.
  final Set<String>? conHueco;

  static const _nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  @override
  Widget build(BuildContext context) {
    final inicio = DateTime.parse(desde);
    final dias = List.generate(21, (i) => inicio.add(Duration(days: i)));

    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: dias.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          if (i == dias.length) {
            return _BotonCalendario(
              dia: dia,
              desde: desde,
              hasta: hasta,
              alElegir: alElegir,
            );
          }

          final fecha = dias[i];
          final clave = claveDia(fecha);
          final activo = clave == dia;
          // Sin hueco es, para quien agenda, lo mismo que cerrado.
          final lleno = conHueco != null && !conHueco!.contains(clave);

          return Opacity(
            opacity: lleno ? 0.38 : 1,
            child: Material(
            color: activo ? Marca.dorado : Marca.tarjeta,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: lleno ? null : () => alElegir(clave),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 66,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: activo ? Marca.dorado : Marca.borde),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      i == 0
                          ? 'Hoy'
                          : i == 1
                              ? 'Mañana'
                              : _nombres[fecha.weekday % 7],
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: activo
                            ? Marca.negro.withValues(alpha: 0.7)
                            : Marca.textoSuave,
                      ),
                    ),
                    Text(
                      '${fecha.day}',
                      style: cifra(19, color: activo ? Marca.negro : Marca.texto).copyWith(
                        decoration: lleno ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ),
          );
        },
      ),
    );
  }
}

class _BotonCalendario extends StatelessWidget {
  const _BotonCalendario({
    required this.dia,
    required this.desde,
    required this.hasta,
    required this.alElegir,
  });

  final String dia;
  final String desde;
  final String hasta;
  final ValueChanged<String> alElegir;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Marca.tarjeta,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          final elegida = await showDatePicker(
            context: context,
            initialDate: DateTime.parse(dia),
            firstDate: DateTime.parse(desde),
            lastDate: DateTime.parse(hasta),
            locale: const Locale('es'),
          );
          if (elegida != null) alElegir(claveDia(elegida));
        },
        child: Container(
          width: 62,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Marca.borde),
          ),
          child: const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Ico.agenda, size: 17, color: Marca.textoSuave),
              SizedBox(height: 5),
              Text(
                'Otro día',
                style: TextStyle(fontSize: 9.5, color: Marca.textoSuave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ListaHoras extends StatelessWidget {
  const ListaHoras({
    super.key,
    required this.huecos,
    required this.hora,
    required this.alElegir,
  });

  final List<Hueco> huecos;
  final String? hora;
  final ValueChanged<String> alElegir;

  static const _franjas = [
    ('morning', 'Mañana'),
    ('afternoon', 'Tarde'),
    ('evening', 'Noche'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (clave, etiqueta) in _franjas)
          if (huecos.any((h) => h.franja == clave)) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                etiqueta.toUpperCase(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Marca.textoSuave,
                ),
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final h in huecos.where((h) => h.franja == clave))
                  Material(
                    color: hora == h.hora ? Marca.dorado : Marca.tarjeta,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: () => alElegir(h.hora),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: hora == h.hora ? Marca.dorado : Marca.borde,
                          ),
                        ),
                        child: Text(
                          horaBonita(h.hora),
                          style: cifra(
                            13.5,
                            color: hora == h.hora ? Marca.negro : Marca.texto,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
          ],
      ],
    );
  }
}
