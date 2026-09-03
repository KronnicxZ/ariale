import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'elegir_clienta.dart';
import 'nueva_cita.dart';

/// La ficha de una clienta: lo que ha gastado, lo que debe, sus bonos,
/// su historial y qué sesión de depilación le toca repetir.
class PantallaClientaDetalle extends StatefulWidget {
  const PantallaClientaDetalle({super.key, required this.id});

  final String id;

  @override
  State<PantallaClientaDetalle> createState() => _PantallaClientaDetalleState();
}

class _PantallaClientaDetalleState extends State<PantallaClientaDetalle> {
  late Future<_Ficha> _futuro;
  bool _huboCambios = false;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Ficha> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/clientas/${widget.id}');
    return _Ficha.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _agendar(_Ficha ficha) async {
    final creada = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PantallaNuevaCita(
          clientaPreseleccionada: ClientaElegida(
            id: ficha.id,
            nombre: ficha.nombre,
            telefono: ficha.telefono,
          ),
        ),
      ),
    );
    if (creada == true) {
      _huboCambios = true;
      _refrescar();
    }
  }

  Future<void> _editar(_Ficha ficha) async {
    final cambios = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _HojaClienta(ficha: ficha),
    );
    if (cambios == null || !mounted) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).parchear('/api/v1/clientas/${ficha.id}', cambios);
      _huboCambios = true;
      mensajero.showSnackBar(const SnackBar(content: Text('Ficha actualizada.')));
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;
    final prefijo = negocio?.prefijo ?? '+58';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _huboCambios);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Ficha'),
          actions: [
            FutureBuilder<_Ficha>(
              future: _futuro,
              builder: (context, snap) => IconButton(
                tooltip: 'Editar',
                onPressed: snap.hasData ? () => _editar(snap.data!) : null,
                icon: const Icon(Ico.editar),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: FutureBuilder<_Ficha>(
            future: _futuro,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return ErrorConReintento(
                  mensaje: snap.error is ErrorApi
                      ? (snap.error as ErrorApi).mensaje
                      : 'No pudimos cargar la ficha.',
                  alReintentar: _refrescar,
                );
              }

              final f = snap.data!;
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: Marca.dorado.withValues(alpha: 0.18),
                        child: Text(
                          iniciales(f.nombre),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Marca.negro,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(f.nombre, style: titulo(25)),
                            Text(
                              telefonoBonito(f.telefono, prefijo),
                              style: const TextStyle(
                                fontSize: 13,
                                color: Marca.textoSuave,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (f.alergias != null && f.alergias!.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Aviso(
                      icono: Ico.atencion,
                      texto: 'Alergias: ${f.alergias}',
                      color: Marca.error,
                    ),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => _agendar(f),
                          icon: const Icon(Ico.agregar, size: 19),
                          label: const Text('Agendar'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => abrirWhatsApp(
                            f.telefono,
                            '¡Hola ${primerNombre(f.nombre)}! 💕 '
                            'Te escribo de ${negocio?.nombre ?? 'Arialé Studio'}.',
                            prefijo: prefijo,
                          ),
                          icon: const Icon(Ico.whatsapp, size: 18),
                          label: const Text('Escribir'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Marca.exito,
                            side: BorderSide(color: Marca.exito.withValues(alpha: 0.4)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                      child: Column(
                        children: [
                          FilaDato('Visitas', '${f.visitas}'),
                          FilaDato('Ha gastado', dinero(f.gastadoCentavos)),
                          FilaDato('Promedio por visita', dinero(f.ticketCentavos)),
                          if (f.saldoCentavos > 0)
                            FilaDato(
                              'Te debe',
                              dinero(f.saldoCentavos),
                              destacado: true,
                              color: Marca.error,
                            ),
                          if (f.ultimaVisita != null)
                            FilaDato('Última visita', fechaCorta(f.ultimaVisita!)),
                        ],
                      ),
                    ),
                  ),
                  if (f.tocaRepetir.isNotEmpty) ...[
                    const Seccion(
                      'Le toca repetir',
                      apoyo: 'Según el ciclo de cada zona',
                    ),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          children: [
                            for (final t in f.tocaRepetir)
                              FilaDato(
                                t.servicio,
                                'desde ${fechaCorta(t.toca)}',
                                color: t.toca.isBefore(DateTime.now())
                                    ? Marca.alerta
                                    : null,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (f.bonos.isNotEmpty) ...[
                    const Seccion('Bonos'),
                    ...f.bonos.map(
                      (b) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(
                            b.nombre,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14.5,
                            ),
                          ),
                          subtitle: Text(
                            'Vence el ${fechaCorta(b.vence)}',
                            style: const TextStyle(fontSize: 12.5),
                          ),
                          trailing: Etiqueta(
                            '${b.restantes} de ${b.sesiones}',
                            color: b.restantes > 0 ? Marca.exito : Marca.textoSuave,
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (f.proximas.isNotEmpty) ...[
                    const Seccion('Próximas citas'),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          children: [
                            for (final c in f.proximas)
                              FilaDato(
                                '${diaRelativo(c.inicio)} · ${c.servicios.join(' + ')}',
                                hora(c.inicio),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (f.historial.isNotEmpty) ...[
                    const Seccion('Historial'),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          children: [
                            for (final c in f.historial.take(15))
                              FilaDato(
                                '${fechaCorta(c.inicio)} · ${c.servicios.join(' + ')}',
                                dinero(c.totalCentavos),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (f.notas != null && f.notas!.isNotEmpty) ...[
                    const Seccion('Notas'),
                    Text(
                      f.notas!,
                      style: const TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: Marca.textoSuave,
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

class _HojaClienta extends StatefulWidget {
  const _HojaClienta({required this.ficha});

  final _Ficha ficha;

  @override
  State<_HojaClienta> createState() => _HojaClientaState();
}

class _HojaClientaState extends State<_HojaClienta> {
  late final _nombre = TextEditingController(text: widget.ficha.nombre);
  late final _telefono = TextEditingController(text: widget.ficha.telefono);
  late final _alergias = TextEditingController(text: widget.ficha.alergias ?? '');
  late final _notas = TextEditingController(text: widget.ficha.notas ?? '');

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    _alergias.dispose();
    _notas.dispose();
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
            Text('Editar ficha', style: titulo(24)),
            const SizedBox(height: 16),
            TextField(
              controller: _nombre,
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
              controller: _alergias,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Alergias',
                helperText: 'Sale como aviso en su ficha y al agendar',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notas,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Notas'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(context, {
                'nombre': _nombre.text.trim(),
                'telefono': _telefono.text.trim(),
                'alergias': _alergias.text.trim(),
                'notas': _notas.text.trim(),
              }),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CitaFicha {
  _CitaFicha({
    required this.inicio,
    required this.servicios,
    required this.totalCentavos,
  });

  final DateTime inicio;
  final List<String> servicios;
  final int totalCentavos;

  factory _CitaFicha.desdeJson(Map<String, dynamic> j) => _CitaFicha(
        inicio: DateTime.parse(j['inicio'] as String).toLocal(),
        servicios: [for (final s in (j['servicios'] as List)) s as String],
        totalCentavos: j['totalCentavos'] as int? ?? 0,
      );
}

class _BonoFicha {
  _BonoFicha({
    required this.nombre,
    required this.sesiones,
    required this.restantes,
    required this.vence,
  });

  final String nombre;
  final int sesiones;
  final int restantes;
  final DateTime vence;
}

class _Repetir {
  _Repetir({required this.servicio, required this.toca});

  final String servicio;
  final DateTime toca;
}

class _Ficha {
  _Ficha({
    required this.id,
    required this.nombre,
    required this.telefono,
    required this.visitas,
    required this.gastadoCentavos,
    required this.saldoCentavos,
    required this.ticketCentavos,
    required this.proximas,
    required this.historial,
    required this.bonos,
    required this.tocaRepetir,
    this.alergias,
    this.notas,
    this.ultimaVisita,
  });

  final String id;
  final String nombre;
  final String telefono;
  final int visitas;
  final int gastadoCentavos;
  final int saldoCentavos;
  final int ticketCentavos;
  final List<_CitaFicha> proximas;
  final List<_CitaFicha> historial;
  final List<_BonoFicha> bonos;
  final List<_Repetir> tocaRepetir;
  final String? alergias;
  final String? notas;
  final DateTime? ultimaVisita;

  factory _Ficha.desdeJson(Map<String, dynamic> j) {
    final c = j['clienta'] as Map<String, dynamic>;
    final r = j['resumen'] as Map<String, dynamic>;
    return _Ficha(
      id: c['id'] as String,
      nombre: c['nombre'] as String,
      telefono: c['telefono'] as String,
      alergias: c['alergias'] as String?,
      notas: c['notas'] as String?,
      visitas: r['visitas'] as int,
      gastadoCentavos: r['gastadoCentavos'] as int,
      saldoCentavos: r['saldoCentavos'] as int,
      ticketCentavos: r['ticketCentavos'] as int,
      ultimaVisita: r['ultimaVisita'] == null
          ? null
          : DateTime.parse(r['ultimaVisita'] as String).toLocal(),
      proximas: [
        for (final x in (j['proximas'] as List))
          _CitaFicha.desdeJson(x as Map<String, dynamic>),
      ],
      historial: [
        for (final x in (j['historial'] as List))
          _CitaFicha.desdeJson(x as Map<String, dynamic>),
      ],
      bonos: [
        for (final x in (j['bonos'] as List))
          _BonoFicha(
            nombre: (x as Map)['nombre'] as String,
            sesiones: x['sesiones'] as int,
            restantes: x['restantes'] as int,
            vence: DateTime.parse(x['vence'] as String).toLocal(),
          ),
      ],
      tocaRepetir: [
        for (final x in (j['tocaRepetir'] as List))
          _Repetir(
            servicio: (x as Map)['servicio'] as String,
            toca: DateTime.parse(x['toca'] as String).toLocal(),
          ),
      ],
    );
  }
}
