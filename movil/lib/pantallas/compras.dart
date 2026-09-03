import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import '../widgets/periodo.dart';

/// Compras del estudio y lo que se le debe a los proveedores.
/// Dos vistas en una: lo que falta por pagar y lo comprado en el periodo.
class PantallaCompras extends StatefulWidget {
  const PantallaCompras({super.key});

  @override
  State<PantallaCompras> createState() => _PantallaComprasState();
}

class _PantallaComprasState extends State<PantallaCompras> {
  bool _porPagar = true;
  String _periodo = 'month';
  late Future<_DatosCompras> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosCompras> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/compras',
      params: _porPagar ? {'vista': 'pagar'} : {'periodo': _periodo},
    );
    return _DatosCompras.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _nuevaCompra() async {
    final guardada = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => const _HojaCompra(),
    );
    if (guardada == true) _refrescar();
  }

  Future<void> _pagar(_Compra compra) async {
    final texto = await showDialog<String>(
      context: context,
      builder: (context) => _DialogoPago(compra: compra),
    );
    if (texto == null || !mounted) return;

    final monto = double.tryParse(texto.replaceAll(',', '.')) ?? 0;
    if (monto <= 0) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      final datos = await Sesion.de(context).enviar(
        '/api/v1/compras/${compra.id}/pagos',
        {'montoCentavos': (monto * 100).round(), 'metodo': 'CASH_USD'},
      );
      final aplicado = datos['aplicadoCentavos'] as int;
      mensajero.showSnackBar(
        SnackBar(
          content: Text(
            datos['parcial'] == true
                ? 'Se pagaron ${dinero(aplicado)}: era lo que faltaba.'
                : 'Pago de ${dinero(aplicado)} registrado.',
          ),
        ),
      );
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compras')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _nuevaCompra,
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Ico.agregar),
        label: const Text('Nueva compra'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              child: SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: true, label: Text('Por pagar')),
                  ButtonSegment(value: false, label: Text('Historial')),
                ],
                selected: {_porPagar},
                onSelectionChanged: (v) {
                  setState(() => _porPagar = v.first);
                  _refrescar();
                },
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: Marca.dorado,
                  selectedForegroundColor: Marca.negro,
                ),
              ),
            ),
            if (!_porPagar)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 2),
                child: SelectorPeriodo(
                  activo: _periodo,
                  alElegir: (p) {
                    setState(() => _periodo = p);
                    _refrescar();
                  },
                ),
              ),
            Expanded(
              child: FutureBuilder<_DatosCompras>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar las compras.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  return RefreshIndicator(
                    onRefresh: _refrescar,
                    color: Marca.dorado,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 96),
                      children: [
                        Cabecera(
                          etiqueta: _porPagar ? 'Debes' : 'Comprado',
                          valor: dinero(
                            _porPagar ? datos.saldoCentavos : datos.totalCentavos,
                          ),
                          apoyo: _porPagar
                              ? '${datos.cuenta} '
                                  '${datos.cuenta == 1 ? 'compra sin pagar' : 'compras sin pagar'}'
                                  '${datos.vencidas > 0 ? ' · ${datos.vencidas} vencidas' : ''}'
                              : '${datos.cuenta} compras · ya pagaste '
                                  '${dinero(datos.pagadoCentavos)}',
                          colorValor: _porPagar && datos.saldoCentavos > 0
                              ? Marca.error
                              : null,
                        ),
                        const SizedBox(height: 14),
                        if (datos.compras.isEmpty)
                          Vacio(
                            icono: _porPagar
                                ? Ico.bien
                                : Ico.compras,
                            titulo: _porPagar
                                ? 'No le debes nada a nadie'
                                : 'Sin compras en este periodo',
                            descripcion: _porPagar
                                ? 'Todas las compras están pagadas.'
                                : 'Anota el material que compres para el estudio.',
                          )
                        else
                          ...datos.compras.map(
                            (c) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _TarjetaCompra(
                                compra: c,
                                alPagar: c.saldoCentavos > 0 ? () => _pagar(c) : null,
                              ),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TarjetaCompra extends StatelessWidget {
  const _TarjetaCompra({required this.compra, this.alPagar});

  final _Compra compra;
  final VoidCallback? alPagar;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Marca.tarjeta,
        borderRadius: BorderRadius.circular(18),
        border: compra.vencida
            ? Border.all(color: Marca.error.withValues(alpha: 0.35))
            : null,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      compra.descripcion,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    Text(
                      compra.proveedor ?? 'Sin proveedor',
                      style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(dinero(compra.totalCentavos), style: cifra(16)),
                  if (compra.saldoCentavos > 0)
                    Text(
                      'te falta ${dinero(compra.saldoCentavos)}',
                      style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Etiqueta.venta(compra.estado),
              const SizedBox(width: 8),
              Text(
                compra.vence == null
                    ? '#${compra.numero} · ${fechaCorta(compra.fecha)}'
                    : compra.vencida
                        ? 'Venció el ${fechaCorta(compra.vence!)}'
                        : 'Vence ${diaRelativo(compra.vence!)}',
                style: TextStyle(
                  fontSize: 12,
                  color: compra.vencida ? Marca.error : Marca.textoSuave,
                  fontWeight: compra.vencida ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ],
          ),
          if (alPagar != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: alPagar,
                icon: const Icon(Ico.cobrar, size: 19),
                label: const Text('Pagar'),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DialogoPago extends StatefulWidget {
  const _DialogoPago({required this.compra});

  final _Compra compra;

  @override
  State<_DialogoPago> createState() => _DialogoPagoState();
}

class _DialogoPagoState extends State<_DialogoPago> {
  late final TextEditingController _monto = TextEditingController(
    text: (widget.compra.saldoCentavos / 100).toStringAsFixed(2),
  );

  @override
  void dispose() {
    _monto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('¿Cuánto vas a pagar?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${widget.compra.descripcion}\n'
            'Te falta ${dinero(widget.compra.saldoCentavos)}',
            style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _monto,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Monto', prefixText: '\$ '),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _monto.text),
          child: const Text('Pagar'),
        ),
      ],
    );
  }
}

/// Alta de una compra, con lo que se pagó de entrada y cuándo vence el resto.
class _HojaCompra extends StatefulWidget {
  const _HojaCompra();

  @override
  State<_HojaCompra> createState() => _HojaCompraState();
}

class _HojaCompraState extends State<_HojaCompra> {
  final _descripcion = TextEditingController();
  final _total = TextEditingController();
  final _pagado = TextEditingController();
  List<_Proveedor> _proveedores = [];
  String? _proveedorId;
  DateTime? _vence;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _cargarProveedores();
  }

  @override
  void dispose() {
    _descripcion.dispose();
    _total.dispose();
    _pagado.dispose();
    super.dispose();
  }

  Future<void> _cargarProveedores() async {
    try {
      final datos = await Sesion.de(context).obtener('/api/v1/proveedores');
      if (!mounted) return;
      setState(() {
        _proveedores = [
          for (final p in (datos['proveedores'] as List))
            _Proveedor(
              id: (p as Map)['id'] as String,
              nombre: p['nombre'] as String,
            ),
        ];
      });
    } on ErrorApi {
      // Sin proveedores igual se puede anotar la compra.
    }
  }

  Future<void> _guardar() async {
    final total = double.tryParse(_total.text.replaceAll(',', '.')) ?? 0;
    final pagado = double.tryParse(_pagado.text.replaceAll(',', '.')) ?? 0;

    if (_descripcion.text.trim().isEmpty) {
      _avisar('Describe la compra.');
      return;
    }
    if (total <= 0) {
      _avisar('El monto debe ser mayor que cero.');
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      await Sesion.de(context).enviar('/api/v1/compras', {
        'descripcion': _descripcion.text.trim(),
        'totalCentavos': (total * 100).round(),
        'pagadoCentavos': (pagado * 100).round(),
        if (_proveedorId != null) 'proveedorId': _proveedorId,
        if (_vence != null) 'vence': claveDia(_vence!),
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Compra registrada.')));
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
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Nueva compra', style: titulo(24)),
            const SizedBox(height: 16),
            TextField(
              controller: _descripcion,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Qué compraste'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _total,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Total',
                      prefixText: '\$ ',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _pagado,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Pagaste',
                      prefixText: '\$ ',
                    ),
                  ),
                ),
              ],
            ),
            if (_proveedores.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final p in _proveedores)
                    ChoiceChip(
                      label: Text(p.nombre),
                      selected: _proveedorId == p.id,
                      showCheckmark: false,
                      onSelected: (v) => setState(() => _proveedorId = v ? p.id : null),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: () async {
                final hoy = DateTime.now();
                final elegida = await showDatePicker(
                  context: context,
                  initialDate: _vence ?? hoy.add(const Duration(days: 15)),
                  firstDate: hoy.subtract(const Duration(days: 365)),
                  lastDate: hoy.add(const Duration(days: 365)),
                  locale: const Locale('es'),
                );
                if (elegida != null) setState(() => _vence = elegida);
              },
              icon: const Icon(Ico.agenda, size: 18),
              label: Text(
                _vence == null
                    ? 'Fecha de vencimiento (opcional)'
                    : 'Vence el ${fechaCorta(_vence!)}',
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _guardando ? null : _guardar,
              child: _guardando
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Guardar compra'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Proveedor {
  _Proveedor({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

class _Compra {
  _Compra({
    required this.id,
    required this.numero,
    required this.fecha,
    required this.descripcion,
    required this.totalCentavos,
    required this.pagadoCentavos,
    required this.saldoCentavos,
    required this.estado,
    required this.vencida,
    this.vence,
    this.proveedor,
  });

  final String id;
  final int numero;
  final DateTime fecha;
  final String descripcion;
  final int totalCentavos;
  final int pagadoCentavos;
  final int saldoCentavos;
  final String estado;
  final bool vencida;
  final DateTime? vence;
  final String? proveedor;

  factory _Compra.desdeJson(Map<String, dynamic> j) => _Compra(
        id: j['id'] as String,
        numero: j['numero'] as int,
        fecha: DateTime.parse(j['fecha'] as String).toLocal(),
        descripcion: j['descripcion'] as String,
        totalCentavos: j['totalCentavos'] as int,
        pagadoCentavos: j['pagadoCentavos'] as int,
        saldoCentavos: j['saldoCentavos'] as int,
        estado: j['estado'] as String,
        vencida: j['vencida'] as bool? ?? false,
        vence: j['vence'] == null
            ? null
            : DateTime.parse(j['vence'] as String).toLocal(),
        proveedor: (j['proveedor'] as Map?)?['nombre'] as String?,
      );
}

class _DatosCompras {
  _DatosCompras({
    required this.cuenta,
    required this.totalCentavos,
    required this.pagadoCentavos,
    required this.saldoCentavos,
    required this.vencidas,
    required this.compras,
  });

  final int cuenta;
  final int totalCentavos;
  final int pagadoCentavos;
  final int saldoCentavos;
  final int vencidas;
  final List<_Compra> compras;

  factory _DatosCompras.desdeJson(Map<String, dynamic> j) {
    final totales = j['totales'] as Map<String, dynamic>;
    return _DatosCompras(
      cuenta: totales['cuenta'] as int,
      totalCentavos: totales['totalCentavos'] as int,
      pagadoCentavos: totales['pagadoCentavos'] as int,
      saldoCentavos: totales['saldoCentavos'] as int,
      vencidas: totales['vencidas'] as int? ?? 0,
      compras: [
        for (final c in (j['compras'] as List))
          _Compra.desdeJson(c as Map<String, dynamic>),
      ],
    );
  }
}
