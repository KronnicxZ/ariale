import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../sesion.dart';
import '../tema.dart';
import 'agenda.dart';
import 'clientas.dart';
import 'cobrar.dart';
import 'hoy.dart';
import 'mas.dart';

/// Armazón de la app: cinco destinos en la barra inferior, al alcance del
/// pulgar. La agenda es el centro de todo; el resto del panel vive en "Más"
/// para no llenar la barra de cosas que se miran una vez por semana.
class PantallaInicio extends StatefulWidget {
  const PantallaInicio({super.key});

  @override
  State<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends State<PantallaInicio> {
  int _indice = 0;
  String? _diaAgenda;
  bool _cargandoCatalogo = true;
  String? _errorCatalogo;

  @override
  void initState() {
    super.initState();
    _cargarCatalogo();
  }

  /// El catálogo se descarga una vez al entrar: servicios, especialistas,
  /// tasa y ajustes. Casi todas las pantallas lo necesitan.
  Future<void> _cargarCatalogo() async {
    setState(() {
      _cargandoCatalogo = true;
      _errorCatalogo = null;
    });
    try {
      final datos = await Sesion.de(context).obtener('/api/v1/catalogo');
      Sesion.catalogo = Catalogo.desdeJson(datos);
      if (mounted) setState(() => _cargandoCatalogo = false);
    } on ErrorApi catch (e) {
      if (mounted) {
        setState(() {
          _cargandoCatalogo = false;
          _errorCatalogo = e.mensaje;
        });
      }
    }
  }

  void _irAAgenda(String dia) {
    setState(() {
      _diaAgenda = dia;
      _indice = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_cargandoCatalogo) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_errorCatalogo != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 40, color: Marca.textoSuave),
                const SizedBox(height: 16),
                Text(
                  _errorCatalogo!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Marca.textoSuave),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _cargarCatalogo,
                  child: const Text('Reintentar'),
                ),
                TextButton(
                  onPressed: () => Sesion.de(context).salir(),
                  child: const Text('Salir de la sesión'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final pantallas = [
      PantallaHoy(alIrAAgenda: _irAAgenda),
      PantallaAgenda(diaInicial: _diaAgenda),
      const PantallaClientas(),
      const PantallaCobrar(),
      const PantallaMas(),
    ];

    return Scaffold(
      body: IndexedStack(index: _indice, children: pantallas),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (i) => setState(() => _indice = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.today_outlined),
            selectedIcon: Icon(Icons.today),
            label: 'Hoy',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Agenda',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Clientas',
          ),
          NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            selectedIcon: Icon(Icons.payments),
            label: 'Cobrar',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view),
            label: 'Más',
          ),
        ],
      ),
    );
  }
}
