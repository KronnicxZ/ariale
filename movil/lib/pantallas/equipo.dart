import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// El equipo del estudio: quién atiende, con qué color sale en la agenda
/// y con qué clave entra a su propia vista.
class PantallaEquipo extends StatefulWidget {
  const PantallaEquipo({super.key});

  @override
  State<PantallaEquipo> createState() => _PantallaEquipoState();
}

class _PantallaEquipoState extends State<PantallaEquipo> {
  late Future<List<_Miembro>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<_Miembro>> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/especialistas');
    return [
      for (final e in (datos['especialistas'] as List))
        _Miembro.desdeJson(e as Map<String, dynamic>),
    ];
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _editar([_Miembro? miembro]) async {
    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaMiembro(miembro: miembro),
    );
    if (guardado == true) _refrescar();
  }

  Future<void> _alternar(_Miembro miembro) async {
    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).parchear('/api/v1/especialistas', {
        'id': miembro.id,
        'activa': !miembro.activa,
      });
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Equipo')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(),
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Ico.nuevaClienta),
        label: const Text('Agregar'),
      ),
      body: SafeArea(
        child: FutureBuilder<List<_Miembro>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar el equipo.',
                alReintentar: _refrescar,
              );
            }

            final equipo = snap.data!;
            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                children: [
                  const Aviso(
                    icono: Ico.clave,
                    texto: 'La clave de 4 dígitos es la que usa cada especialista '
                        'para entrar a ver solo su agenda.',
                    color: Marca.lavanda,
                  ),
                  const SizedBox(height: 14),
                  ...equipo.map(
                    (m) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Opacity(
                        opacity: m.activa ? 1 : 0.55,
                        child: ListTile(
                          contentPadding: const EdgeInsets.fromLTRB(14, 6, 8, 6),
                          leading: CircleAvatar(
                            backgroundColor: Marca.desdeHex(m.color),
                            child: Text(
                              iniciales(m.nombre),
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Marca.contrasteSobre(Marca.desdeHex(m.color)),
                              ),
                            ),
                          ),
                          title: Text(
                            m.nombre,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                          subtitle: Text(
                            [
                              'clave ${m.clave}',
                              '${m.servicioIds.length} servicios',
                              if (m.citasSemana > 0) '${m.citasSemana} citas esta semana',
                            ].join(' · '),
                            style: const TextStyle(fontSize: 12.5),
                          ),
                          trailing: Switch(
                            value: m.activa,
                            onChanged: (_) => _alternar(m),
                            activeThumbColor: Marca.dorado,
                          ),
                          onTap: () => _editar(m),
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
    );
  }
}

class _HojaMiembro extends StatefulWidget {
  const _HojaMiembro({this.miembro});

  final _Miembro? miembro;

  @override
  State<_HojaMiembro> createState() => _HojaMiembroState();
}

class _HojaMiembroState extends State<_HojaMiembro> {
  late final _nombre = TextEditingController(text: widget.miembro?.nombre ?? '');
  late final _clave = TextEditingController(text: widget.miembro?.clave ?? '');
  late final _telefono = TextEditingController(text: widget.miembro?.telefono ?? '');
  late String _color = widget.miembro?.color ?? '#E9B21C';
  bool _guardando = false;

  static const _colores = [
    '#E9B21C',
    '#E9A8B4',
    '#A8C7A9',
    '#BDAEDC',
    '#A6C4DC',
    '#F0C79A',
  ];

  @override
  void dispose() {
    _nombre.dispose();
    _clave.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (_nombre.text.trim().length < 2) {
      _avisar('Escribe el nombre.');
      return;
    }
    if (!RegExp(r'^\d{4}$').hasMatch(_clave.text.trim())) {
      _avisar('La clave debe ser de 4 dígitos.');
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      await Sesion.de(context).enviar('/api/v1/especialistas', {
        if (widget.miembro != null) 'id': widget.miembro!.id,
        'nombre': _nombre.text.trim(),
        'clave': _clave.text.trim(),
        'telefono': _telefono.text.trim(),
        'color': _color,
        'activa': widget.miembro?.activa ?? true,
        // Sin servicios marcados, puede atender todo lo del catálogo.
        'servicioIds': widget.miembro?.servicioIds ?? const <String>[],
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Guardado.')));
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
          Text(
            widget.miembro == null ? 'Nueva especialista' : 'Editar especialista',
            style: titulo(24),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nombre,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nombre'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _clave,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: const InputDecoration(
                    labelText: 'Clave',
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _telefono,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Teléfono'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Color en la agenda',
            style: TextStyle(fontSize: 12.5, color: Marca.textoSuave),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (final hex in _colores)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: GestureDetector(
                    onTap: () => setState(() => _color = hex),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Marca.desdeHex(hex),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _color == hex ? Marca.negro : Colors.transparent,
                          width: 2.5,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
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

class _Miembro {
  _Miembro({
    required this.id,
    required this.nombre,
    required this.color,
    required this.clave,
    required this.activa,
    required this.servicioIds,
    required this.citasSemana,
    this.telefono,
  });

  final String id;
  final String nombre;
  final String color;
  final String clave;
  final bool activa;
  final List<String> servicioIds;
  final int citasSemana;
  final String? telefono;

  factory _Miembro.desdeJson(Map<String, dynamic> j) => _Miembro(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        color: j['color'] as String,
        clave: j['clave'] as String? ?? '0000',
        activa: j['activa'] as bool? ?? true,
        citasSemana: j['citasSemana'] as int? ?? 0,
        telefono: j['telefono'] as String?,
        servicioIds: [for (final s in (j['servicioIds'] as List)) s as String],
      );
}
