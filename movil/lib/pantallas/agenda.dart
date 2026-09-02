import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/calendario.dart';
import '../widgets/comunes.dart';
import '../widgets/rejilla_dia.dart';
import 'cita_detalle.dart';
import 'nueva_cita.dart';

/// La agenda como calendario: el mes arriba para saltar de fecha y el día
/// abajo dibujado por horas, con una columna por especialista. De un vistazo
/// se ve qué está ocupado y qué queda libre.
class PantallaAgenda extends StatefulWidget {
  const PantallaAgenda({super.key, this.diaInicial});

  final String? diaInicial;

  @override
  State<PantallaAgenda> createState() => _PantallaAgendaState();
}

class _PantallaAgendaState extends State<PantallaAgenda> {
  late DateTime _dia;
  bool _mesAbierto = false;
  Map<String, ConteoDia> _conteos = {};
  String? _mesCargado;
  late Future<_DatosDia> _futuro;

  DateTime get _hoy {
    final clave = Sesion.catalogo?.hoy;
    return clave == null ? DateTime.now() : _desdeClave(clave);
  }

  @override
  void initState() {
    super.initState();
    _dia = widget.diaInicial != null
        ? _desdeClave(widget.diaInicial!)
        : _hoy;
    _futuro = _cargarDia();
    _cargarMes();
  }

  @override
  void didUpdateWidget(PantallaAgenda anterior) {
    super.didUpdateWidget(anterior);
    // Al llegar desde "Hoy" con un día concreto, saltamos a ese día.
    if (widget.diaInicial != null && widget.diaInicial != anterior.diaInicial) {
      _dia = _desdeClave(widget.diaInicial!);
      _futuro = _cargarDia();
      _cargarMes();
    }
  }

  static DateTime _desdeClave(String clave) {
    final p = clave.split('-').map(int.parse).toList();
    return DateTime(p[0], p[1], p[2]);
  }

  Future<_DatosDia> _cargarDia() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/agenda',
      params: {'dia': claveDia(_dia)},
    );
    return _DatosDia.desdeJson(datos);
  }

  /// Los conteos del mes visible, para los puntitos del calendario. Se piden
  /// una vez por mes, no una por día.
  Future<void> _cargarMes() async {
    final clave = '${_dia.year}-${_dia.month}';
    if (clave == _mesCargado) return;

    // Un poco antes y un poco después: el mes en pantalla incluye días
    // sueltos del mes anterior y del siguiente.
    final desde = DateTime(_dia.year, _dia.month, 1).subtract(const Duration(days: 7));
    final hasta = DateTime(_dia.year, _dia.month + 1, 0).add(const Duration(days: 7));

    try {
      final datos = await Sesion.de(context).obtener(
        '/api/v1/calendario',
        params: {'desde': claveDia(desde), 'hasta': claveDia(hasta)},
      );
      if (!mounted) return;
      setState(() {
        _mesCargado = clave;
        _conteos = {
          for (final d in (datos['dias'] as List))
            (d as Map)['dia'] as String: ConteoDia(
              citas: d['citas'] as int,
              porConfirmar: d['porConfirmar'] as int? ?? 0,
            ),
        };
      });
    } on ErrorApi {
      // Los puntitos son un adorno útil: si fallan, la agenda sigue sirviendo.
    }
  }

  Future<void> _refrescar() async {
    _mesCargado = null;
    final futuro = _cargarDia();
    setState(() => _futuro = futuro);
    await Future.wait([futuro, _cargarMes()]);
  }

  void _irA(DateTime dia) {
    setState(() {
      _dia = DateTime(dia.year, dia.month, dia.day);
      _futuro = _cargarDia();
    });
    _cargarMes();
  }

  void _saltarMes(int meses) {
    final destino = DateTime(_dia.year, _dia.month + meses, 1);
    // Al cambiar de mes caemos en el día 1, salvo que sea el mes de hoy.
    final hoy = _hoy;
    _irA(
      destino.year == hoy.year && destino.month == hoy.month ? hoy : destino,
    );
  }

  Future<void> _agendar({String? especialistaId}) async {
    final creada = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PantallaNuevaCita(
          diaSugerido: claveDia(_dia),
          especialistaSugerido: especialistaId,
        ),
      ),
    );
    if (creada == true) _refrescar();
  }

  Future<void> _abrirCita(Cita cita) async {
    final cambio = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PantallaCitaDetalle(citaId: cita.id)),
    );
    if (cambio == true) _refrescar();
  }

  @override
  Widget build(BuildContext context) {
    final hoy = _hoy;
    final esHoy = claveDia(_dia) == claveDia(hoy);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _agendar(),
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Icons.add),
        label: const Text('Agendar'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 12, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => _saltarMes(-1),
                    icon: const Icon(Icons.chevron_left),
                    tooltip: 'Mes anterior',
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _mesAbierto = !_mesAbierto),
                      child: Text(
                        mesYAno(_dia),
                        textAlign: TextAlign.center,
                        style: titulo(23),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _saltarMes(1),
                    icon: const Icon(Icons.chevron_right),
                    tooltip: 'Mes siguiente',
                  ),
                  if (!esHoy)
                    TextButton(
                      onPressed: () => _irA(hoy),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        minimumSize: const Size(0, 36),
                      ),
                      child: const Text('Hoy'),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Calendario(
                seleccionado: _dia,
                hoy: hoy,
                conteos: _conteos,
                expandido: _mesAbierto,
                alElegir: _irA,
                alAlternar: () => setState(() => _mesAbierto = !_mesAbierto),
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: FutureBuilder<_DatosDia>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar la agenda.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  final horario =
                      Sesion.catalogo?.horarioDe(_dia) ??
                          HorarioDia(
                            dia: _dia.weekday % 7,
                            abierto: true,
                            desde: '09:00',
                            hasta: '18:00',
                          );

                  if (!horario.abierto && datos.citas.isEmpty) {
                    return _Cerrado(dia: _dia, alAgendar: () => _agendar());
                  }

                  return Column(
                    children: [
                      _Cabecera(
                        fecha: _dia,
                        datos: datos,
                        especialistas: datos.especialistas,
                      ),
                      Expanded(
                        child: RefreshIndicator(
                          onRefresh: _refrescar,
                          color: Marca.dorado,
                          child: RejillaDia(
                            fecha: _dia,
                            citas: datos.citas,
                            especialistas: datos.especialistas,
                            horario: horario,
                            alTocarCita: _abrirCita,
                            alTocarHueco: (_) => _agendar(),
                          ),
                        ),
                      ),
                    ],
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

/// El resumen del día y los nombres de las columnas, alineados con la rejilla.
class _Cabecera extends StatelessWidget {
  const _Cabecera({
    required this.fecha,
    required this.datos,
    required this.especialistas,
  });

  final DateTime fecha;
  final _DatosDia datos;
  final List<Especialista> especialistas;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Marca.borde)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  fechaLarga(fecha),
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                datos.citas.isEmpty
                    ? 'Sin citas'
                    : '${datos.total} '
                        '${datos.total == 1 ? 'cita' : 'citas'}'
                        '${datos.porConfirmar > 0 ? ' · ${datos.porConfirmar} por confirmar' : ''}'
                        ' · ${dinero(datos.previstoCentavos)}',
                style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
              ),
            ],
          ),
          if (especialistas.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                // El mismo hueco que ocupa la columna de horas en la rejilla.
                const SizedBox(width: 38),
                for (final persona in especialistas)
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: Marca.desdeHex(persona.color),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            persona.nombre,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Cerrado extends StatelessWidget {
  const _Cerrado({required this.dia, required this.alAgendar});

  final DateTime dia;
  final VoidCallback alAgendar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bedtime_outlined, size: 36, color: Marca.textoSuave),
            const SizedBox(height: 12),
            Text('El estudio está cerrado', style: titulo(21)),
            const SizedBox(height: 4),
            Text(
              fechaLarga(dia),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13.5, color: Marca.textoSuave),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: alAgendar,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Agendar de todos modos'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DatosDia {
  _DatosDia({
    required this.citas,
    required this.especialistas,
    required this.total,
    required this.porConfirmar,
    required this.previstoCentavos,
  });

  final List<Cita> citas;
  final List<Especialista> especialistas;
  final int total;
  final int porConfirmar;
  final int previstoCentavos;

  factory _DatosDia.desdeJson(Map<String, dynamic> j) {
    final contadores = j['contadores'] as Map<String, dynamic>;
    return _DatosDia(
      citas: [
        for (final c in (j['citas'] as List)) Cita.desdeJson(c as Map<String, dynamic>),
      ],
      especialistas: [
        for (final e in (j['especialistas'] as List))
          Especialista(
            id: (e as Map)['id'] as String,
            nombre: e['nombre'] as String,
            color: e['color'] as String,
            servicioIds: const [],
          ),
      ],
      total: contadores['total'] as int,
      porConfirmar: contadores['porConfirmar'] as int,
      previstoCentavos: j['previstoCentavos'] as int,
    );
  }
}
