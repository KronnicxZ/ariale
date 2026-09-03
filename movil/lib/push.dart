import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'api/cliente.dart';
import 'recordatorios.dart';
import 'sesion.dart';

/// El aviso de "alguien acaba de agendar", que llega aunque la app esté
/// cerrada. Firebase entrega el mensaje; el servidor decide a quién
/// mandárselo según qué teléfonos tiene registrados (ver
/// `/api/v1/notificaciones`).
class Push {
  Push._();

  static bool _escuchando = false;

  /// Se llama una vez por sesión, apenas hay clienta autenticada, para que
  /// el servidor sepa a qué teléfono mandar los avisos.
  static Future<void> registrar(BuildContext context) async {
    if (kIsWeb) return;

    try {
      await Firebase.initializeApp();

      final permiso = await FirebaseMessaging.instance.requestPermission();
      if (permiso.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && context.mounted) {
        await _enviarToken(context, token);
      }

      if (!_escuchando) {
        _escuchando = true;
        // Si Android le da un token nuevo (reinstaló, limpió datos), hay
        // que avisarle al servidor o se queda mandando avisos al vacío.
        FirebaseMessaging.instance.onTokenRefresh.listen((nuevo) {
          if (context.mounted) _enviarToken(context, nuevo);
        });

        // Con la app abierta, Android no muestra la notificación por su
        // cuenta como sí hace en segundo plano: hay que mostrarla nosotros.
        FirebaseMessaging.onMessage.listen((mensaje) {
          final notificacion = mensaje.notification;
          if (notificacion == null) return;
          Recordatorios.mostrarAhora(
            titulo: notificacion.title ?? 'Arialé Studio',
            cuerpo: notificacion.body ?? '',
          );
        });
      }
    } catch (_) {
      // Sin Firebase la app sigue sirviendo para lo de siempre: agenda,
      // clientas, caja. El aviso push es un extra, no un requisito.
    }
  }

  static Future<void> _enviarToken(BuildContext context, String token) async {
    try {
      await Sesion.de(context).enviar('/api/v1/notificaciones', {'token': token});
    } on ErrorApi {
      // Se reintenta solo la próxima vez que se abra la app.
    }
  }
}
