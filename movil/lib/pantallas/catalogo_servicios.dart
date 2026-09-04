import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// El catálogo del estudio: qué se ofrece, a qué precio y en cuánto tiempo,
/// más los bonos de sesiones prepagadas de depilación.
class PantallaCatalogoServicios extends StatefulWidget {
  const PantallaCatalogoServicios({super.key});

  @override
  State<PantallaCatalogoServicios> createState() => _PantallaCatalogoServiciosState();
}

class _PantallaCatalogoServiciosState extends State<PantallaCatalogoServicios> {
  bool _verBonos = false;
  late Future<_Catalogo> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Catalogo> _cargar() async {
    final api = Sesion.de(context);
    final servicios = await api.obtener('/api/v1/servicios');
    final bonos = await api.obtener('/api/v1/bonos');
    return _Catalogo.desdeJson(servicios, bonos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _editarServicio(_Categoria? categoria, [_Servicio? servicio]) async {
    final datos = await _futuro;
    if (!mounted) return;

    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaServicio(
        servicio: servicio,
        categorias: datos.categorias,
        especialistas: datos.especialistas,
        categoriaInicial: categoria,
      ),
    );
    if (guardado == true) _refrescar();
  }

  Future<void> _alternar(_Servicio servicio) async {
    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).parchear('/api/v1/servicios', {
        'id': servicio.id,
        'activo': !servicio.activo,
      });
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Servicios y bonos')),
      floatingActionButton: _verBonos
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _editarServicio(null),
              backgroundColor: Marca.dorado,
              foregroundColor: Marca.negro,
              icon: const Icon(Ico.agregar),
              label: const Text('Nuevo servicio'),
            ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 6),
              child: SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('Servicios')),
                  ButtonSegment(value: true, label: Text('Bonos')),
                ],
                selected: {_verBonos},
                onSelectionChanged: (v) => setState(() => _verBonos = v.first),
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: Marca.dorado,
                  selectedForegroundColor: Marca.negro,
                ),
              ),
            ),
            Expanded(
              child: FutureBuilder<_Catalogo>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar el catálogo.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  if (_verBonos) return _listaBonos(datos);
                  return _listaServicios(datos);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _listaServicios(_Catalogo datos) {
    return RefreshIndicator(
      onRefresh: _refrescar,
      color: Marca.dorado,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 104),
        children: [
          for (final categoria in datos.categorias) ...[
            () {
              final servicios =
                  datos.servicios.where((s) => s.categoriaId == categoria.id).toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 16, bottom: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: Marca.desdeHex(categoria.color),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(categoria.nombre, style: titulo(20)),
                        const Spacer(),
                        Text(
                          '${servicios.length}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Marca.textoSuave,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (servicios.isEmpty)
                    const Text(
                      'Sin servicios en esta categoría.',
                      style: TextStyle(fontSize: 13, color: Marca.textoSuave),
                    )
                  else
                    Card(
                      child: Column(
                        children: [
                          for (var i = 0; i < servicios.length; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            _FilaServicio(
                              servicio: servicios[i],
                              alTocar: () => _editarServicio(categoria, servicios[i]),
                              alAlternar: () => _alternar(servicios[i]),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              );
            }(),
          ],
        ],
      ),
    );
  }

  Widget _listaBonos(_Catalogo datos) {
    return RefreshIndicator(
      onRefresh: _refrescar,
      color: Marca.dorado,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          const Aviso(
            icono: Ico.info,
            texto: 'Un bono son sesiones pagadas por adelantado. Al cobrarlas '
                'se descuentan solas.',
            color: Marca.lavanda,
          ),
          const SizedBox(height: 14),
          if (datos.bonos.isEmpty)
            const Vacio(
              icono: Ico.bonos,
              titulo: 'Todavía no hay bonos',
              descripcion: 'Se crean desde el panel web, con los servicios que cubren.',
            )
          else
            ...datos.bonos.map(
              (b) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              b.nombre,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ),
                          Text(dinero(b.precioCentavos), style: cifra(16)),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${b.sesiones} sesiones · válido ${b.validezDias} días',
                        style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
                      ),
                      if (b.vendidos > 0) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Etiqueta(
                              '${b.activos} en uso',
                              color: b.activos > 0 ? Marca.exito : Marca.textoSuave,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${b.vendidos} vendidos · '
                              '${b.sesionesPendientes} sesiones por dar',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Marca.textoSuave,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FilaServicio extends StatelessWidget {
  const _FilaServicio({
    required this.servicio,
    required this.alTocar,
    required this.alAlternar,
  });

  final _Servicio servicio;
  final VoidCallback alTocar;
  final VoidCallback alAlternar;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: servicio.activo ? 1 : 0.5,
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(14, 4, 6, 4),
        title: Text(
          servicio.nombre,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
        ),
        subtitle: Text(
          [
            duracion(servicio.duracionMin),
            if (servicio.cicloDias != null) 'repetir cada ${servicio.cicloDias} días',
            if (!servicio.activo) 'apagado',
          ].join(' · '),
          style: const TextStyle(fontSize: 12.5),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(dinero(servicio.precioCentavos), style: cifra(15)),
            Switch(
              value: servicio.activo,
              onChanged: (_) => alAlternar(),
            ),
          ],
        ),
        onTap: alTocar,
      ),
    );
  }
}

/// Editar un servicio desde el móvil: lo que de verdad cambia en el día a
/// día es el precio y la duración.
class _HojaServicio extends StatefulWidget {
  const _HojaServicio({
    required this.categorias,
    required this.especialistas,
    this.servicio,
    this.categoriaInicial,
  });

  final List<_Categoria> categorias;
  final List<_Especialista> especialistas;
  final _Servicio? servicio;
  final _Categoria? categoriaInicial;

  @override
  State<_HojaServicio> createState() => _HojaServicioState();
}

class _HojaServicioState extends State<_HojaServicio> {
  late final _nombre = TextEditingController(text: widget.servicio?.nombre ?? '');
  late final _precio = TextEditingController(
    text: widget.servicio == null
        ? ''
        : (widget.servicio!.precioCentavos / 100).toStringAsFixed(2),
  );
  late final _duracion = TextEditingController(
    text: '${widget.servicio?.duracionMin ?? 60}',
  );
  late String? _categoriaId =
      widget.servicio?.categoriaId ?? widget.categoriaInicial?.id;

  /// Quién lo hace. Un servicio nuevo arranca con todo el equipo marcado:
  /// es más fácil quitar a una que acordarse de añadir a alguien, y un
  /// servicio sin nadie no aparece al agendar.
  late final Set<String> _quienes = {
    ...?widget.servicio?.especialistaIds,
    if (widget.servicio == null)
      for (final e in widget.especialistas) e.id,
  };

  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _precio.dispose();
    _duracion.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final precio = double.tryParse(_precio.text.replaceAll(',', '.')) ?? 0;
    final minutos = int.tryParse(_duracion.text.trim()) ?? 0;

    if (_nombre.text.trim().length < 2) {
      _avisar('Escribe el nombre del servicio.');
      return;
    }
    if (_categoriaId == null) {
      _avisar('Elige una categoría.');
      return;
    }
    if (minutos < 5) {
      _avisar('La duración mínima es de 5 minutos.');
      return;
    }
    if (_quienes.isEmpty) {
      _avisar('Elige quién hace este servicio.');
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      await Sesion.de(context).enviar('/api/v1/servicios', {
        if (widget.servicio != null) 'id': widget.servicio!.id,
        'nombre': _nombre.text.trim(),
        'precioCentavos': (precio * 100).round(),
        'duracionMin': minutos,
        'categoriaId': _categoriaId,
        'activo': widget.servicio?.activo ?? true,
        'especialistaIds': _quienes.toList(),
        // El servidor reescribe la ficha entera, así que lo que no se edita
        // aquí viaja igual de vuelta. Sin esto, tocar el precio borraba la
        // descripción y dejaba el método de depilación en ninguno.
        'descripcion': widget.servicio?.descripcion,
        if (widget.servicio?.metodo != null) 'metodo': widget.servicio!.metodo,
        'requierePrueba': widget.servicio?.requierePrueba ?? false,
        if (widget.servicio?.zona != null) 'zona': widget.servicio!.zona,
        if (widget.servicio?.cicloDias != null) 'cicloDias': widget.servicio!.cicloDias,
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Servicio guardado.')));
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
        bottom: MediaQuery.of(context).viewInsets.bottom +
            MediaQuery.of(context).viewPadding.bottom +
            24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.servicio == null ? 'Nuevo servicio' : 'Editar servicio',
              style: titulo(24),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nombre,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Nombre'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _precio,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Precio',
                      prefixText: '\$ ',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _duracion,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Duración',
                      suffixText: 'min',
                    ),
                  ),
                ),
              ],
            ),
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
                    onSelected: (_) => setState(() => _categoriaId = c.id),
                  ),
              ],
            ),
            if (widget.especialistas.length > 1) ...[
              const SizedBox(height: 20),
              Text('¿Quién lo hace?', style: titulo(18)),
              const SizedBox(height: 4),
              Text(
                'Solo ellas lo verán al agendar, y en la página sale su nombre.',
                style: sutil(13),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in widget.especialistas)
                    FilterChip(
                      label: Text(e.nombre),
                      selected: _quienes.contains(e.id),
                      showCheckmark: false,
                      avatar: CircleAvatar(
                        radius: 6,
                        backgroundColor: Marca.desdeHex(e.color),
                      ),
                      onSelected: (marcada) => setState(() {
                        if (marcada) {
                          _quienes.add(e.id);
                        } else {
                          _quienes.remove(e.id);
                        }
                      }),
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
                  : const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Especialista {
  _Especialista({required this.id, required this.nombre, required this.color});

  final String id;
  final String nombre;
  final String color;
}

class _Categoria {
  _Categoria({required this.id, required this.nombre, required this.color});

  final String id;
  final String nombre;
  final String color;
}

class _Servicio {
  _Servicio({
    required this.id,
    required this.nombre,
    required this.precioCentavos,
    required this.duracionMin,
    required this.activo,
    required this.categoriaId,
    required this.especialistaIds,
    this.descripcion,
    this.metodo,
    this.requierePrueba = false,
    this.zona,
    this.cicloDias,
  });

  final String id;
  final String nombre;
  final int precioCentavos;
  final int duracionMin;
  final bool activo;
  final String categoriaId;

  /// Quién lo hace. Si queda vacía, el servicio desaparece del agendado.
  final List<String> especialistaIds;

  /// Estos tres no se editan desde aquí, pero hay que reenviarlos al
  /// guardar: el servidor reescribe la ficha entera y, si no van, se
  /// pierden. Cambiar un precio no puede borrar la descripción.
  final String? descripcion;
  final String? metodo;
  final bool requierePrueba;

  final String? zona;
  final int? cicloDias;
}

class _Bono {
  _Bono({
    required this.nombre,
    required this.sesiones,
    required this.precioCentavos,
    required this.validezDias,
    required this.vendidos,
    required this.activos,
    required this.sesionesPendientes,
  });

  final String nombre;
  final int sesiones;
  final int precioCentavos;
  final int validezDias;
  final int vendidos;
  final int activos;
  final int sesionesPendientes;
}

class _Catalogo {
  _Catalogo({
    required this.categorias,
    required this.especialistas,
    required this.servicios,
    required this.bonos,
  });

  final List<_Categoria> categorias;
  final List<_Especialista> especialistas;
  final List<_Servicio> servicios;
  final List<_Bono> bonos;

  factory _Catalogo.desdeJson(
    Map<String, dynamic> servicios,
    Map<String, dynamic> bonos,
  ) =>
      _Catalogo(
        categorias: [
          for (final c in (servicios['categorias'] as List))
            _Categoria(
              id: (c as Map)['id'] as String,
              nombre: c['nombre'] as String,
              color: c['color'] as String,
            ),
        ],
        especialistas: [
          for (final e in (servicios['especialistas'] as List? ?? const []))
            _Especialista(
              id: (e as Map)['id'] as String,
              nombre: e['nombre'] as String,
              color: e['color'] as String,
            ),
        ],
        servicios: [
          for (final s in (servicios['servicios'] as List))
            _Servicio(
              id: (s as Map)['id'] as String,
              nombre: s['nombre'] as String,
              precioCentavos: s['precioCentavos'] as int,
              duracionMin: s['duracionMin'] as int,
              activo: s['activo'] as bool? ?? true,
              categoriaId: (s['categoria'] as Map)['id'] as String,
              especialistaIds: [
                for (final id in (s['especialistaIds'] as List? ?? const []))
                  id as String,
              ],
              descripcion: s['descripcion'] as String?,
              metodo: s['metodo'] as String?,
              requierePrueba: s['requierePrueba'] as bool? ?? false,
              zona: s['zona'] as String?,
              cicloDias: s['cicloDias'] as int?,
            ),
        ],
        bonos: [
          for (final b in (bonos['bonos'] as List))
            _Bono(
              nombre: (b as Map)['nombre'] as String,
              sesiones: b['sesiones'] as int,
              precioCentavos: b['precioCentavos'] as int,
              validezDias: b['validezDias'] as int,
              vendidos: b['vendidos'] as int? ?? 0,
              activos: b['activos'] as int? ?? 0,
              sesionesPendientes: b['sesionesPendientes'] as int? ?? 0,
            ),
        ],
      );
}
