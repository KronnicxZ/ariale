import 'package:flutter/material.dart';

/// Piezas de movimiento de la app.
///
/// La regla es que el movimiento explique algo: de dónde viene una tarjeta,
/// que una lista acaba de cargar, que un panel se abrió. Nada decorativo y
/// nada largo: por encima de un cuarto de segundo se percibe como lentitud.

/// Aparece subiendo un poco. Con `posicion` se escalona una lista, de modo
/// que la vista entra "en cascada" en vez de aparecer de golpe.
class Aparece extends StatefulWidget {
  const Aparece({
    super.key,
    required this.child,
    this.posicion = 0,
    this.desplazamiento = 10,
  });

  final Widget child;

  /// Índice dentro de la lista. Solo se escalonan los primeros: más allá,
  /// el retraso se notaría como pereza.
  final int posicion;

  final double desplazamiento;

  @override
  State<Aparece> createState() => _ApareceState();
}

class _ApareceState extends State<Aparece> with SingleTickerProviderStateMixin {
  late final AnimationController _control = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );

  late final Animation<double> _curva = CurvedAnimation(
    parent: _control,
    curve: Curves.easeOutCubic,
  );

  @override
  void initState() {
    super.initState();
    final retraso = Duration(milliseconds: 28 * widget.posicion.clamp(0, 7));
    if (retraso == Duration.zero) {
      _control.forward();
    } else {
      Future.delayed(retraso, () {
        if (mounted) _control.forward();
      });
    }
  }

  @override
  void dispose() {
    _control.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curva,
      builder: (context, hijo) => Opacity(
        opacity: _curva.value,
        child: Transform.translate(
          offset: Offset(0, widget.desplazamiento * (1 - _curva.value)),
          child: hijo,
        ),
      ),
      child: widget.child,
    );
  }
}

/// Cambia de contenido con un fundido corto. Se usa cuando lo que cambia es
/// el mismo sitio con otros datos —otro día de la agenda, otro periodo—, no
/// cuando se navega a otra pantalla.
class Cambia extends StatelessWidget {
  const Cambia({super.key, required this.child, this.clave});

  final Widget child;

  /// Lo que identifica al contenido. Al cambiar, se dispara el fundido.
  final Object? clave;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      layoutBuilder: (actual, anteriores) => Stack(
        alignment: Alignment.topCenter,
        children: [...anteriores, if (actual != null) actual],
      ),
      child: KeyedSubtree(key: ValueKey(clave), child: child),
    );
  }
}

/// Abre y cierra en alto con suavidad, para paneles que crecen —el mes del
/// calendario, un detalle que se despliega—.
class Despliega extends StatelessWidget {
  const Despliega({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: child,
    );
  }
}
