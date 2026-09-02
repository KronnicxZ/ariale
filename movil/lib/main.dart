import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'api/cliente.dart';
import 'pantallas/entrar.dart';
import 'pantallas/inicio.dart';
import 'sesion.dart';
import 'tema.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Sin esto, los nombres de días y meses salen en inglés.
  await initializeDateFormatting('es');

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
        home: _Puerta(api: api),
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
