import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import 'api/cliente.dart';
import 'sesion.dart';
import 'tema.dart';

/// La app se actualiza sola.
///
/// Al abrir pregunta al servidor cuál es la última versión publicada. Si es
/// más nueva que la instalada, lo dice, baja el APK y abre el instalador de
/// Android. Ellas solo tienen que confirmar; no hay que pasarles el archivo
/// por WhatsApp cada vez que cambia algo.
///
/// Nunca es obligatorio: si dicen "ahora no", la app sigue funcionando y se
/// vuelve a ofrecer la próxima vez que abran.
class Actualizacion {
  Actualizacion._();

  static bool _yaPreguntado = false;

  /// Se llama una vez por arranque, cuando ya hay sesión y pantalla.
  static Future<void> revisar(BuildContext context) async {
    // Solo Android: el APK no le sirve a nadie más.
    if (_yaPreguntado || !Platform.isAndroid) return;
    _yaPreguntado = true;

    try {
      final datos = await Sesion.de(context).obtener('/api/v1/version');
      final version = datos['version'] as Map<String, dynamic>?;
      if (version == null) return;

      final info = await PackageInfo.fromPlatform();
      final instalada = int.tryParse(info.buildNumber) ?? 0;
      final publicada = version['build'] as int;
      if (publicada <= instalada) return;

      if (!context.mounted) return;
      final quiere = await _preguntar(
        context,
        nombre: version['nombre'] as String,
        notas: version['notas'] as String?,
      );
      if (quiere != true || !context.mounted) return;

      await _bajarEInstalar(context, version['url'] as String);
    } on ErrorApi {
      // El servidor viejo no tiene esta ruta, o la sesión caducó. Ninguna de
      // las dos cosas debe estropear el arranque.
    } catch (_) {
      // Sin conexión, sin permiso de escritura, lo que sea: la app sirve
      // igual con la versión que ya está instalada.
    }
  }

  static Future<bool?> _preguntar(
    BuildContext context, {
    required String nombre,
    String? notas,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hay una versión nueva'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Versión $nombre', style: sutil(14)),
            if (notas != null && notas.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(notas, style: const TextStyle(fontSize: 14, height: 1.35)),
            ],
            const SizedBox(height: 12),
            Text(
              'Se baja y Android te pedirá confirmar la instalación.',
              style: sutil(12.5),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Ahora no'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Actualizar'),
          ),
        ],
      ),
    );
  }

  /// Baja el APK enseñando el avance y se lo pasa a Android.
  static Future<void> _bajarEInstalar(BuildContext context, String url) async {
    final avance = ValueNotifier<double?>(null);

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Bajando la actualización'),
        content: ValueListenableBuilder<double?>(
          valueListenable: avance,
          builder: (context, valor, _) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LinearProgressIndicator(value: valor),
              const SizedBox(height: 12),
              Text(
                valor == null ? 'Empezando…' : '${(valor * 100).round()}%',
                style: sutil(13),
              ),
            ],
          ),
        ),
      ),
    );

    try {
      // Por trozos y no de una: así se puede enseñar el avance, que en un
      // archivo de veintitantos megas con poca señal importa.
      final peticion = http.Request('GET', Uri.parse(url));
      final respuesta = await peticion.send();
      if (respuesta.statusCode != 200) {
        throw HttpException('El servidor respondió ${respuesta.statusCode}');
      }

      final total = respuesta.contentLength ?? 0;
      final bytes = <int>[];
      await for (final trozo in respuesta.stream) {
        bytes.addAll(trozo);
        if (total > 0) avance.value = bytes.length / total;
      }

      // En la carpeta propia de la app: no hace falta permiso de
      // almacenamiento y `open_filex` la sabe compartir con el instalador.
      final carpeta = await getExternalStorageDirectory() ?? await getTemporaryDirectory();
      final archivo = File('${carpeta.path}/ariale-actualizacion.apk');
      await archivo.writeAsBytes(bytes, flush: true);

      if (context.mounted) Navigator.pop(context);
      final abierto = await OpenFilex.open(archivo.path);

      // Android bloquea instalar desde fuera de la tienda hasta que se le da
      // permiso a esta app en concreto. Se dice, porque si no el síntoma es
      // "le di actualizar y no pasó nada".
      if (abierto.type != ResultType.done && context.mounted) {
        _avisar(
          context,
          'Android no dejó abrir el instalador. Dale permiso a Arialé Studio '
          'para instalar aplicaciones y vuelve a intentarlo.',
        );
      }
    } catch (_) {
      if (context.mounted) {
        Navigator.pop(context);
        _avisar(context, 'No pudimos bajar la actualización. Revisa tu conexión.');
      }
    } finally {
      avance.dispose();
    }
  }

  static void _avisar(BuildContext context, String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(mensaje), duration: const Duration(seconds: 6)),
    );
  }
}
