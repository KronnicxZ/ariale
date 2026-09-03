import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';

/// La clienta elegida al agendar. Si `id` es nulo es una clienta nueva
/// que el servidor creará al guardar la cita.
class ClientaElegida {
  ClientaElegida({this.id, required this.nombre, required this.telefono});

  final String? id;
  final String nombre;
  final String telefono;
}

/// Buscador de clientas con alta rápida. En el salón lo normal es que la
/// clienta ya exista; si no, se crea con nombre y teléfono y punto.
class PantallaElegirClienta extends StatefulWidget {
  const PantallaElegirClienta({super.key});

  @override
  State<PantallaElegirClienta> createState() => _PantallaElegirClientaState();
}

class _PantallaElegirClientaState extends State<PantallaElegirClienta> {
  final _busqueda = TextEditingController();
  List<Clienta> _todas = [];
  bool _cargando = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final datos = await Sesion.de(context).obtener(
        '/api/v1/clientas',
        params: {'orden': 'nombre'},
      );
      if (!mounted) return;
      setState(() {
        _todas = [
          for (final c in (datos['clientas'] as List))
            Clienta.desdeJson(c as Map<String, dynamic>),
        ];
        _cargando = false;
      });
    } on ErrorApi catch (e) {
      if (mounted) {
        setState(() {
          _error = e.mensaje;
          _cargando = false;
        });
      }
    }
  }

  List<Clienta> get _resultados {
    final texto = _busqueda.text.trim().toLowerCase();
    if (texto.isEmpty) return _todas;
    final digitos = soloDigitos(texto);
    return _todas
        .where((c) =>
            c.nombre.toLowerCase().contains(texto) ||
            (digitos.length >= 3 && c.telefono.contains(digitos)))
        .toList();
  }

  Future<void> _clientaNueva() async {
    final creada = await showModalBottomSheet<ClientaElegida>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FormularioClientaNueva(nombreSugerido: _busqueda.text.trim()),
    );
    if (creada != null && mounted) Navigator.pop(context, creada);
  }

  @override
  Widget build(BuildContext context) {
    final prefijo = Sesion.catalogo?.negocio.prefijo ?? '+58';

    return Scaffold(
      appBar: AppBar(title: const Text('Elegir clienta')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(18),
            child: TextField(
              controller: _busqueda,
              onChanged: (_) => setState(() {}),
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre o teléfono',
                prefixIcon: Icon(Ico.buscar, size: 20),
              ),
            ),
          ),
          Expanded(
            child: _cargando
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Marca.textoSuave),
                              ),
                              const SizedBox(height: 14),
                              OutlinedButton(
                                onPressed: _cargar,
                                child: const Text('Reintentar'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        itemCount: _resultados.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final c = _resultados[i];
                          return Material(
                            color: Marca.tarjeta,
                            borderRadius: BorderRadius.circular(14),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: () => Navigator.pop(
                                context,
                                ClientaElegida(
                                  id: c.id,
                                  nombre: c.nombre,
                                  telefono: c.telefono,
                                ),
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: Marca.borde),
                                ),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 18,
                                      backgroundColor:
                                          Marca.dorado.withValues(alpha: 0.18),
                                      child: Text(
                                        iniciales(c.nombre),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: Marca.negro,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            c.nombre,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14.5,
                                            ),
                                          ),
                                          Text(
                                            telefonoBonito(c.telefono, prefijo),
                                            style: const TextStyle(
                                              color: Marca.textoSuave,
                                              fontSize: 12.5,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (c.saldoCentavos > 0)
                                      Text(
                                        'Debe ${dinero(c.saldoCentavos)}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: Marca.error,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: OutlinedButton.icon(
                onPressed: _clientaNueva,
                icon: const Icon(Ico.nuevaClienta, size: 19),
                label: const Text('Registrar clienta nueva'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 50),
                  foregroundColor: Marca.negro,
                  side: const BorderSide(color: Marca.dorado),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FormularioClientaNueva extends StatefulWidget {
  const _FormularioClientaNueva({required this.nombreSugerido});

  final String nombreSugerido;

  @override
  State<_FormularioClientaNueva> createState() => _FormularioClientaNuevaState();
}

class _FormularioClientaNuevaState extends State<_FormularioClientaNueva> {
  late final TextEditingController _nombre;
  final _telefono = TextEditingController();
  bool _guardando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nombre = TextEditingController(text: widget.nombreSugerido);
  }

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final nombre = _nombre.text.trim();
    final telefono = soloDigitos(_telefono.text);

    if (nombre.length < 2) {
      setState(() => _error = 'Escribe el nombre.');
      return;
    }
    if (telefono.length < 10) {
      setState(() => _error = 'El teléfono debe tener al menos 10 dígitos.');
      return;
    }

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
      final datos = await Sesion.de(context).enviar(
        '/api/v1/clientas',
        {'nombre': nombre, 'telefono': telefono},
      );
      final creada = datos['clienta'] as Map<String, dynamic>;
      if (!mounted) return;
      Navigator.pop(
        context,
        ClientaElegida(
          id: creada['id'] as String,
          nombre: creada['nombre'] as String,
          telefono: creada['telefono'] as String,
        ),
      );
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefijo = Sesion.catalogo?.negocio.prefijo ?? '+58';

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Clienta nueva', style: titulo(23)),
          const SizedBox(height: 4),
          const Text(
            'Con el nombre y el teléfono basta para empezar.',
            style: TextStyle(color: Marca.textoSuave, fontSize: 13.5),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _nombre,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nombre y apellido'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _telefono,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: 'Teléfono',
              prefixText: '$prefijo ',
              hintText: '0424 135 4645',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Marca.error, fontSize: 13.5),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Marca.negro,
                    ),
                  )
                : const Text('Guardar y usar'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
