import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../bloqueo.dart';
import '../iconos.dart';
import '../tema.dart';

/// La pantalla del candado: la primera que se ve al abrir la app.
///
/// Encima de todo lo demás y sin forma de esquivarla —ni con el botón de
/// atrás—, porque si se pudiera esquivar no serviría de nada.
class PantallaCandado extends StatefulWidget {
  const PantallaCandado({super.key, required this.alAbrir});

  /// Se llama cuando el PIN o la huella son correctos.
  final VoidCallback alAbrir;

  @override
  State<PantallaCandado> createState() => _PantallaCandadoState();
}

class _PantallaCandadoState extends State<PantallaCandado> {
  String _pin = '';
  bool _error = false;
  int _castigo = 0;
  Timer? _cuentaAtras;

  @override
  void initState() {
    super.initState();
    _revisarCastigo();
    // La huella se pide sola al abrir: es el camino normal, y así en el 90 %
    // de las veces no hay que teclear nada.
    WidgetsBinding.instance.addPostFrameCallback((_) => _intentarHuella());
  }

  @override
  void dispose() {
    _cuentaAtras?.cancel();
    super.dispose();
  }

  Future<void> _revisarCastigo() async {
    final quedan = await Bloqueo.castigoRestante;
    if (!mounted) return;
    setState(() => _castigo = quedan);
    _cuentaAtras?.cancel();
    if (quedan > 0) {
      _cuentaAtras = Timer.periodic(const Duration(seconds: 1), (t) {
        if (!mounted) return t.cancel();
        setState(() => _castigo--);
        if (_castigo <= 0) t.cancel();
      });
    }
  }

  Future<void> _intentarHuella() async {
    if (!await Bloqueo.conHuella) return;
    if (await Bloqueo.castigoRestante > 0) return;
    if (await Bloqueo.pedirHuella()) widget.alAbrir();
  }

  Future<void> _pulsar(String cifra) async {
    if (_castigo > 0 || _pin.length >= 4) return;
    setState(() {
      _pin += cifra;
      _error = false;
    });
    if (_pin.length < 4) return;

    if (await Bloqueo.comprobarPin(_pin)) {
      widget.alAbrir();
      return;
    }
    if (!mounted) return;
    HapticFeedback.heavyImpact();
    setState(() {
      _pin = '';
      _error = true;
    });
    await _revisarCastigo();
  }

  void _borrar() {
    if (_pin.isEmpty) return;
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // El candado no se cierra con "atrás": esa es toda su razón de ser.
      canPop: false,
      child: Scaffold(
        backgroundColor: Marca.fondo,
        body: SafeArea(
          child: Column(
            children: [
              const Spacer(),
              Image.asset('assets/marca/logo-ariale.png', width: 190),
              const SizedBox(height: 28),
              Text(
                _castigo > 0
                    ? 'Espera ${_castigo}s'
                    : _error
                        ? 'Ese no es'
                        : 'Escribe tu PIN',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: _error || _castigo > 0 ? Marca.error : Marca.textoSuave,
                ),
              ),
              const SizedBox(height: 20),
              _Puntos(cuantos: _pin.length, error: _error),
              const Spacer(),
              _Teclado(
                habilitado: _castigo <= 0,
                alPulsar: _pulsar,
                alBorrar: _borrar,
                alUsarHuella: _intentarHuella,
              ),
              const SizedBox(height: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _Puntos extends StatelessWidget {
  const _Puntos({required this.cuantos, required this.error});

  final int cuantos;
  final bool error;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < 4; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            margin: const EdgeInsets.symmetric(horizontal: 9),
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < cuantos
                  ? (error ? Marca.error : Marca.dorado)
                  : Colors.transparent,
              border: Border.all(
                color: error ? Marca.error : Marca.textoTenue,
                width: 1.4,
              ),
            ),
          ),
      ],
    );
  }
}

class _Teclado extends StatelessWidget {
  const _Teclado({
    required this.habilitado,
    required this.alPulsar,
    required this.alBorrar,
    required this.alUsarHuella,
  });

  final bool habilitado;
  final ValueChanged<String> alPulsar;
  final VoidCallback alBorrar;
  final VoidCallback alUsarHuella;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: Bloqueo.hayHuellaEnElTelefono,
      builder: (context, snap) {
        final hayHuella = snap.data ?? false;

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            children: [
              for (final fila in const [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
              ])
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [for (final c in fila) _Tecla(c, habilitado ? () => alPulsar(c) : null)],
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  hayHuella
                      ? _TeclaIcono(Ico.huella, habilitado ? alUsarHuella : null)
                      : const SizedBox(width: 76, height: 68),
                  _Tecla('0', habilitado ? () => alPulsar('0') : null),
                  _TeclaIcono(Ico.borrarCifra, habilitado ? alBorrar : null),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Tecla extends StatelessWidget {
  // El campo no se llama "cifra": ese nombre ya es el del estilo de números
  // del tema, y aquí dentro lo taparía.
  const _Tecla(this.numero, this.alTocar);

  final String numero;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 76,
      height: 68,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: alTocar,
          child: Center(
            child: Text(
              numero,
              style: cifra(26, color: alTocar == null ? Marca.textoTenue : Marca.texto),
            ),
          ),
        ),
      ),
    );
  }
}

class _TeclaIcono extends StatelessWidget {
  const _TeclaIcono(this.icono, this.alTocar);

  final IconData icono;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 76,
      height: 68,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: alTocar,
          child: Center(
            child: Icon(
              icono,
              size: 24,
              color: alTocar == null ? Marca.textoTenue : Marca.textoSuave,
            ),
          ),
        ),
      ),
    );
  }
}
