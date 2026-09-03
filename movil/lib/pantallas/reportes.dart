import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import '../widgets/periodo.dart';

/// Cómo va el negocio: lo que entra, lo que sale y lo que queda.
class PantallaReportes extends StatefulWidget {
  const PantallaReportes({super.key});

  @override
  State<PantallaReportes> createState() => _PantallaReportesState();
}

class _PantallaReportesState extends State<PantallaReportes> {
  String _periodo = 'last30';
  late Future<_Reportes> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Reportes> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/reportes',
      params: {'periodo': _periodo},
    );
    return _Reportes.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reportes')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 4),
              child: SelectorPeriodo(
                activo: _periodo,
                alElegir: (p) {
                  setState(() => _periodo = p);
                  _refrescar();
                },
              ),
            ),
            Expanded(
              child: FutureBuilder<_Reportes>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar los reportes.',
                      alReintentar: _refrescar,
                    );
                  }

                  final r = snap.data!;
                  return RefreshIndicator(
                    onRefresh: _refrescar,
                    color: Marca.dorado,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _Kpi(
                                rotulo: 'Ventas',
                                valor: dinero(r.ventasCentavos),
                                variacion: r.variacionVentas,
                                apoyo: '${r.ventas} ventas',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _Kpi(
                                rotulo: 'Ganancia',
                                valor: dinero(r.gananciaCentavos),
                                variacion: r.variacionGanancia,
                                apoyo: 'te queda el ${r.margenPct.toStringAsFixed(0)}%',
                                color: r.gananciaCentavos >= 0 ? Marca.exito : Marca.error,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _Kpi(
                                rotulo: 'Te pagaron',
                                valor: dinero(r.cobradoCentavos),
                                variacion: r.variacionCobrado,
                                apoyo: '${r.cobranzaPct.toStringAsFixed(0)}% de lo vendido',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _Kpi(
                                rotulo: 'Gastos',
                                valor: dinero(r.costosCentavos),
                                variacion: r.variacionCostos,
                                apoyo: 'con las compras incluidas',
                                invertirColor: true,
                              ),
                            ),
                          ],
                        ),
                        const Seccion('Cuentas pendientes'),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
                            child: Column(
                              children: [
                                FilaDato(
                                  'Te deben',
                                  dinero(r.porCobrarCentavos),
                                  destacado: true,
                                  color: r.porCobrarCentavos > 0 ? Marca.alerta : null,
                                ),
                                FilaDato('Le debes a proveedores', dinero(r.porPagarCentavos)),
                                FilaDato(
                                  'Promedio por visita',
                                  dinero(r.ticketCentavos),
                                ),
                                FilaDato('Clientas que vinieron', '${r.clientasAtendidas}'),
                              ],
                            ),
                          ),
                        ),
                        if (r.categorias.isNotEmpty) ...[
                          const Seccion(
                            'De dónde viene el dinero',
                            apoyo: 'Ventas por categoría',
                          ),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                              child: Column(
                                children: [
                                  for (final c in r.categorias)
                                    BarraProporcion(
                                      rotulo: c.nombre,
                                      valor: c.totalCentavos,
                                      maximo: r.categorias.first.totalCentavos,
                                      color: Marca.desdeHex(c.color),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (r.servicios.isNotEmpty) ...[
                          const Seccion('Servicios más vendidos'),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                              child: Column(
                                children: [
                                  for (final s in r.servicios.take(8))
                                    BarraProporcion(
                                      rotulo: s.nombre,
                                      valor: s.totalCentavos,
                                      maximo: r.servicios.first.totalCentavos,
                                      color: Marca.desdeHex(s.color),
                                      apoyo: '${s.cantidad} '
                                          '${s.cantidad == 1 ? 'vez' : 'veces'}',
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (r.especialistas.isNotEmpty) ...[
                          const Seccion('Por especialista'),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                              child: Column(
                                children: [
                                  for (final e in r.especialistas)
                                    BarraProporcion(
                                      rotulo: e.nombre,
                                      valor: e.totalCentavos,
                                      maximo: r.especialistas.first.totalCentavos,
                                      color: Marca.desdeHex(e.color),
                                      apoyo: '${e.ventas} ventas',
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (r.clientas.isNotEmpty) ...[
                          const Seccion('Tus mejores clientas'),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              child: Column(
                                children: [
                                  for (final c in r.clientas.take(10))
                                    FilaDato(
                                      '${c.nombre}  ·  ${c.ventas} '
                                      '${c.ventas == 1 ? 'visita' : 'visitas'}',
                                      dinero(c.totalCentavos),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (r.meses.isNotEmpty) ...[
                          const Seccion('Últimos meses'),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              child: _Tendencia(meses: r.meses),
                            ),
                          ),
                        ],
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

class _Kpi extends StatelessWidget {
  const _Kpi({
    required this.rotulo,
    required this.valor,
    required this.variacion,
    required this.apoyo,
    this.color,
    this.invertirColor = false,
  });

  final String rotulo;
  final String valor;
  final double variacion;
  final String apoyo;
  final Color? color;

  /// En los costos, subir es malo: el verde y el rojo cambian de bando.
  final bool invertirColor;

  /// El servidor manda 0 cuando el periodo anterior no da para comparar.
  bool get _comparable => variacion != 0;

  @override
  Widget build(BuildContext context) {
    final sube = variacion > 0;
    final bueno = invertirColor ? !sube : sube;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              rotulo,
              style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
            ),
            const SizedBox(height: 3),
            Text(valor, style: cifra(19, color: color)),
            const SizedBox(height: 3),
            if (_comparable)
              Row(
                children: [
                  Icon(
                    sube ? Ico.subida : Ico.bajada,
                    size: 14,
                    color: bueno ? Marca.exito : Marca.error,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    '${variacion.abs().toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: bueno ? Marca.exito : Marca.error,
                    ),
                  ),
                ],
              ),
            Text(
              apoyo,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barras mensuales de ventas y costos, dibujadas con cajas: no hace falta
/// una librería de gráficos para ver si el mes va mejor o peor.
class _Tendencia extends StatelessWidget {
  const _Tendencia({required this.meses});

  final List<_Mes> meses;

  @override
  Widget build(BuildContext context) {
    final tope = meses
        .map((m) => m.ventasCentavos > m.costosCentavos ? m.ventasCentavos : m.costosCentavos)
        .fold(1, (a, b) => a > b ? a : b);

    return Column(
      children: [
        SizedBox(
          height: 130,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final mes in meses)
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        dineroCorto(mes.ventasCentavos),
                        style: const TextStyle(fontSize: 9.5, color: Marca.textoSuave),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          _Barra(
                            altura: 84 * mes.ventasCentavos / tope,
                            color: Marca.dorado,
                          ),
                          const SizedBox(width: 3),
                          _Barra(
                            altura: 84 * mes.costosCentavos / tope,
                            color: Marca.textoSuave.withValues(alpha: 0.35),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        mes.etiqueta.replaceAll('.', ''),
                        style: const TextStyle(fontSize: 10, color: Marca.textoSuave),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _Leyenda(color: Marca.dorado, texto: 'Ventas'),
            const SizedBox(width: 16),
            _Leyenda(
              color: Marca.textoSuave.withValues(alpha: 0.35),
              texto: 'Costos',
            ),
          ],
        ),
      ],
    );
  }
}

class _Barra extends StatelessWidget {
  const _Barra({required this.altura, required this.color});

  final double altura;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 9,
      height: altura.isFinite ? altura.clamp(2.0, 84.0) : 2,
      decoration: BoxDecoration(
        color: color,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
      ),
    );
  }
}

class _Leyenda extends StatelessWidget {
  const _Leyenda({required this.color, required this.texto});

  final Color color;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: 5),
        Text(texto, style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
      ],
    );
  }
}

class _Barrita {
  _Barrita({required this.nombre, required this.color, required this.totalCentavos});

  final String nombre;
  final String color;
  final int totalCentavos;
}

class _ServicioVendido extends _Barrita {
  _ServicioVendido({
    required super.nombre,
    required super.color,
    required super.totalCentavos,
    required this.cantidad,
  });

  final int cantidad;
}

class _EspecialistaVenta extends _Barrita {
  _EspecialistaVenta({
    required super.nombre,
    required super.color,
    required super.totalCentavos,
    required this.ventas,
  });

  final int ventas;
}

class _ClientaVenta {
  _ClientaVenta({
    required this.nombre,
    required this.ventas,
    required this.totalCentavos,
  });

  final String nombre;
  final int ventas;
  final int totalCentavos;
}

class _Mes {
  _Mes({
    required this.etiqueta,
    required this.ventasCentavos,
    required this.costosCentavos,
  });

  final String etiqueta;
  final int ventasCentavos;
  final int costosCentavos;
}

class _Reportes {
  _Reportes({
    required this.ventasCentavos,
    required this.ventas,
    required this.clientasAtendidas,
    required this.cobradoCentavos,
    required this.costosCentavos,
    required this.gananciaCentavos,
    required this.margenPct,
    required this.cobranzaPct,
    required this.ticketCentavos,
    required this.variacionVentas,
    required this.variacionGanancia,
    required this.variacionCobrado,
    required this.variacionCostos,
    required this.porCobrarCentavos,
    required this.porPagarCentavos,
    required this.categorias,
    required this.servicios,
    required this.especialistas,
    required this.clientas,
    required this.meses,
  });

  final int ventasCentavos;
  final int ventas;
  final int clientasAtendidas;
  final int cobradoCentavos;
  final int costosCentavos;
  final int gananciaCentavos;
  final double margenPct;
  final double cobranzaPct;
  final int ticketCentavos;
  final double variacionVentas;
  final double variacionGanancia;
  final double variacionCobrado;
  final double variacionCostos;
  final int porCobrarCentavos;
  final int porPagarCentavos;
  final List<_Barrita> categorias;
  final List<_ServicioVendido> servicios;
  final List<_EspecialistaVenta> especialistas;
  final List<_ClientaVenta> clientas;
  final List<_Mes> meses;

  factory _Reportes.desdeJson(Map<String, dynamic> j) {
    final k = j['kpis'] as Map<String, dynamic>;
    final v = j['variacion'] as Map<String, dynamic>;
    final c = j['cartera'] as Map<String, dynamic>;
    double num_(Object? valor) => (valor as num?)?.toDouble() ?? 0;

    return _Reportes(
      ventasCentavos: k['ventasCentavos'] as int,
      ventas: k['ventas'] as int,
      clientasAtendidas: k['clientasAtendidas'] as int,
      cobradoCentavos: k['cobradoCentavos'] as int,
      costosCentavos: k['costosCentavos'] as int,
      gananciaCentavos: k['gananciaCentavos'] as int,
      margenPct: num_(k['margenPct']),
      cobranzaPct: num_(k['cobranzaPct']),
      ticketCentavos: k['ticketCentavos'] as int,
      variacionVentas: num_(v['ventas']),
      variacionGanancia: num_(v['ganancia']),
      variacionCobrado: num_(v['cobrado']),
      variacionCostos: num_(v['costos']),
      porCobrarCentavos: c['porCobrarCentavos'] as int,
      porPagarCentavos: c['porPagarCentavos'] as int,
      categorias: [
        for (final x in (j['categorias'] as List))
          _Barrita(
            nombre: (x as Map)['nombre'] as String,
            color: x['color'] as String,
            totalCentavos: x['totalCentavos'] as int,
          ),
      ],
      servicios: [
        for (final x in (j['porServicio'] as List))
          _ServicioVendido(
            nombre: (x as Map)['nombre'] as String,
            color: x['color'] as String,
            totalCentavos: x['totalCentavos'] as int,
            cantidad: x['cantidad'] as int,
          ),
      ],
      especialistas: [
        for (final x in (j['porEspecialista'] as List))
          _EspecialistaVenta(
            nombre: (x as Map)['nombre'] as String,
            color: x['color'] as String,
            totalCentavos: x['totalCentavos'] as int,
            ventas: x['ventas'] as int,
          ),
      ],
      clientas: [
        for (final x in (j['porClienta'] as List))
          _ClientaVenta(
            nombre: (x as Map)['nombre'] as String,
            ventas: x['ventas'] as int,
            totalCentavos: x['totalCentavos'] as int,
          ),
      ],
      meses: [
        for (final x in (j['meses'] as List))
          _Mes(
            etiqueta: (x as Map)['etiqueta'] as String,
            ventasCentavos: x['ventasCentavos'] as int,
            costosCentavos: x['costosCentavos'] as int,
          ),
      ],
    );
  }
}
