import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'api/cliente.dart';
import 'bloqueo.dart';
import 'navegacion.dart';
import 'pantallas/candado.dart';
import 'pantallas/entrar.dart';
import 'pantallas/inicio.dart';
import 'recordatorios.dart';
import 'sesion.dart';
import 'tema.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Sin esto, los nombres de días y meses salen en inglés.
  await initializeDateFormatting('es');
  await Recordatorios.iniciar();

  final api = ClienteApi();
  await api.cargarSesion();

  runApp(ArialeApp(api: api));
}

class ArialeApp extends StatelessWidget {
  const ArialeApp({super.key, required this.api});

  final ClienteApi api;

  @override
  Widget build(BuildContext context) {
    return Sesion(
      api: api,
      child: MaterialApp(
        navigatorKey: Navegacion.llave,
        title: 'Arialé Studio',
        debugShowCheckedModeBanner: false,
        theme: construirTema(),
        // La app es solo en español: no hay selector de idioma.
        locale: const Locale('es'),
        supportedLocales: const [Locale('es'), Locale('en')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: _Cerradura(child: _Puerta(api: api)),
      ),
    );
  }
}

/// Decide si mostrar el acceso o la app, y reacciona cuando la sesión
/// caduca en cualquier pantalla.
class _Puerta extends StatelessWidget {
  const _Puerta({required this.api});

  final ClienteApi api;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: api,
      builder: (context, _) =>
          api.haySesion ? const PantallaInicio() : const PantallaEntrar(),
    );
  }
}


/// El candado por encima de todo.
///
/// No es una pantalla más a la que se navega: envuelve la app entera, así
/// que no hay forma de llegar a nada de dentro sin pasar por ella —ni
/// abriendo la app, ni volviendo de WhatsApp, ni desde el aviso de una cita.
///
/// Al irse a segundo plano se apunta la hora. Al volver, si ha pasado más de
/// lo que la dueña eligió, se cierra otra vez. Cero segundos es "al momento".
class _Cerradura extends StatefulWidget {
  const _Cerradura({required this.child});

  final Widget child;

  @override
  State<_Cerradura> createState() => _CerraduraState();
}

class _CerraduraState extends State<_Cerradura> with WidgetsBindingObserver {
  bool _cerrado = false;
  bool _comprobado = false;
  DateTime? _salidaAlFondo;

  // Los ajustes se guardan aquí, no se leen al volver: preguntarlos entonces
  // es una espera, y durante esa espera la agenda ya se está viendo. Al
  // volver hay que decidir en el mismo instante, sin esperar a nada.
  bool _hayCandado = false;
  int _espera = 60;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _releerAjustes(cerrandoSiHace: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _releerAjustes({bool cerrandoSiHace = false}) async {
    final activo = await Bloqueo.activo;
    final espera = await Bloqueo.espera;
    if (!mounted) return;
    setState(() {
      _hayCandado = activo;
      _espera = espera;
      _comprobado = true;
      if (cerrandoSiHace) _cerrado = activo;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.paused) {
      _salidaAlFondo = DateTime.now();
      return;
    }
    if (estado != AppLifecycleState.resumed) return;

    final desde = _salidaAlFondo;
    if (_hayCandado && desde != null) {
      final fuera = DateTime.now().difference(desde).inSeconds;
      if (fuera >= _espera && !_cerrado) setState(() => _cerrado = true);
    }
    // Y de paso se releen, por si acaban de encender el candado o cambiar
    // la espera desde Seguridad.
    _releerAjustes();
  }

  @override
  Widget build(BuildContext context) {
    // Mientras se mira si hay candado no se enseña nada: un parpadeo de la
    // agenda antes de cerrarse sería justo lo que esto viene a evitar.
    if (!_comprobado) {
      return const ColoredBox(color: Marca.fondo, child: SizedBox.expand());
    }

    return Stack(
      children: [
        widget.child,
        if (_cerrado)
          PantallaCandado(alAbrir: () => setState(() => _cerrado = false)),
      ],
    );
  }
}
