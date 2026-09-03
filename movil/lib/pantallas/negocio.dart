import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Los datos del estudio, el horario de atención y las reglas de la agenda.
class PantallaNegocio extends StatefulWidget {
  const PantallaNegocio({super.key});

  @override
  State<PantallaNegocio> createState() => _PantallaNegocioState();
}

class _PantallaNegocioState extends State<PantallaNegocio> {
  late Future<_Ajustes> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Ajustes> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/negocio');
    return _Ajustes.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _guardar(Map<String, dynamic> cambios) async {
    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).parchear('/api/v1/negocio', cambios);
      mensajero.showSnackBar(const SnackBar(content: Text('Guardado.')));
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  Future<void> _editarDatos(_Ajustes ajustes) async {
    final cambios = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaDatos(ajustes: ajustes),
    );
    if (cambios != null) await _guardar(cambios);
  }

  Future<void> _editarDia(_Dia dia) async {
    final desde = await showTimePicker(
      context: context,
      initialTime: _aHora(dia.desde),
      helpText: 'Hora de apertura',
    );
    if (desde == null || !mounted) return;

    final hasta = await showTimePicker(
      context: context,
      initialTime: _aHora(dia.hasta),
      helpText: 'Hora de cierre',
    );
    if (hasta == null) return;

    await _guardar({
      'horario': [
        {
          'dia': dia.dia,
          'abierto': true,
          'desde': _aTexto(desde),
          'hasta': _aTexto(hasta),
        },
      ],
    });
  }

  TimeOfDay _aHora(String texto) {
    final partes = texto.split(':');
    return TimeOfDay(
      hour: int.tryParse(partes.first) ?? 9,
      minute: int.tryParse(partes.last) ?? 0,
    );
  }

  String _aTexto(TimeOfDay hora) =>
      '${hora.hour.toString().padLeft(2, '0')}:${hora.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi negocio')),
      body: SafeArea(
        child: FutureBuilder<_Ajustes>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar los ajustes.',
                alReintentar: _refrescar,
              );
            }

            final a = snap.data!;
            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
                children: [
                  Text(a.nombre, style: titulo(28)),
                  Text(
                    a.lema,
                    style: const TextStyle(fontSize: 13.5, color: Marca.textoSuave),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 6),
                      child: Column(
                        children: [
                          FilaDato('Teléfono', a.telefono ?? '—'),
                          FilaDato('WhatsApp', a.whatsapp ?? '—'),
                          FilaDato(
                            'Instagram',
                            a.instagram == null ? '—' : '@${a.instagram}',
                          ),
                          FilaDato('Dirección', a.direccion ?? '—'),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton.icon(
                              onPressed: () => _editarDatos(a),
                              icon: const Icon(Ico.editar, size: 17),
                              label: const Text('Editar datos'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Seccion('Horario', apoyo: 'Toca un día para cambiarlo'),
                  Card(
                    child: Column(
                      children: [
                        for (var i = 0; i < a.horario.length; i++) ...[
                          if (i > 0) const Divider(height: 1),
                          SwitchListTile(
                            value: a.horario[i].abierto,
                            activeThumbColor: Marca.dorado,
                            onChanged: (v) => _guardar({
                              'horario': [
                                {
                                  'dia': a.horario[i].dia,
                                  'abierto': v,
                                  'desde': a.horario[i].desde,
                                  'hasta': a.horario[i].hasta,
                                },
                              ],
                            }),
                            title: Text(
                              _nombresDia[a.horario[i].dia],
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14.5,
                              ),
                            ),
                            subtitle: GestureDetector(
                              onTap: a.horario[i].abierto
                                  ? () => _editarDia(a.horario[i])
                                  : null,
                              child: Text(
                                a.horario[i].abierto
                                    ? '${a.horario[i].desde} — ${a.horario[i].hasta}'
                                    : 'Cerrado',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: a.horario[i].abierto
                                      ? Marca.dorado
                                      : Marca.textoSuave,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Seccion('Cómo funciona la agenda'),
                  Card(
                    child: Column(
                      children: [
                        SwitchListTile(
                          value: a.confirmarAuto,
                          activeThumbColor: Marca.dorado,
                          onChanged: (v) => _guardar({'confirmarAuto': v}),
                          title: const Text(
                            'Confirmar sin preguntarte',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
                          ),
                          subtitle: Text(
                            a.confirmarAuto
                                ? 'Las citas que pida una clienta quedan confirmadas.'
                                : 'Cada cita que pida una clienta la confirmas tú.',
                            style: const TextStyle(fontSize: 12.5),
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          title: const Text(
                            'Cada cuánto ofreces una hora',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
                          ),
                          subtitle: const Text(
                            'A las 9:00, 9:30, 10:00…',
                            style: TextStyle(fontSize: 12.5),
                          ),
                          trailing: DropdownButton<int>(
                            value: a.intervaloMin,
                            underline: const SizedBox.shrink(),
                            items: const [10, 15, 20, 30, 45, 60]
                                .map(
                                  (m) => DropdownMenuItem(
                                    value: m,
                                    child: Text('$m min'),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) {
                              if (v != null) _guardar({'intervaloMin': v});
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Seccion('Tasa del día'),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
                      child: Column(
                        children: [
                          FilaDato(
                            'Bs. por dólar',
                            a.tasa > 0 ? a.tasa.toStringAsFixed(2) : '—',
                            destacado: true,
                          ),
                          FilaDato('Fuente', a.fuenteTasa),
                          if (a.tasaVieja)
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: Aviso(
                                icono: Ico.hora,
                                texto: 'La tasa no es de hoy. Se actualiza desde el panel web.',
                                color: Marca.alerta,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Center(
                    child: Text(
                      'Sesión de ${a.usuaria}',
                      style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
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

const _nombresDia = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

class _HojaDatos extends StatefulWidget {
  const _HojaDatos({required this.ajustes});

  final _Ajustes ajustes;

  @override
  State<_HojaDatos> createState() => _HojaDatosState();
}

class _HojaDatosState extends State<_HojaDatos> {
  late final _nombre = TextEditingController(text: widget.ajustes.nombre);
  late final _lema = TextEditingController(text: widget.ajustes.lema);
  late final _telefono = TextEditingController(text: widget.ajustes.telefono ?? '');
  late final _whatsapp = TextEditingController(text: widget.ajustes.whatsapp ?? '');
  late final _instagram = TextEditingController(text: widget.ajustes.instagram ?? '');
  late final _direccion = TextEditingController(text: widget.ajustes.direccion ?? '');

  @override
  void dispose() {
    _nombre.dispose();
    _lema.dispose();
    _telefono.dispose();
    _whatsapp.dispose();
    _instagram.dispose();
    _direccion.dispose();
    super.dispose();
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
            Text('Datos del estudio', style: titulo(24)),
            const SizedBox(height: 16),
            TextField(
              controller: _nombre,
              decoration: const InputDecoration(labelText: 'Nombre'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lema,
              decoration: const InputDecoration(labelText: 'Lema'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _telefono,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Teléfono'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _whatsapp,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'WhatsApp'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _instagram,
              decoration: const InputDecoration(labelText: 'Instagram', prefixText: '@'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _direccion,
              decoration: const InputDecoration(labelText: 'Dirección'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(context, {
                'nombre': _nombre.text.trim(),
                'lema': _lema.text.trim(),
                'telefono': _telefono.text.trim(),
                'whatsapp': _whatsapp.text.trim(),
                'instagram': _instagram.text.trim(),
                'direccion': _direccion.text.trim(),
              }),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dia {
  _Dia({
    required this.dia,
    required this.abierto,
    required this.desde,
    required this.hasta,
  });

  final int dia;
  final bool abierto;
  final String desde;
  final String hasta;
}

class _Ajustes {
  _Ajustes({
    required this.nombre,
    required this.lema,
    required this.intervaloMin,
    required this.confirmarAuto,
    required this.horario,
    required this.tasa,
    required this.fuenteTasa,
    required this.tasaVieja,
    required this.usuaria,
    this.telefono,
    this.whatsapp,
    this.instagram,
    this.direccion,
  });

  final String nombre;
  final String lema;
  final int intervaloMin;
  final bool confirmarAuto;
  final List<_Dia> horario;
  final double tasa;
  final String fuenteTasa;
  final bool tasaVieja;
  final String usuaria;
  final String? telefono;
  final String? whatsapp;
  final String? instagram;
  final String? direccion;

  factory _Ajustes.desdeJson(Map<String, dynamic> j) {
    final n = j['negocio'] as Map<String, dynamic>;
    final t = j['tasa'] as Map<String, dynamic>;
    return _Ajustes(
      nombre: n['nombre'] as String,
      lema: n['lema'] as String? ?? '',
      intervaloMin: n['intervaloMin'] as int? ?? 30,
      confirmarAuto: n['confirmarAuto'] as bool? ?? false,
      telefono: n['telefono'] as String?,
      whatsapp: n['whatsapp'] as String?,
      instagram: n['instagram'] as String?,
      direccion: n['direccion'] as String?,
      tasa: (t['valor'] as num?)?.toDouble() ?? 0,
      fuenteTasa: t['fuente'] as String? ?? 'BCV',
      tasaVieja: t['desactualizada'] as bool? ?? false,
      usuaria: (j['usuaria'] as Map)['nombre'] as String? ?? '',
      horario: [
        for (final d in (j['horario'] as List))
          _Dia(
            dia: (d as Map)['dia'] as int,
            abierto: d['abierto'] as bool,
            desde: d['desde'] as String,
            hasta: d['hasta'] as String,
          ),
      ],
    );
  }
}
