import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import '../widgets/periodo.dart';
import 'nueva_venta.dart';
import 'venta_detalle.dart';

/// Las ventas del periodo: cuánto se facturó, cuánto entró y qué falta.
class PantallaVentas extends StatefulWidget {
  const PantallaVentas({super.key});

  @override
  State<PantallaVentas> createState() => _PantallaVentasState();
}

class _PantallaVentasState extends State<PantallaVentas> {
  // Al día 1 o 2 del mes, "este mes" saldría vacío: mejor 30 días.
  String _periodo = 'last30';
  String? _estado;
  late Future<_DatosVentas> _futuro;

  static const _estados = <(String?, String)>[
    (null, 'Todas'),
    ('PENDING', 'Sin pagar'),
    ('PARTIAL', 'A medias'),
    ('PAID', 'Pagadas'),
  ];

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosVentas> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/ventas',
      params: {'periodo': _periodo, if (_estado != null) 'estado': _estado!},
    );
    return _DatosVentas.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _nuevaVenta() async {
    final creada = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PantallaNuevaVenta()),
    );
    if (creada == true) _refrescar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ventas')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _nuevaVenta,
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Ico.agregar),
        label: const Text('Nueva venta'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
              child: SelectorPeriodo(
                activo: _periodo,
                alElegir: (p) {
                  setState(() => _periodo = p);
                  _refrescar();
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _estados.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final (clave, rotulo) = _estados[i];
                    return ChoiceChip(
                      label: Text(rotulo),
                      selected: _estado == clave,
                      showCheckmark: false,
                      onSelected: (_) {
                        setState(() => _estado = clave);
                        _refrescar();
                      },
                    );
                  },
                ),
              ),
            ),
            Expanded(
              child: FutureBuilder<_DatosVentas>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar las ventas.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  return RefreshIndicator(
                    onRefresh: _refrescar,
                    color: Marca.dorado,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 104),
                      children: [
                        Cabecera(
                          etiqueta: 'Vendido · ${datos.etiquetaPeriodo}',
                          valor: dinero(datos.totalCentavos),
                          apoyo: '${datos.cuenta} '
                              '${datos.cuenta == 1 ? 'venta' : 'ventas'} · '
                              'te pagaron ${dinero(datos.cobradoCentavos)}',
                          accion: datos.pendienteCentavos > 0
                              ? Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    const Text(
                                      'Te deben',
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        color: Marca.textoSuave,
                                      ),
                                    ),
                                    Text(
                                      dinero(datos.pendienteCentavos),
                                      style: cifra(17, color: Marca.alerta),
                                    ),
                                  ],
                                )
                              : null,
                        ),
                        const SizedBox(height: 14),
                        if (datos.ventas.isEmpty)
                          const Vacio(
                            icono: Ico.ventas,
                            titulo: 'Sin ventas en este periodo',
                            descripcion:
                                'Cuando cobres una cita aparecerá aquí, con su saldo.',
                          )
                        else
                          ...datos.ventas.map(
                            (v) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _TarjetaVenta(
                                venta: v,
                                alTocar: () async {
                                  final cambio =
                                      await Navigator.of(context).push<bool>(
                                    MaterialPageRoute(
                                      builder: (_) => PantallaVentaDetalle(id: v.id),
                                    ),
                                  );
                                  if (cambio == true) _refrescar();
                                },
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

class _TarjetaVenta extends StatelessWidget {
  const _TarjetaVenta({required this.venta, required this.alTocar});

  final VentaResumen venta;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      venta.clientaNombre,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(dinero(venta.totalCentavos), style: cifra(16)),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                venta.concepto.isEmpty ? 'Sin detalle' : venta.concepto,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Etiqueta.venta(venta.estado),
                  const SizedBox(width: 8),
                  Text(
                    '#${venta.numero} · ${fechaCorta(venta.fecha)}',
                    style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
                  ),
                  const Spacer(),
                  if (venta.saldoCentavos > 0 && venta.estado != 'CANCELLED')
                    Text(
                      'Falta ${dinero(venta.saldoCentavos)}',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Marca.error,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Una venta tal como sale en la lista.
class VentaResumen {
  VentaResumen({
    required this.id,
    required this.numero,
    required this.fecha,
    required this.clientaNombre,
    required this.clientaTelefono,
    required this.concepto,
    required this.totalCentavos,
    required this.cobradoCentavos,
    required this.saldoCentavos,
    required this.estado,
  });

  final String id;
  final int numero;
  final DateTime fecha;
  final String clientaNombre;
  final String clientaTelefono;
  final String concepto;
  final int totalCentavos;
  final int cobradoCentavos;
  final int saldoCentavos;
  final String estado;

  factory VentaResumen.desdeJson(Map<String, dynamic> j) => VentaResumen(
        id: j['id'] as String,
        numero: j['numero'] as int,
        fecha: DateTime.parse(j['fecha'] as String).toLocal(),
        clientaNombre: (j['clienta'] as Map)['nombre'] as String,
        clientaTelefono: (j['clienta'] as Map)['telefono'] as String,
        concepto: j['concepto'] as String? ?? '',
        totalCentavos: j['totalCentavos'] as int,
        cobradoCentavos: j['cobradoCentavos'] as int,
        saldoCentavos: j['saldoCentavos'] as int,
        estado: j['estado'] as String,
      );
}

class _DatosVentas {
  _DatosVentas({
    required this.etiquetaPeriodo,
    required this.cuenta,
    required this.totalCentavos,
    required this.cobradoCentavos,
    required this.pendienteCentavos,
    required this.ventas,
  });

  final String etiquetaPeriodo;
  final int cuenta;
  final int totalCentavos;
  final int cobradoCentavos;
  final int pendienteCentavos;
  final List<VentaResumen> ventas;

  factory _DatosVentas.desdeJson(Map<String, dynamic> j) {
    final totales = j['totales'] as Map<String, dynamic>;
    return _DatosVentas(
      etiquetaPeriodo: (j['periodo'] as Map)['etiqueta'] as String,
      cuenta: totales['cuenta'] as int,
      totalCentavos: totales['totalCentavos'] as int,
      cobradoCentavos: totales['cobradoCentavos'] as int,
      pendienteCentavos: totales['pendienteCentavos'] as int,
      ventas: [
        for (final v in (j['ventas'] as List))
          VentaResumen.desdeJson(v as Map<String, dynamic>),
      ],
    );
  }
}
