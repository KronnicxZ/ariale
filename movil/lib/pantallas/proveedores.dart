import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// A quién le compra el estudio y cuánto se le debe hoy.
class PantallaProveedores extends StatefulWidget {
  const PantallaProveedores({super.key});

  @override
  State<PantallaProveedores> createState() => _PantallaProveedoresState();
}

class _PantallaProveedoresState extends State<PantallaProveedores> {
  late Future<List<_Proveedor>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<_Proveedor>> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/proveedores');
    return [
      for (final p in (datos['proveedores'] as List))
        _Proveedor.desdeJson(p as Map<String, dynamic>),
    ];
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _editar([_Proveedor? proveedor]) async {
    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaProveedor(proveedor: proveedor),
    );
    if (guardado == true) _refrescar();
  }

  @override
  Widget build(BuildContext context) {
    final prefijo = Sesion.catalogo?.negocio.prefijo ?? '+58';

    return Scaffold(
      appBar: AppBar(title: const Text('Proveedores')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(),
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Ico.agregar),
        label: const Text('Nuevo'),
      ),
      body: SafeArea(
        child: FutureBuilder<List<_Proveedor>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar los proveedores.',
                alReintentar: _refrescar,
              );
            }

            final proveedores = snap.data!;
            final deuda = proveedores.fold(0, (suma, p) => suma + p.saldoCentavos);

            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 104),
                children: [
                  Cabecera(
                    etiqueta: 'Deuda con proveedores',
                    valor: dinero(deuda),
                    apoyo: '${proveedores.length} '
                        '${proveedores.length == 1 ? 'proveedor' : 'proveedores'}',
                    colorValor: deuda > 0 ? Marca.error : null,
                  ),
                  const SizedBox(height: 14),
                  if (proveedores.isEmpty)
                    const Vacio(
                      icono: Ico.proveedores,
                      titulo: 'Todavía no hay proveedores',
                      descripcion:
                          'Anota a quién le compras el material para llevar '
                          'las cuentas por pagar.',
                    )
                  else
                    ...proveedores.map(
                      (p) => Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          contentPadding: const EdgeInsets.fromLTRB(14, 6, 8, 6),
                          title: Text(
                            p.nombre,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                          subtitle: Text(
                            [
                              if (p.telefono != null) telefonoBonito(p.telefono!, prefijo),
                              if (p.comprasAbiertas > 0)
                                '${p.comprasAbiertas} '
                                    '${p.comprasAbiertas == 1 ? 'compra abierta' : 'compras abiertas'}',
                            ].join(' · '),
                            style: const TextStyle(fontSize: 12.5),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (p.saldoCentavos > 0)
                                Text(
                                  dinero(p.saldoCentavos),
                                  style: cifra(15, color: Marca.error),
                                ),
                              if (p.telefono != null)
                                IconButton(
                                  tooltip: 'Escribir por WhatsApp',
                                  onPressed: () => abrirWhatsApp(
                                    p.telefono!,
                                    'Hola ${p.nombre}, te escribo de '
                                    '${Sesion.catalogo?.negocio.nombre ?? 'Arialé Studio'}.',
                                    prefijo: prefijo,
                                  ),
                                  icon: const Icon(Ico.whatsapp, size: 19),
                                  color: Marca.exito,
                                ),
                            ],
                          ),
                          onTap: () => _editar(p),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HojaProveedor extends StatefulWidget {
  const _HojaProveedor({this.proveedor});

  final _Proveedor? proveedor;

  @override
  State<_HojaProveedor> createState() => _HojaProveedorState();
}

class _HojaProveedorState extends State<_HojaProveedor> {
  late final _nombre = TextEditingController(text: widget.proveedor?.nombre ?? '');
  late final _telefono = TextEditingController(text: widget.proveedor?.telefono ?? '');
  late final _notas = TextEditingController(text: widget.proveedor?.notas ?? '');
  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    _notas.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (_nombre.text.trim().length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Escribe el nombre del proveedor.')),
      );
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      await Sesion.de(context).enviar('/api/v1/proveedores', {
        if (widget.proveedor != null) 'id': widget.proveedor!.id,
        'nombre': _nombre.text.trim(),
        'telefono': _telefono.text.trim(),
        'notas': _notas.text.trim(),
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Proveedor guardado.')));
      navegador.pop(true);
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _guardando = false);
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
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
          Text(
            widget.proveedor == null ? 'Nuevo proveedor' : 'Editar proveedor',
            style: titulo(24),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nombre,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nombre'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _telefono,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Teléfono'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notas,
            maxLines: 2,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Notas'),
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
                : const Text('Guardar'),
          ),
        ],
      ),
    );
  }
}

class _Proveedor {
  _Proveedor({
    required this.id,
    required this.nombre,
    required this.comprasAbiertas,
    required this.saldoCentavos,
    this.telefono,
    this.notas,
  });

  final String id;
  final String nombre;
  final int comprasAbiertas;
  final int saldoCentavos;
  final String? telefono;
  final String? notas;

  factory _Proveedor.desdeJson(Map<String, dynamic> j) => _Proveedor(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        comprasAbiertas: j['comprasAbiertas'] as int? ?? 0,
        saldoCentavos: j['saldoCentavos'] as int? ?? 0,
        telefono: j['telefono'] as String?,
        notas: j['notas'] as String?,
      );
}
