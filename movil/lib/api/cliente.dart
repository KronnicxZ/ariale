import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Error de la API con el mensaje que ya viene traducido del servidor.
class ErrorApi implements Exception {
  ErrorApi(this.mensaje, {this.codigo});
  final String mensaje;
  final int? codigo;

  bool get sesionCaducada => codigo == 401;

  @override
  String toString() => mensaje;
}

/// Cliente HTTP contra la API del panel.
///
/// Guarda el token y la URL del servidor en el dispositivo, así que la app
/// arranca ya con sesión y no hay que reloguearse cada día.
class ClienteApi extends ChangeNotifier {
  ClienteApi({String? servidorPorDefecto})
      : _servidor = servidorPorDefecto ?? _servidorInicial();

  /// Prefijo de lo que se guarda de cada consulta para poder enseñarlo sin
  /// internet. Ver [_guardarEnCache].
  static const _prefijoCache = 'cache:';

  /// Cuántas consultas se guardan. Suficiente para las pantallas del día a
  /// día, y no tantas como para llenar el teléfono.
  static const _maximoEnCache = 60;

  static const _claveToken = 'ariale_token';
  static const _claveServidor = 'ariale_servidor';
  static const _claveNombre = 'ariale_usuaria';
  static const _claveEspecialista = 'ariale_especialista';

  String _servidor;
  String? _token;
  String? _nombreUsuaria;
  String? _miEspecialistaId;

  String get servidor => _servidor;
  String? get nombreUsuaria => _nombreUsuaria;

  /// Cuál de las dos entró. La agenda es la misma para todas: esto solo
  /// sirve para ponerla a ella primero y marcar su columna.
  String? get miEspecialistaId => _miEspecialistaId;
  bool get haySesion => _token != null;

  /// Cuándo se vio por última vez lo que se está enseñando, si viene de lo
  /// guardado y no del servidor. Nulo mientras haya internet.
  ///
  /// El estudio se queda sin conexión a ratos y la agenda del día es lo
  /// único que de verdad hace falta a las tres de la tarde: mejor enseñar
  /// lo último que se vio, diciendo cuándo se vio, que una pantalla vacía.
  DateTime? get sinConexionDesde => _sinConexionDesde;
  DateTime? _sinConexionDesde;

  /// En el emulador de Android, `localhost` es el propio teléfono: el equipo
  /// anfitrión se alcanza por 10.0.2.2. En web y escritorio vale localhost.
  static String _servidorInicial() {
    const definido = String.fromEnvironment('SERVIDOR');
    if (definido.isNotEmpty) return definido;
    if (kIsWeb) return 'http://localhost:3000';
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3000'
        : 'http://localhost:3000';
  }

  Future<void> cargarSesion() async {
    final prefs = await SharedPreferences.getInstance();
    _servidor = prefs.getString(_claveServidor) ?? _servidor;
    _token = prefs.getString(_claveToken);
    _nombreUsuaria = prefs.getString(_claveNombre);
    _miEspecialistaId = prefs.getString(_claveEspecialista);
    notifyListeners();
  }

  Future<void> cambiarServidor(String url) async {
    _servidor = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_claveServidor, _servidor);
    notifyListeners();
  }

  Future<void> entrar(String correo, String contrasena) async {
    final datos = await _peticion(
      'POST',
      '/api/v1/auth/login',
      cuerpo: {'email': correo, 'password': contrasena},
      conToken: false,
    );

    final usuaria = datos['user'] as Map;
    _token = datos['token'] as String;
    _nombreUsuaria = usuaria['name'] as String?;
    _miEspecialistaId = usuaria['specialistId'] as String?;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_claveToken, _token!);
    if (_nombreUsuaria != null) {
      await prefs.setString(_claveNombre, _nombreUsuaria!);
    }
    if (_miEspecialistaId case final id?) {
      await prefs.setString(_claveEspecialista, id);
    } else {
      await prefs.remove(_claveEspecialista);
    }
    notifyListeners();
  }

  Future<void> salir() async {
    _token = null;
    _nombreUsuaria = null;
    _miEspecialistaId = null;
    _sinConexionDesde = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_claveToken);
    await prefs.remove(_claveNombre);
    await prefs.remove(_claveEspecialista);
    // Lo guardado para verlo sin internet son datos de clientas: al cerrar
    // sesión no se queda en el teléfono.
    await _vaciarCache();
    notifyListeners();
  }

  Future<Map<String, dynamic>> obtener(String ruta, {Map<String, String>? params}) =>
      _peticion('GET', ruta, params: params);

  /* ------------------------------------------------------------------ */
  /* Lo guardado para cuando no hay internet                             */
  /* ------------------------------------------------------------------ */

  String _claveDeCache(String ruta, Map<String, String>? params) {
    if (params == null || params.isEmpty) return '$_prefijoCache$ruta';
    final orden = params.keys.toList()..sort();
    final cola = orden.map((k) => '$k=${params[k]}').join('&');
    return '$_prefijoCache$ruta?$cola';
  }

  /// Guarda la respuesta de una consulta con la hora a la que se vio.
  ///
  /// Solo GET: lo que se manda al servidor no se guarda nunca aquí, porque
  /// reenviarlo solo por haber perdido la conexión sería peor que fallar.
  Future<void> _guardarEnCache(String clave, String cuerpo) async {
    // Una respuesta enorme —una lista larguísima de clientas— no compensa:
    // llena el teléfono y no es lo que se consulta sin internet.
    if (cuerpo.length > 256 * 1024) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      clave,
      jsonEncode({'cuando': DateTime.now().millisecondsSinceEpoch, 'datos': cuerpo}),
    );

    final guardadas = prefs.getKeys().where((k) => k.startsWith(_prefijoCache)).toList();
    if (guardadas.length <= _maximoEnCache) return;

    // Se van las más viejas. Sin esto, cada combinación de día y filtro deja
    // su rastro y la lista crece sin fin.
    final porFecha = <String, int>{};
    for (final k in guardadas) {
      try {
        porFecha[k] = (jsonDecode(prefs.getString(k)!) as Map)['cuando'] as int;
      } catch (_) {
        porFecha[k] = 0;
      }
    }
    final orden = porFecha.keys.toList()..sort((a, b) => porFecha[a]!.compareTo(porFecha[b]!));
    for (final k in orden.take(guardadas.length - _maximoEnCache)) {
      await prefs.remove(k);
    }
  }

  /// Lo último que se vio de esa consulta, o null si nunca se vio.
  Future<(Map<String, dynamic>, DateTime)?> _leerDeCache(String clave) async {
    final prefs = await SharedPreferences.getInstance();
    final crudo = prefs.getString(clave);
    if (crudo == null) return null;
    try {
      final envoltorio = jsonDecode(crudo) as Map<String, dynamic>;
      return (
        jsonDecode(envoltorio['datos'] as String) as Map<String, dynamic>,
        DateTime.fromMillisecondsSinceEpoch(envoltorio['cuando'] as int),
      );
    } catch (_) {
      return null;
    }
  }

  /// Al salir de la sesión no queda nada de la clienta anterior guardado.
  Future<void> _vaciarCache() async {
    final prefs = await SharedPreferences.getInstance();
    for (final k in prefs.getKeys().where((k) => k.startsWith(_prefijoCache)).toList()) {
      await prefs.remove(k);
    }
  }

  Future<Map<String, dynamic>> enviar(String ruta, Map<String, dynamic> cuerpo) =>
      _peticion('POST', ruta, cuerpo: cuerpo);

  Future<Map<String, dynamic>> parchear(String ruta, Map<String, dynamic> cuerpo) =>
      _peticion('PATCH', ruta, cuerpo: cuerpo);

  Future<Map<String, dynamic>> borrar(String ruta, {Map<String, String>? params}) =>
      _peticion('DELETE', ruta, params: params);

  /// Sube un archivo con campos sueltos al lado, como un formulario.
  ///
  /// Las fotos no caben en un JSON: en base64 crecen un tercio y una tanda
  /// de contactos no pasaría. Van una a una y en binario.
  Future<Map<String, dynamic>> subirArchivo(
    String ruta, {
    required List<int> bytes,
    required String nombreArchivo,
    required String tipo,
    Map<String, String> campos = const {},
  }) async {
    final peticion = http.MultipartRequest('POST', Uri.parse('$_servidor$ruta'))
      ..fields.addAll(campos)
      ..files.add(
        http.MultipartFile.fromBytes(
          'archivo',
          bytes,
          filename: nombreArchivo,
          contentType: MediaType.parse(tipo),
        ),
      );
    if (_token != null) peticion.headers['Authorization'] = 'Bearer $_token';

    late http.Response respuesta;
    try {
      final envio = await peticion.send().timeout(const Duration(seconds: 30));
      respuesta = await http.Response.fromStream(envio);
    } catch (_) {
      throw ErrorApi('No pudimos conectar con el servidor.');
    }

    if (respuesta.statusCode == 401) {
      await salir();
      throw ErrorApi('Tu sesión caducó. Entra de nuevo.', codigo: 401);
    }

    Map<String, dynamic> datos;
    try {
      datos = jsonDecode(respuesta.body) as Map<String, dynamic>;
    } catch (_) {
      throw ErrorApi('El servidor respondió algo inesperado.', codigo: respuesta.statusCode);
    }
    if (respuesta.statusCode >= 400) {
      throw ErrorApi(datos['error']?.toString() ?? 'Algo salió mal.', codigo: respuesta.statusCode);
    }
    return datos;
  }

  Future<Map<String, dynamic>> _peticion(
    String metodo,
    String ruta, {
    Map<String, dynamic>? cuerpo,
    Map<String, String>? params,
    bool conToken = true,
  }) async {
    final uri = Uri.parse('$_servidor$ruta').replace(
      queryParameters: params?.isEmpty ?? true ? null : params,
    );

    final cabeceras = <String, String>{
      'Content-Type': 'application/json',
      if (conToken && _token != null) 'Authorization': 'Bearer $_token',
    };

    final claveCache = metodo == 'GET' ? _claveDeCache(ruta, params) : null;

    late http.Response respuesta;
    try {
      final cuerpoJson = cuerpo == null ? null : jsonEncode(cuerpo);
      // El timeout va sobre el futuro, no sobre la respuesta ya recibida.
      final Future<http.Response> envio = switch (metodo) {
        'POST' => http.post(uri, headers: cabeceras, body: cuerpoJson),
        'PATCH' => http.patch(uri, headers: cabeceras, body: cuerpoJson),
        'DELETE' => http.delete(uri, headers: cabeceras),
        _ => http.get(uri, headers: cabeceras),
      };
      respuesta = await envio.timeout(const Duration(seconds: 20));
    } catch (_) {
      // Sin internet, lo último que se vio de esta misma consulta. Arriba se
      // avisa de que es de antes y de cuándo, para que nadie confunda una
      // agenda vieja con la de hoy.
      if (claveCache != null) {
        final guardado = await _leerDeCache(claveCache);
        if (guardado != null) {
          _sinConexionDesde = guardado.$2;
          notifyListeners();
          return guardado.$1;
        }
      }
      throw ErrorApi(
        'No pudimos conectar con el servidor.\n'
        'Revisa tu internet o la dirección en Ajustes.',
      );
    }

    // Se ha contestado: si veníamos de estar sin conexión, ya no lo estamos.
    if (_sinConexionDesde != null) {
      _sinConexionDesde = null;
      notifyListeners();
    }

    if (respuesta.statusCode == 401) {
      await salir();
      throw ErrorApi('Tu sesión caducó. Entra de nuevo.', codigo: 401);
    }

    Map<String, dynamic> datos;
    try {
      datos = jsonDecode(respuesta.body) as Map<String, dynamic>;
    } catch (_) {
      throw ErrorApi('El servidor respondió algo inesperado.', codigo: respuesta.statusCode);
    }

    if (respuesta.statusCode >= 400) {
      throw ErrorApi(
        datos['error']?.toString() ?? 'Algo salió mal.',
        codigo: respuesta.statusCode,
      );
    }

    if (claveCache != null) await _guardarEnCache(claveCache, respuesta.body);

    return datos;
  }
}
