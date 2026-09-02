import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'elegir_clienta.dart';

/// Registrar una venta de mostrador: quién, qué se llevó y cuánto pagó.
/// Lo normal es cobrar la cita desde la agenda; esto es para todo lo demás.
class PantallaNuevaVenta extends StatefulWidget {
  const PantallaNuevaVenta({super.key, this.clientaInicial});

  final ClientaElegida? clientaInicial;

  @override
  State<PantallaNuevaVenta> createState() => _PantallaNuevaVentaState();
}

class _PantallaNuevaVentaState extends State<PantallaNuevaVenta> {
  ClientaElegida? _clienta;
  String? _especialistaId;
  final List<_LineaVenta> _lineas = [];
  final _descuento = TextEditingController();
  final _cobro = TextEditingController();
  String _metodo = 'CASH_USD';
  bool _cobraAhora = true;
  bool _guardando = false;

  static const _metodos = <(String, String)>[
    ('CASH_USD', 'Efectivo \$'),
    ('CASH_VES', 'Efectivo Bs.'),
    ('PAGO_MOVIL', 'Pago móvil'),
    ('TRANSFER', 'Transferencia'),
    ('ZELLE', 'Zelle'),
    ('BINANCE', 'Binance'),
    ('CARD', 'Tarjeta'),
  ];

  @override
  void initState() {
    super.initState();
    _clienta = widget.clientaInicial;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Quien entró es quien suele cobrar lo suyo.
    _especialistaId ??= Sesion.de(context).miEspecialistaId;
  }

  @override
  void dispose() {
    _descuento.dispose();
    _cobro.dispose();
    super.dispose();
  }

  int get _subtotalCentavos =>
      _lineas.fold(0, (suma, l) => suma + l.precioCentavos * l.cantidad);

  int get _descuentoCentavos {
    final valor = double.tryParse(_descuento.text.replaceAll(',', '.')) ?? 0;
    return (valor * 100).round().clamp(0, _subtotalCentavos);
  }

  int get _totalCentavos => _subtotalCentavos - _descuentoCentavos;

  Future<void> _elegirClienta() async {
    final elegida = await Navigator.of(context).push<ClientaElegida>(
      MaterialPageRoute(builder: (_) => const PantallaElegirClienta()),
    );
    if (elegida != null) setState(() => _clienta = elegida);
  }

  Future<void> _agregarServicio() async {
    final servicios = Sesion.catalogo?.servicios ?? const <Servicio>[];
    final elegido = await showModalBottomSheet<Servicio>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaServicios(servicios: servicios),
    );
    if (elegido == null) return;

    setState(() {
      // Si ya está en la lista, sumamos una unidad en vez de repetir la línea.
      final existente = _lineas.indexWhere((l) => l.servicioId == elegido.id);
      if (existente >= 0) {
        _lineas[existente].cantidad++;
      } else {
        _lineas.add(
          _LineaVenta(
            servicioId: elegido.id,
            descripcion: elegido.nombre,
            precioCentavos: elegido.precioCentavos,
          ),
        );
      }
      _sincronizarCobro();
    });
  }

  /// Mientras nadie toque el monto a mano, cobrar = el total.
  void _sincronizarCobro() {
    _cobro.text = (_totalCentavos / 100).toStringAsFixed(2);
  }

  Future<void> _guardar() async {
    if (_clienta == null) {
      _avisar('Elige una clienta.');
      return;
    }
    if (_lineas.isEmpty) {
      _avisar('Agrega al menos un servicio.');
      return;
    }

    setState(() => _guardando = true);
    final api = Sesion.de(context);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      // Una clienta nueva se da de alta antes: la venta necesita su ficha.
      var clientaId = _clienta!.id;
      if (clientaId == null) {
        final creada = await api.enviar('/api/v1/clientas', {
          'nombre': _clienta!.nombre,
          'telefono': _clienta!.telefono,
        });
        clientaId = (creada['clienta'] as Map)['id'] as String;
      }

      final cobroTexto = double.tryParse(_cobro.text.replaceAll(',', '.')) ?? 0;
      final cobroCentavos = _cobraAhora ? (cobroTexto * 100).round() : 0;

      await api.enviar('/api/v1/ventas', {
        'clientaId': clientaId,
        if (_especialistaId != null) 'especialistaId': _especialistaId,
        'descuentoCentavos': _descuentoCentavos,
        'lineas': [
          for (final linea in _lineas)
            {
              'servicioId': linea.servicioId,
              'descripcion': linea.descripcion,
              'cantidad': linea.cantidad,
              'precioCentavos': linea.precioCentavos,
            },
        ],
        if (cobroCentavos > 0)
          'pago': {'montoCentavos': cobroCentavos, 'metodo': _metodo},
      });

      mensajero.showSnackBar(const SnackBar(content: Text('Venta registrada.')));
      navegador.pop(true);
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _guardando = false);
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  @override
  Widget build(BuildContext context) {
    final especialistas = Sesion.catalogo?.especialistas ?? const <Especialista>[];

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva venta')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(fontSize: 11.5, color: Marca.textoSuave),
                  ),
                  Text(dinero(_totalCentavos), style: cifra(22)),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: FilledButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Registrar venta'),
                ),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(
                  _clienta?.nombre ?? 'Elegir clienta',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: _clienta == null ? Marca.textoSuave : Marca.texto,
                  ),
                ),
                subtitle: _clienta == null
                    ? null
                    : Text(telefonoBonito(_clienta!.telefono)),
                trailing: const Icon(Icons.chevron_right),
                onTap: _elegirClienta,
              ),
            ),
            const Seccion('Servicios'),
            if (_lineas.isEmpty)
              Vacio(
                icono: Icons.spa_outlined,
                titulo: 'Sin servicios todavía',
                descripcion: 'Agrega lo que se llevó la clienta.',
                accion: OutlinedButton.icon(
                  onPressed: _agregarServicio,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Agregar servicio'),
                ),
              )
            else ...[
              ..._lineas.map(
                (linea) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                linea.descripcion,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14.5,
                                ),
                              ),
                              Text(
                                '${dinero(linea.precioCentavos)} c/u',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: Marca.textoSuave,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() {
                            if (linea.cantidad > 1) {
                              linea.cantidad--;
                            } else {
                              _lineas.remove(linea);
                            }
                            _sincronizarCobro();
                          }),
                          icon: Icon(
                            linea.cantidad > 1
                                ? Icons.remove_circle_outline
                                : Icons.delete_outline,
                            size: 20,
                          ),
                        ),
                        Text('${linea.cantidad}', style: cifra(15)),
                        IconButton(
                          onPressed: () => setState(() {
                            linea.cantidad++;
                            _sincronizarCobro();
                          }),
                          icon: const Icon(Icons.add_circle_outline, size: 20),
                        ),
                        SizedBox(
                          width: 64,
                          child: Text(
                            dinero(linea.precioCentavos * linea.cantidad),
                            textAlign: TextAlign.right,
                            style: cifra(14.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _agregarServicio,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Agregar otro'),
              ),
            ],
            if (especialistas.isNotEmpty) ...[
              const Seccion('¿Quién lo hizo?', apoyo: 'Opcional, para los reportes'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in especialistas)
                    ChoiceChip(
                      label: Text(e.nombre),
                      selected: _especialistaId == e.id,
                      showCheckmark: false,
                      avatar: CircleAvatar(
                        radius: 6,
                        backgroundColor: Marca.desdeHex(e.color),
                      ),
                      onSelected: (v) => setState(
                        () => _especialistaId = v ? e.id : null,
                      ),
                    ),
                ],
              ),
            ],
            const Seccion('Cobro'),
            TextField(
              controller: _descuento,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Descuento',
                prefixText: '\$ ',
                helperText: 'Déjalo vacío si no hay descuento',
              ),
              onChanged: (_) => setState(_sincronizarCobro),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              value: _cobraAhora,
              onChanged: (v) => setState(() => _cobraAhora = v),
              activeThumbColor: Marca.dorado,
              contentPadding: EdgeInsets.zero,
              title: const Text('¿Te pagó ahora?'),
              subtitle: Text(
                _cobraAhora
                    ? 'Se guarda el pago junto con la venta.'
                    : 'Queda apuntado como que te debe.',
                style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
              ),
            ),
            if (_cobraAhora) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _cobro,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Cuánto te pagó',
                  prefixText: '\$ ',
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final (clave, rotulo) in _metodos)
                    ChoiceChip(
                      label: Text(rotulo),
                      selected: _metodo == clave,
                      showCheckmark: false,
                      onSelected: (_) => setState(() => _metodo = clave),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Buscador de servicios del catálogo, agrupados por categoría.
class _HojaServicios extends StatefulWidget {
  const _HojaServicios({required this.servicios});

  final List<Servicio> servicios;

  @override
  State<_HojaServicios> createState() => _HojaServiciosState();
}

class _HojaServiciosState extends State<_HojaServicios> {
  final _busqueda = TextEditingController();

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final texto = _busqueda.text.trim().toLowerCase();
    final visibles = texto.isEmpty
        ? widget.servicios
        : widget.servicios
            .where((s) => s.nombre.toLowerCase().contains(texto))
            .toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.92,
      builder: (context, scroll) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: TextField(
              controller: _busqueda,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Buscar servicio',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              itemCount: visibles.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final servicio = visibles[i];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 8,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Marca.desdeHex(servicio.categoriaColor),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  title: Text(
                    servicio.nombre,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
                  ),
                  subtitle: Text(
                    '${servicio.categoriaNombre} · ${duracion(servicio.duracionMin)}',
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  trailing: Text(dinero(servicio.precioCentavos), style: cifra(15)),
                  onTap: () => Navigator.pop(context, servicio),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _LineaVenta {
  _LineaVenta({
    required this.servicioId,
    required this.descripcion,
    required this.precioCentavos,
  });

  final String servicioId;
  final String descripcion;
  final int precioCentavos;
  int cantidad = 1;
}
