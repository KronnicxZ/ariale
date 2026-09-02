import 'package:flutter/material.dart';

import '../tema.dart';

/// Los mismos atajos de periodo que la web, para que un número signifique
/// lo mismo mirando el teléfono o la pantalla del salón.
class Periodo {
  const Periodo(this.clave, this.etiqueta);

  final String clave;
  final String etiqueta;

  static const opciones = <Periodo>[
    Periodo('today', 'Hoy'),
    Periodo('week', 'Semana'),
    Periodo('month', 'Este mes'),
    Periodo('last30', '30 días'),
    Periodo('last-month', 'Mes pasado'),
    Periodo('year', 'Año'),
  ];
}

class SelectorPeriodo extends StatelessWidget {
  const SelectorPeriodo({super.key, required this.activo, required this.alElegir});

  final String activo;
  final ValueChanged<String> alElegir;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: Periodo.opciones.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final opcion = Periodo.opciones[i];
          return ChoiceChip(
            label: Text(opcion.etiqueta),
            selected: opcion.clave == activo,
            onSelected: (_) => alElegir(opcion.clave),
            selectedColor: Marca.dorado,
            backgroundColor: Marca.tarjeta,
            side: BorderSide(
              color: opcion.clave == activo ? Marca.dorado : Marca.borde,
            ),
            labelStyle: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: opcion.clave == activo ? Marca.negro : Marca.textoSuave,
            ),
            showCheckmark: false,
          );
        },
      ),
    );
  }
}
