import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// El detalle de una venta: qué se cobró, qué falta y cómo se pagó.
class PantallaVentaDetalle extends StatefulWidget {
  const PantallaVentaDetalle({super.key, required this.id});

  final String id;

  @override
  State<PantallaVentaDetalle> createState() => _PantallaVentaDetalleState();
}

class _PantallaVentaDetalleState extends State<PantallaVentaDetalle> {
  late Future<_Venta> _futuro;
  bool _huboCambios = false;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Venta> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/ventas/${widget.id}');
    return _Venta.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _abonar(_Venta venta) async {
    final texto = await showDialog<String>(
      context: context,
      builder: (context) => _DialogoAbono(saldoCentavos: venta.saldoCentavos),
    );
    if (texto == null || !mounted) return;

    final monto = double.tryParse(texto.replaceAll(',', '.')) ?? 0;
    if (monto <= 0) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      final datos = await Sesion.de(context).enviar(
        '/api/v1/ventas/${venta.id}/pagos',
        {'montoCentavos': (monto * 100).round(), 'metodo': 'CASH_USD'},
      );
      _huboCambios = true;
      final aplicado = datos['aplicadoCentavos'] as int;
      mensajero.showSnackBar(
        SnackBar(
          content: Text(
            datos['parcial'] == true
                ? 'Se abonaron ${dinero(aplicado)}: era lo que faltaba.'
                : 'Abono de ${dinero(aplicado)} registrado.',
          ),
        ),
      );
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  Future<void> _anular(_Venta venta) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Anular la venta?'),
        content: Text(
          'La venta #${venta.numero} quedará anulada y dejará de contar '
          'en los totales. No se borra: el historial de caja se conserva.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Marca.error),
            child: const Text('Anular'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).borrar('/api/v1/ventas/${venta.id}');
      _huboCambios = true;
      mensajero.showSnackBar(const SnackBar(content: Text('Venta anulada.')));
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _huboCambios);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Venta')),
        body: SafeArea(
          child: FutureBuilder<_Venta>(
            future: _futuro,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return ErrorConReintento(
                  mensaje: snap.error is ErrorApi
                      ? (snap.error as ErrorApi).mensaje
                      : 'No pudimos cargar la venta.',
                  alReintentar: _refrescar,
                );
              }

              final venta = snap.data!;
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(venta.clientaNombre, style: titulo(26)),
                            const SizedBox(height: 2),
                            Text(
                              'Venta #${venta.numero} · ${fechaLarga(venta.fecha)}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Marca.textoSuave,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Etiqueta.venta(venta.estado),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          for (final linea in venta.lineas)
                            FilaDato(
                              linea.cantidad > 1
                                  ? '${linea.descripcion} ×${linea.cantidad}'
                                  : linea.descripcion,
                              linea.bono != null
                                  ? 'Bono'
                                  : dinero(linea.totalCentavos),
                              color: linea.bono != null ? Marca.exito : null,
                            ),
                          const Divider(height: 20),
                          if (venta.descuentoCentavos > 0)
                            FilaDato(
                              'Descuento',
                              '−${dinero(venta.descuentoCentavos)}',
                              color: Marca.exito,
                            ),
                          FilaDato(
                            'Total',
                            dinero(venta.totalCentavos),
                            destacado: true,
                          ),
                          FilaDato('Ya pagó', dinero(venta.cobradoCentavos)),
                          if (venta.saldoCentavos > 0)
                            FilaDato(
                              'Le falta pagar',
                              dinero(venta.saldoCentavos),
                              destacado: true,
                              color: Marca.error,
                            ),
                          if (venta.tasaUsada != null && venta.tasaUsada! > 0) ...[
                            const Divider(height: 20),
                            FilaDato(
                              'En bolívares (tasa ${venta.tasaUsada!.toStringAsFixed(2)})',
                              bolivares(venta.totalCentavos, venta.tasaUsada!),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  if (venta.saldoCentavos > 0 && venta.estado != 'CANCELLED') ...[
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () => _abonar(venta),
                            icon: const Icon(Icons.payments_outlined, size: 20),
                            label: const Text('Me pagó'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => abrirWhatsApp(
                              venta.clientaTelefono,
                              Mensajes.saldo(
                                clienta: venta.clientaNombre,
                                saldoCentavos: venta.saldoCentavos,
                                negocio: negocio?.nombre ?? 'Arialé Studio',
                              ),
                              prefijo: negocio?.prefijo ?? '+58',
                            ),
                            icon: const Icon(Icons.chat_bubble_outline, size: 18),
                            label: const Text('Recordar'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Marca.exito,
                              side: BorderSide(
                                color: Marca.exito.withValues(alpha: 0.4),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (venta.pagos.isNotEmpty) ...[
                    const Seccion('Cobros'),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          children: [
                            for (final pago in venta.pagos)
                              FilaDato(
                                '${fechaCorta(pago.fecha)} · ${_metodo(pago.metodo)}',
                                dinero(pago.montoCentavos),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (venta.bonos.isNotEmpty) ...[
                    const Seccion('Bonos vendidos'),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          children: [
                            for (final bono in venta.bonos)
                              FilaDato(
                                bono.nombre,
                                '${bono.sesiones - bono.usadas} de ${bono.sesiones}',
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (venta.notas != null && venta.notas!.isNotEmpty) ...[
                    const Seccion('Nota'),
                    Text(
                      venta.notas!,
                      style: const TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: Marca.textoSuave,
                      ),
                    ),
                  ],
                  if (venta.estado != 'CANCELLED') ...[
                    const SizedBox(height: 28),
                    Center(
                      child: TextButton.icon(
                        onPressed: () => _anular(venta),
                        icon: const Icon(Icons.block, size: 18),
                        label: const Text('Anular esta venta'),
                        style: TextButton.styleFrom(foregroundColor: Marca.error),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

String _metodo(String clave) => switch (clave) {
      'CASH_USD' => 'Efectivo \$',
      'CASH_VES' => 'Efectivo Bs.',
      'PAGO_MOVIL' => 'Pago móvil',
      'TRANSFER' => 'Transferencia',
      'ZELLE' => 'Zelle',
      'BINANCE' => 'Binance',
      'CARD' => 'Tarjeta',
      _ => 'Otro',
    };

class _DialogoAbono extends StatefulWidget {
  const _DialogoAbono({required this.saldoCentavos});

  final int saldoCentavos;

  @override
  State<_DialogoAbono> createState() => _DialogoAbonoState();
}

class _DialogoAbonoState extends State<_DialogoAbono> {
  late final TextEditingController _monto = TextEditingController(
    text: (widget.saldoCentavos / 100).toStringAsFixed(2),
  );

  @override
  void dispose() {
    _monto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('¿Cuánto te pagó?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Le falta pagar ${dinero(widget.saldoCentavos)}',
            style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _monto,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Monto en dólares', prefixText: '\$ '),
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
          child: const Text('Cobrar'),
        ),
      ],
    );
  }
}

class _Linea {
  _Linea({
    required this.descripcion,
    required this.cantidad,
    required this.totalCentavos,
    this.bono,
  });

  final String descripcion;
  final int cantidad;
  final int totalCentavos;
  final String? bono;
}

class _Pago {
  _Pago({required this.fecha, required this.montoCentavos, required this.metodo});

  final DateTime fecha;
  final int montoCentavos;
  final String metodo;
}

class _BonoVendido {
  _BonoVendido({required this.nombre, required this.sesiones, required this.usadas});

  final String nombre;
  final int sesiones;
  final int usadas;
}

class _Venta {
  _Venta({
    required this.id,
    required this.numero,
    required this.fecha,
    required this.estado,
    required this.clientaNombre,
    required this.clientaTelefono,
    required this.descuentoCentavos,
    required this.totalCentavos,
    required this.cobradoCentavos,
    required this.saldoCentavos,
    required this.lineas,
    required this.pagos,
    required this.bonos,
    this.notas,
    this.tasaUsada,
  });

  final String id;
  final int numero;
  final DateTime fecha;
  final String estado;
  final String clientaNombre;
  final String clientaTelefono;
  final int descuentoCentavos;
  final int totalCentavos;
  final int cobradoCentavos;
  final int saldoCentavos;
  final List<_Linea> lineas;
  final List<_Pago> pagos;
  final List<_BonoVendido> bonos;
  final String? notas;
  final double? tasaUsada;

  factory _Venta.desdeJson(Map<String, dynamic> j) => _Venta(
        id: j['id'] as String,
        numero: j['numero'] as int,
        fecha: DateTime.parse(j['fecha'] as String).toLocal(),
        estado: j['estado'] as String,
        clientaNombre: (j['clienta'] as Map)['nombre'] as String,
        clientaTelefono: (j['clienta'] as Map)['telefono'] as String,
        descuentoCentavos: j['descuentoCentavos'] as int,
        totalCentavos: j['totalCentavos'] as int,
        cobradoCentavos: j['cobradoCentavos'] as int,
        saldoCentavos: j['saldoCentavos'] as int,
        notas: j['notas'] as String?,
        tasaUsada: (j['tasaUsada'] as num?)?.toDouble(),
        lineas: [
          for (final l in (j['lineas'] as List))
            _Linea(
              descripcion: (l as Map)['descripcion'] as String,
              cantidad: l['cantidad'] as int,
              totalCentavos: l['totalCentavos'] as int,
              bono: l['bono'] as String?,
            ),
        ],
        pagos: [
          for (final p in (j['pagos'] as List))
            _Pago(
              fecha: DateTime.parse((p as Map)['fecha'] as String).toLocal(),
              montoCentavos: p['montoCentavos'] as int,
              metodo: p['metodo'] as String,
            ),
        ],
        bonos: [
          for (final b in (j['bonosVendidos'] as List))
            _BonoVendido(
              nombre: (b as Map)['nombre'] as String,
              sesiones: b['sesiones'] as int,
              usadas: b['usadas'] as int,
            ),
        ],
      );
}
