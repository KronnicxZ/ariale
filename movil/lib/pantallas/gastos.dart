import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import '../widgets/periodo.dart';

/// Gastos del estudio: en qué se va el dinero y cuánto pesa cada cosa.
class PantallaGastos extends StatefulWidget {
  const PantallaGastos({super.key});

  @override
  State<PantallaGastos> createState() => _PantallaGastosState();
}

class _PantallaGastosState extends State<PantallaGastos> {
  // Al día 1 o 2 del mes, "este mes" saldría vacío: mejor 30 días.
  String _periodo = 'last30';
  late Future<_DatosGastos> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosGastos> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/gastos',
      params: {'periodo': _periodo},
    );
    return _DatosGastos.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _nuevoGasto(List<_Categoria> categorias) async {
    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaGasto(categorias: categorias),
    );
    if (guardado == true) _refrescar();
  }

  Future<void> _borrar(_Gasto gasto) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Borrar el gasto?'),
        content: Text('"${gasto.descripcion}" por ${dinero(gasto.montoCentavos)}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Marca.error),
            child: const Text('Borrar'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).borrar('/api/v1/gastos/${gasto.id}');
      mensajero.showSnackBar(const SnackBar(content: Text('Gasto borrado.')));
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gastos')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: SelectorPeriodo(
                activo: _periodo,
                alElegir: (p) {
                  setState(() => _periodo = p);
                  _refrescar();
                },
              ),
            ),
            Expanded(
              child: FutureBuilder<_DatosGastos>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar los gastos.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  final mayor = datos.porCategoria.isEmpty
                      ? 0
                      : datos.porCategoria.first.totalCentavos;

                  return RefreshIndicator(
                    onRefresh: _refrescar,
                    color: Marca.dorado,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 96),
                      children: [
                        Cabecera(
                          etiqueta: 'Gastado · ${datos.etiquetaPeriodo}',
                          valor: dinero(datos.totalCentavos),
                          apoyo: '${datos.cuenta} '
                              '${datos.cuenta == 1 ? 'gasto' : 'gastos'}',
                        ),
                        if (datos.porCategoria.isNotEmpty) ...[
                          const Seccion('Por categoría'),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                              child: Column(
                                children: [
                                  for (final c in datos.porCategoria)
                                    BarraProporcion(
                                      rotulo: c.nombre,
                                      valor: c.totalCentavos,
                                      maximo: mayor,
                                      color: Marca.desdeHex(c.color),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        const Seccion('Movimientos'),
                        if (datos.gastos.isEmpty)
                          const Vacio(
                            icono: Ico.ventas,
                            titulo: 'Sin gastos en este periodo',
                            descripcion:
                                'Anota el alquiler, el material y los servicios '
                                'para saber cuánto queda de verdad.',
                          )
                        else
                          ...datos.gastos.map(
                            (g) => Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: Container(
                                  width: 8,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: Marca.desdeHex(
                                      g.categoriaColor,
                                      alterno: Marca.textoSuave,
                                    ),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                ),
                                title: Text(
                                  g.descripcion,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14.5,
                                  ),
                                ),
                                subtitle: Text(
                                  '${fechaCorta(g.fecha)}'
                                  '${g.categoriaNombre == null ? '' : ' · ${g.categoriaNombre}'}',
                                  style: const TextStyle(fontSize: 12.5),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(dinero(g.montoCentavos), style: cifra(15)),
                                    IconButton(
                                      tooltip: 'Borrar',
                                      onPressed: () => _borrar(g),
                                      icon: const Icon(Ico.borrar, size: 19),
                                      color: Marca.textoSuave,
                                    ),
                                  ],
                                ),
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
      floatingActionButton: FutureBuilder<_DatosGastos>(
        future: _futuro,
        builder: (context, snap) => FloatingActionButton.extended(
          onPressed: snap.hasData
              ? () => _nuevoGasto(snap.data!.categorias)
              : null,
          backgroundColor: Marca.dorado,
          foregroundColor: Marca.negro,
          icon: const Icon(Ico.agregar),
          label: const Text('Anotar gasto'),
        ),
      ),
    );
  }
}

/// Alta rápida de un gasto: descripción, monto y categoría.
class _HojaGasto extends StatefulWidget {
  const _HojaGasto({required this.categorias});

  final List<_Categoria> categorias;

  @override
  State<_HojaGasto> createState() => _HojaGastoState();
}

class _HojaGastoState extends State<_HojaGasto> {
  final _descripcion = TextEditingController();
  final _monto = TextEditingController();
  String? _categoriaId;
  bool _guardando = false;

  @override
  void dispose() {
    _descripcion.dispose();
    _monto.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final monto = double.tryParse(_monto.text.replaceAll(',', '.')) ?? 0;
    if (_descripcion.text.trim().isEmpty) {
      _avisar('Describe el gasto.');
      return;
    }
    if (monto <= 0) {
      _avisar('El monto debe ser mayor que cero.');
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      await Sesion.de(context).enviar('/api/v1/gastos', {
        'descripcion': _descripcion.text.trim(),
        'montoCentavos': (monto * 100).round(),
        if (_categoriaId != null) 'categoriaId': _categoriaId,
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Gasto anotado.')));
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Anotar gasto', style: titulo(24)),
          const SizedBox(height: 16),
          TextField(
            controller: _descripcion,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'En qué se gastó'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _monto,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Monto', prefixText: '\$ '),
          ),
          if (widget.categorias.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in widget.categorias)
                  ChoiceChip(
                    label: Text(c.nombre),
                    selected: _categoriaId == c.id,
                    showCheckmark: false,
                    avatar: CircleAvatar(
                      radius: 6,
                      backgroundColor: Marca.desdeHex(c.color),
                    ),
                    onSelected: (v) => setState(() => _categoriaId = v ? c.id : null),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Guardar gasto'),
          ),
        ],
      ),
    );
  }
}

class _Categoria {
  _Categoria({required this.id, required this.nombre, required this.color});

  final String id;
  final String nombre;
  final String color;
}

class _ResumenCategoria {
  _ResumenCategoria({
    required this.nombre,
    required this.color,
    required this.totalCentavos,
  });

  final String nombre;
  final String color;
  final int totalCentavos;
}

class _Gasto {
  _Gasto({
    required this.id,
    required this.fecha,
    required this.descripcion,
    required this.montoCentavos,
    this.categoriaNombre,
    this.categoriaColor,
  });

  final String id;
  final DateTime fecha;
  final String descripcion;
  final int montoCentavos;
  final String? categoriaNombre;
  final String? categoriaColor;
}

class _DatosGastos {
  _DatosGastos({
    required this.etiquetaPeriodo,
    required this.cuenta,
    required this.totalCentavos,
    required this.porCategoria,
    required this.categorias,
    required this.gastos,
  });

  final String etiquetaPeriodo;
  final int cuenta;
  final int totalCentavos;
  final List<_ResumenCategoria> porCategoria;
  final List<_Categoria> categorias;
  final List<_Gasto> gastos;

  factory _DatosGastos.desdeJson(Map<String, dynamic> j) {
    final totales = j['totales'] as Map<String, dynamic>;
    return _DatosGastos(
      etiquetaPeriodo: (j['periodo'] as Map)['etiqueta'] as String,
      cuenta: totales['cuenta'] as int,
      totalCentavos: totales['totalCentavos'] as int,
      porCategoria: [
        for (final c in (j['porCategoria'] as List))
          _ResumenCategoria(
            nombre: (c as Map)['nombre'] as String,
            color: c['color'] as String,
            totalCentavos: c['totalCentavos'] as int,
          ),
      ],
      categorias: [
        for (final c in (j['categorias'] as List))
          _Categoria(
            id: (c as Map)['id'] as String,
            nombre: c['nombre'] as String,
            color: c['color'] as String,
          ),
      ],
      gastos: [
        for (final g in (j['gastos'] as List))
          _Gasto(
            id: (g as Map)['id'] as String,
            fecha: DateTime.parse(g['fecha'] as String).toLocal(),
            descripcion: g['descripcion'] as String,
            montoCentavos: g['montoCentavos'] as int,
            categoriaNombre: (g['categoria'] as Map?)?['nombre'] as String?,
            categoriaColor: (g['categoria'] as Map?)?['color'] as String?,
          ),
      ],
    );
  }
}
