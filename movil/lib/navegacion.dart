import 'package:flutter/material.dart';

import 'pantallas/cita_detalle.dart';

/// Navegar desde fuera del árbol de widgets.
///
/// Las notificaciones llegan de Firebase o del plugin de avisos locales, no
/// de un botón: cuando la clienta toca una, no hay `BuildContext` a mano
/// para hacer un `Navigator.push`. Esta llave lo resuelve.
class Navegacion {
  Navegacion._();

  static final llave = GlobalKey<NavigatorState>();

  /// Abre el detalle de una cita. Si la app aún no tiene navegador montado
  /// —arranque en frío desde una notificación— se espera al siguiente
  /// fotograma, que es cuando ya lo hay.
  static void abrirCita(String? citaId) {
    if (citaId == null || citaId.isEmpty) return;

    void empujar() {
      final navegador = llave.currentState;
      if (navegador == null) return;
      navegador.push(
        MaterialPageRoute(builder: (_) => PantallaCitaDetalle(citaId: citaId)),
      );
    }

    if (llave.currentState != null) {
      empujar();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => empujar());
    }
  }
}
