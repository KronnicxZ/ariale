import 'package:flutter/widgets.dart';

import 'api/cliente.dart';
import 'api/modelos.dart';

/// Deja el cliente de la API y el catálogo al alcance de toda la app,
/// sin arrastrar una librería de estado para algo tan pequeño.
class Sesion extends InheritedWidget {
  const Sesion({super.key, required this.api, required super.child});

  final ClienteApi api;

  /// El catálogo (servicios, especialistas, tasa) se descarga una vez al
  /// entrar y se comparte: casi todas las pantallas lo necesitan.
  static Catalogo? catalogo;

  static ClienteApi de(BuildContext context) {
    final sesion = context.dependOnInheritedWidgetOfExactType<Sesion>();
    assert(sesion != null, 'No hay Sesion por encima de este widget.');
    return sesion!.api;
  }

  @override
  bool updateShouldNotify(Sesion anterior) => api != anterior.api;
}
