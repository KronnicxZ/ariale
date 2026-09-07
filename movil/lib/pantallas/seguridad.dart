import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../bloqueo.dart';
import '../iconos.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Poner, quitar y ajustar el candado.
///
/// Quitarlo o cambiar el PIN pide el PIN de ahora. Sin eso, cualquiera que
/// pillara el teléfono abierto podría desactivarlo en dos toques y el
/// candado sería un adorno.
class PantallaSeguridad extends StatefulWidget {
  const PantallaSeguridad({super.key});

  @override
  State<PantallaSeguridad> createState() => _PantallaSeguridadState();
}

class _PantallaSeguridadState extends State<PantallaSeguridad> {
  bool _cargando = true;
  bool _activo = false;
  bool _huella = true;
  bool _hayLector = false;
  int _espera = 60;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final activo = await Bloqueo.activo;
    final huella = await Bloqueo.conHuella;
    final lector = await Bloqueo.hayHuellaEnElTelefono;
    final espera = await Bloqueo.espera;
    if (!mounted) return;
    setState(() {
      _activo = activo;
      _huella = huella;
      _hayLector = lector;
      _espera = espera;
      _cargando = false;
    });
  }

  /// Pide el PIN actual. Devuelve true si acertó.
  Future<bool> _pedirPinActual() async {
    final pin = await _pedirPin(context, titulo: 'Escribe tu PIN');
    if (pin == null) return false;
    final vale = await Bloqueo.comprobarPin(pin);
    if (!vale && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Ese PIN no es.')));
    }
    return vale;
  }

  Future<void> _activar() async {
    final pin = await _pedirPin(context, titulo: 'Elige un PIN de 4 cifras');
    if (pin == null) return;
    if (!mounted) return;
    final repetido = await _pedirPin(context, titulo: 'Repítelo');
    if (repetido == null) return;
    if (pin != repetido) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('No coinciden. Prueba otra vez.')));
      }
      return;
    }
    await Bloqueo.activar(pin, huella: _hayLector);
    await _cargar();
  }

  Future<void> _desactivar() async {
    if (!await _pedirPinActual()) return;
    await Bloqueo.desactivar();
    await _cargar();
  }

  Future<void> _cambiarPin() async {
    if (!await _pedirPinActual()) return;
    if (!mounted) return;
    final nuevo = await _pedirPin(context, titulo: 'Nuevo PIN');
    if (nuevo == null) return;
    if (!mounted) return;
    final repetido = await _pedirPin(context, titulo: 'Repítelo');
    if (nuevo != repetido) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('No coinciden. Prueba otra vez.')));
      }
      return;
    }
    await Bloqueo.activar(nuevo, huella: _huella);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('PIN cambiado.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Seguridad')),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: SwitchListTile(
                    value: _activo,
                    onChanged: (v) => v ? _activar() : _desactivar(),
                    title: const Text('Pedir PIN al abrir',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      _activo
                          ? 'La app no se abre sin tu PIN o tu huella.'
                          : 'Ahora mismo cualquiera que coja el teléfono ve la '
                              'agenda, los teléfonos de las clientas y las cuentas.',
                      style: sutil(12.5),
                    ),
                    secondary: Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _activo ? Marca.exito : Marca.textoTenue,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Icon(Ico.candado, size: 18, color: Colors.white),
                    ),
                  ),
                ),

                if (_activo) ...[
                  const Seccion('Cómo se abre'),
                  Card(
                    child: Column(
                      children: [
                        SwitchListTile(
                          value: _huella && _hayLector,
                          onChanged: _hayLector
                              ? (v) async {
                                  await Bloqueo.cambiarHuella(v);
                                  await _cargar();
                                }
                              : null,
                          title: const Text('Con la huella'),
                          subtitle: Text(
                            _hayLector
                                ? 'Más rápido. El PIN sigue valiendo siempre.'
                                : 'Este teléfono no tiene huella registrada.',
                            style: sutil(12.5),
                          ),
                          secondary: const Icon(Ico.huella, size: 20),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(Ico.clave, size: 20),
                          title: const Text('Cambiar el PIN'),
                          trailing: const Icon(Ico.siguiente,
                              size: 20, color: Marca.textoTenue),
                          onTap: _cambiarPin,
                        ),
                      ],
                    ),
                  ),

                  const Seccion(
                    'Cuándo se vuelve a cerrar',
                    apoyo: 'Al salir de la app y volver. La app abre WhatsApp para '
                        'cada aviso, así que "al momento" pide el PIN muy a menudo.',
                  ),
                  Card(
                    child: Column(
                      children: [
                        for (final s in Bloqueo.esperasPosibles)
                          ListTile(
                            onTap: () async {
                              await Bloqueo.cambiarEspera(s);
                              await _cargar();
                            },
                            title: Text(switch (s) {
                              0 => 'Al momento',
                              60 => 'Al minuto',
                              _ => 'A los 5 minutos',
                            }),
                            trailing: _espera == s
                                ? const Icon(Ico.listo, size: 20, color: Marca.dorado)
                                : null,
                          ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),
                Aviso(
                  icono: Ico.info,
                  texto: 'El candado es de este teléfono: no cambia tu contraseña '
                      'ni afecta a las demás. Si se te olvida el PIN, cierra sesión '
                      'y vuelve a entrar con tu correo.',
                  color: Marca.textoSuave,
                ),
              ],
            ),
    );
  }
}

/// Pide cuatro cifras. Devuelve null si se cierra sin escribirlas.
Future<String?> _pedirPin(BuildContext context, {required String titulo}) {
  final control = TextEditingController();

  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(titulo),
      content: TextField(
        controller: control,
        autofocus: true,
        obscureText: true,
        keyboardType: TextInputType.number,
        maxLength: 4,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: const InputDecoration(counterText: '', hintText: '••••'),
        style: const TextStyle(fontSize: 22, letterSpacing: 10),
        textAlign: TextAlign.center,
        onSubmitted: (v) {
          if (v.length == 4) Navigator.pop(context, v);
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            if (control.text.length == 4) Navigator.pop(context, control.text);
          },
          child: const Text('Listo'),
        ),
      ],
    ),
  );
}
