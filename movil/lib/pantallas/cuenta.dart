import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../google.dart';
import '../iconos.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Mi cuenta: quién soy y con qué entro.
///
/// La contraseña nunca desaparece. Google es un atajo que se pone y se quita
/// desde aquí, con la sesión ya abierta: vincular es decir "esta cuenta de
/// Google soy yo", y eso solo lo puede decir quien ya entró con lo suyo.
class PantallaCuenta extends StatefulWidget {
  const PantallaCuenta({super.key});

  @override
  State<PantallaCuenta> createState() => _PantallaCuentaState();
}

class _PantallaCuentaState extends State<PantallaCuenta> {
  late Future<_Cuenta> _futuro;
  bool _trabajando = false;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Cuenta> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/auth/me');
    return _Cuenta.desdeJson(datos['user'] as Map<String, dynamic>);
  }

  void _avisar(String mensaje) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
    }
  }

  Future<void> _vincular() async {
    setState(() => _trabajando = true);
    try {
      final token = await pedirTokenDeGoogle();
      if (token == null) return;
      if (!mounted) return;

      final datos = await Sesion.de(context).enviar(
        '/api/v1/auth/google/vincular',
        {'idToken': token},
      );
      final correo = ((datos['google'] as Map)['correo'] as String?) ?? '';
      _avisar('Vinculada con $correo.');
      if (mounted) setState(() => _futuro = _cargar());
    } on ErrorGoogle catch (e) {
      _avisar(e.mensaje);
    } on ErrorApi catch (e) {
      _avisar(e.mensaje);
    } finally {
      if (mounted) setState(() => _trabajando = false);
    }
  }

  Future<void> _desvincular(_Cuenta cuenta) async {
    final seguro = await confirmar(
      context,
      titulo_: '¿Quitar Google?',
      mensaje: 'Dejarás de poder entrar con ${cuenta.correoGoogle}. '
          'Tu contraseña sigue funcionando igual.',
      confirmarTexto: 'Quitar',
    );
    if (!seguro) return;

    if (!mounted) return;
    setState(() => _trabajando = true);
    try {
      await Sesion.de(context).borrar('/api/v1/auth/google/vincular');
      // Que el teléfono olvide la cuenta, o la próxima vez entraría sola con
      // la de antes sin preguntar.
      await olvidarGoogle();
      _avisar('Ya no está vinculada.');
      if (mounted) setState(() => _futuro = _cargar());
    } on ErrorApi catch (e) {
      _avisar(e.mensaje);
    } finally {
      if (mounted) setState(() => _trabajando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi cuenta')),
      body: FutureBuilder<_Cuenta>(
        future: _futuro,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ErrorConReintento(
              mensaje: snap.error is ErrorApi
                  ? (snap.error as ErrorApi).mensaje
                  : 'No pudimos cargar tu cuenta.',
              alReintentar: () => setState(() => _futuro = _cargar()),
            );
          }

          final cuenta = snap.data!;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(cuenta.nombre, style: titulo(22)),
                      const SizedBox(height: 4),
                      Text(cuenta.correo, style: sutil(13.5)),
                    ],
                  ),
                ),
              ),

              const Seccion(
                'Cómo entras',
                apoyo: 'Tu contraseña funciona siempre; Google es un atajo',
              ),

              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Ico.google, size: 19),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              cuenta.googleVinculada
                                  ? cuenta.correoGoogle
                                  : 'Sin vincular',
                              style: TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                                color: cuenta.googleVinculada
                                    ? Marca.texto
                                    : Marca.textoSuave,
                              ),
                            ),
                          ),
                          if (cuenta.googleVinculada)
                            const Icon(Ico.bien, size: 19, color: Marca.exito),
                        ],
                      ),
                      const SizedBox(height: 14),

                      if (!hayGoogle)
                        Aviso(
                          icono: Ico.info,
                          texto: 'Esta versión de la app se compiló sin Google. '
                              'Hace falta el identificador del proyecto.',
                          color: Marca.textoSuave,
                        )
                      else if (_trabajando)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.symmetric(vertical: 6),
                            child: SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.4),
                            ),
                          ),
                        )
                      else if (cuenta.googleVinculada)
                        OutlinedButton.icon(
                          onPressed: () => _desvincular(cuenta),
                          icon: const Icon(Ico.cerrar, size: 18),
                          label: const Text('Quitar Google'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Marca.error,
                            minimumSize: const Size(double.infinity, 48),
                          ),
                        )
                      else
                        FilledButton.icon(
                          onPressed: _vincular,
                          icon: const Icon(Ico.google, size: 18),
                          label: const Text('Vincular mi cuenta de Google'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(double.infinity, 48),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  'Vinculada, podrás entrar tocando "Entrar con Google" sin '
                  'escribir la contraseña. Solo entra la cuenta que vincules '
                  'tú desde aquí.',
                  style: sutil(12.5),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Cuenta {
  _Cuenta({
    required this.nombre,
    required this.correo,
    required this.googleVinculada,
    required this.correoGoogle,
  });

  final String nombre;
  final String correo;
  final bool googleVinculada;
  final String correoGoogle;

  factory _Cuenta.desdeJson(Map<String, dynamic> j) {
    final google = j['google'] as Map<String, dynamic>?;
    return _Cuenta(
      nombre: j['name'] as String? ?? '',
      correo: j['email'] as String? ?? '',
      googleVinculada: google?['vinculada'] as bool? ?? false,
      correoGoogle: google?['correo'] as String? ?? '',
    );
  }
}
