import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../sesion.dart';
import '../tema.dart';

/// Acceso al panel. La dirección del servidor está detrás de un enlace
/// discreto: en el uso normal nadie la toca, pero permite apuntar la app
/// a otro servidor sin recompilar.
class PantallaEntrar extends StatefulWidget {
  const PantallaEntrar({super.key});

  @override
  State<PantallaEntrar> createState() => _PantallaEntrarState();
}

class _PantallaEntrarState extends State<PantallaEntrar> {
  final _correo = TextEditingController();
  final _contrasena = TextEditingController();
  final _formulario = GlobalKey<FormState>();

  bool _cargando = false;
  bool _verContrasena = false;
  String? _error;

  @override
  void dispose() {
    _correo.dispose();
    _contrasena.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });

    try {
      await Sesion.de(context).entrar(_correo.text.trim(), _contrasena.text);
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _cambiarServidor() async {
    final api = Sesion.de(context);
    final control = TextEditingController(text: api.servidor);

    final nuevo = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Dirección del servidor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Solo hace falta cambiarla si el panel está en otra dirección.',
              style: TextStyle(fontSize: 13, color: Marca.textoSuave),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: control,
              autofocus: true,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(hintText: 'https://…'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, control.text),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );

    if (nuevo != null && nuevo.trim().isNotEmpty) {
      await api.cambiarServidor(nuevo);
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = Sesion.de(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset(
                      'assets/marca/logo-ariale.png',
                      height: 78,
                      fit: BoxFit.contain,
                    ),
                    const SizedBox(height: 36),
                    Text('Entra a tu panel', style: titulo(28), textAlign: TextAlign.center),
                    const SizedBox(height: 6),
                    const Text(
                      'Tu agenda, tus clientas y las cuentas del estudio.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Marca.textoSuave, fontSize: 14),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _correo,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Correo'),
                      validator: (v) =>
                          (v == null || !v.contains('@')) ? 'Escribe un correo válido.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _contrasena,
                      obscureText: !_verContrasena,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _entrar(),
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _verContrasena ? Icons.visibility_off : Icons.visibility,
                            color: Marca.textoSuave,
                          ),
                          onPressed: () =>
                              setState(() => _verContrasena = !_verContrasena),
                        ),
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Escribe tu contraseña.' : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.error_outline, size: 18, color: Marca.error),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Marca.error, fontSize: 13.5),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: _cargando ? null : _entrar,
                      child: _cargando
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Marca.negro,
                              ),
                            )
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 20),
                    TextButton(
                      onPressed: _cambiarServidor,
                      child: Text(
                        api.servidor.replaceFirst(RegExp(r'^https?://'), ''),
                        style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
