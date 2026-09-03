import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'api/modelos.dart';
import 'formato.dart';

/// Avisa en el propio teléfono cuando falta poco para una cita.
///
/// Todo pasa en el teléfono: no hay servidor de por medio ni notificación
/// enviada desde afuera. Cada vez que la pantalla de Hoy carga los datos,
/// [sincronizar] borra lo que hubiera programado y arma de nuevo un aviso
/// por cada cita propia que todavía no empezó.
class Recordatorios {
  Recordatorios._();

  static const _minutosAntes = 10;
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _listo = false;

  static Future<void> iniciar() async {
    if (_listo || kIsWeb) return;

    tzdata.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation('America/Caracas'));
    } catch (_) {
      // Si el paquete de zonas no trae esta región, mejor la hora del
      // teléfono que dejar la app sin avisos.
    }

    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    // En Android 13+ hay que pedir permiso explícito, como cualquier app.
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    _listo = true;
  }

  /// Vuelve a armar los avisos de hoy desde cero. Si [miEspecialistaId] es
  /// null (por ejemplo la dueña sin especialista propio) avisa de todas.
  static Future<void> sincronizar(
    List<Cita> citasDeHoy, {
    required String? miEspecialistaId,
  }) async {
    if (!_listo || kIsWeb) return;

    await _plugin.cancelAll();

    final ahora = DateTime.now();
    for (final cita in citasDeHoy) {
      if (cita.cancelada || cita.atendida) continue;
      if (miEspecialistaId != null && cita.especialistaId != miEspecialistaId) {
        continue;
      }

      final aviso = cita.inicio.subtract(const Duration(minutes: _minutosAntes));
      if (aviso.isBefore(ahora)) continue;

      try {
        await _plugin.zonedSchedule(
          _idDe(cita.id),
          'Cita en $_minutosAntes minutos',
          '${cita.clientaNombre} · ${cita.resumenServicios} a las ${hora(cita.inicio)}',
          tz.TZDateTime.from(aviso, tz.local),
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'citas_proximas',
              'Citas próximas',
              channelDescription:
                  'Avisa cuando falta poco para una cita ya agendada.',
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
        );
      } catch (_) {
        // Un aviso que no se pudo programar no debe tumbar los demás.
      }
    }
  }

  /// El id de la notificación tiene que ser un entero de 32 bits: se deriva
  /// del id de la cita para que reprogramar la misma cita reemplace el
  /// aviso anterior en vez de duplicarlo.
  static int _idDe(String citaId) => citaId.hashCode & 0x7fffffff;

  /// Notificación al toque, sin programar nada — la usa el aviso push de
  /// "alguien acaba de agendar" cuando llega con la app abierta (en
  /// segundo plano o cerrada, ya la muestra Android solo).
  static Future<void> mostrarAhora({
    required String titulo,
    required String cuerpo,
  }) async {
    if (!_listo || kIsWeb) return;
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch & 0x7fffffff,
      titulo,
      cuerpo,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'citas_nuevas',
          'Citas nuevas',
          channelDescription: 'Avisa apenas una clienta agenda desde la web.',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }
}
