import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/calendario.dart';
import '../widgets/animar.dart';
import '../widgets/comunes.dart';
import '../widgets/rejilla_dia.dart';
import '../widgets/rejilla_semana.dart';
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

  /// Día o semana. Se queda como se dejó mientras la app esté abierta: quien
  /// mira por semanas suele seguir mirando por semanas.
  bool _porSemana = false;
  Future<_DatosSemana>? _futuroSemana;
  String? _semanaCargada;
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

  /// El lunes de la semana de un día. La semana empieza en lunes porque el
  /// domingo el estudio está cerrado y molesta verlo primero.
  static DateTime _lunesDe(DateTime f) =>
      DateTime(f.year, f.month, f.day).subtract(Duration(days: f.weekday - 1));

  Future<_DatosSemana> _cargarSemana() async {
    final lunes = _lunesDe(_dia);
    final datos = await Sesion.de(context).obtener(
      '/api/v1/agenda/semana',
      params: {'desde': claveDia(lunes)},
    );
    return _DatosSemana.desdeJson(datos, lunes);
  }

  void _mirarLaSemana(bool si) {
    setState(() {
      _porSemana = si;
      if (si) {
        _semanaCargada = claveDia(_lunesDe(_dia));
        _futuroSemana = _cargarSemana();
      }
    });
  }

  /// Al cambiar de día dentro de la misma semana no se vuelve a pedir: son
  /// los mismos siete días.
  void _asegurarSemana() {
    final clave = claveDia(_lunesDe(_dia));
    if (clave == _semanaCargada) return;
    _semanaCargada = clave;
    _futuroSemana = _cargarSemana();
  }

  Future<void> _refrescar() async {
    _mesCargado = null;
    _semanaCargada = null;
    final futuro = _cargarDia();
    setState(() {
      _futuro = futuro;
      if (_porSemana) _asegurarSemana();
    });
    await Future.wait([futuro, _cargarMes()]);
  }

  void _irA(DateTime dia) {
    setState(() {
      _dia = DateTime(dia.year, dia.month, dia.day);
      _futuro = _cargarDia();
      if (_porSemana) _asegurarSemana();
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

  // Para no depender de tocar "siguiente" treinta veces cuando la fecha
  // que se busca está lejos: un calendario completo con mes y año a mano.
  Future<void> _saltarAFecha() async {
    final elegido = await showDatePicker(
      context: context,
      initialDate: _dia,
      firstDate: DateTime(_hoy.year - 2),
      lastDate: DateTime(_hoy.year + 2),
      helpText: 'Ir a una fecha',
      cancelText: 'Cancelar',
      confirmText: 'Ir',
    );
    if (elegido != null) _irA(elegido);
  }

  Future<void> _agendar({String? especialistaId, int? minuto}) async {
    final creada = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PantallaNuevaCita(
          diaSugerido: claveDia(_dia),
          especialistaSugerido: especialistaId,
          minutoSugerido: minuto,
        ),
      ),
    );
    if (creada == true) _refrescar();
  }

  Future<void> _abrirCita(Cita cita) => _abrirCitaPorId(cita.id);

  Future<void> _abrirCitaPorId(String id) async {
    final cambio = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PantallaCitaDetalle(citaId: id)),
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
        icon: const Icon(Ico.agregar),
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
                    // En la vista de semana las flechas mueven una semana:
                    // saltar un mes entero desde ahí no lleva a ningún sitio
                    // que se estuviera mirando.
                    onPressed: () => _porSemana
                        ? _irA(_dia.subtract(const Duration(days: 7)))
                        : _saltarMes(-1),
                    icon: const Icon(Ico.anterior),
                    tooltip: _porSemana ? 'Semana anterior' : 'Mes anterior',
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
                    onPressed: () => _porSemana
                        ? _irA(_dia.add(const Duration(days: 7)))
                        : _saltarMes(1),
                    icon: const Icon(Ico.siguiente),
                    tooltip: _porSemana ? 'Semana siguiente' : 'Mes siguiente',
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
                  IconButton(
                    onPressed: _saltarAFecha,
                    icon: const Icon(Ico.agenda),
                    tooltip: 'Ir a una fecha',
                  ),
                ],
              ),
            ),
            if (!_porSemana)
              Despliega(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Calendario(
                    seleccionado: _dia,
                    hoy: hoy,
                    conteos: _conteos,
                    expandido: _mesAbierto,
                    alElegir: _irA,
                    alAlternar: () => setState(() => _mesAbierto = !_mesAbierto),
                  ),
                ),
              ),
            const Divider(height: 1),
            _Alternador(
              porSemana: _porSemana,
              alCambiar: _mirarLaSemana,
            ),
            const Divider(height: 1),
            Expanded(
              child: _porSemana ? _semana(hoy) : _diaEntero(),
            ),
          ],
        ),
      ),
    );
  }

  /// La semana: siete columnas y las citas dibujadas encima.
  Widget _semana(DateTime hoy) {
    return FutureBuilder<_DatosSemana>(
      future: _futuroSemana,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return ErrorConReintento(
            mensaje: snap.error is ErrorApi
                ? (snap.error as ErrorApi).mensaje
                : 'No pudimos cargar la semana.',
            alReintentar: _refrescar,
          );
        }

        final datos = snap.data!;
        // El tramo de horas es el más ancho de los siete días: si el sábado
        // cierran antes, el resto de la semana no se recorta por eso.
        var desde = 24 * 60;
        var hasta = 0;
        for (final d in datos.dias) {
          final h = Sesion.catalogo?.horarioDe(d);
          if (h == null || !h.abierto) continue;
          if (h.desdeMin < desde) desde = h.desdeMin;
          if (h.hastaMin > hasta) hasta = h.hastaMin;
        }
        for (final c in datos.citas) {
          if (c.desdeMin < desde) desde = c.desdeMin;
          if (c.hastaMin > hasta) hasta = c.hastaMin;
        }
        if (hasta <= desde) {
          desde = 9 * 60;
          hasta = 18 * 60;
        }

        return RefreshIndicator(
          onRefresh: _refrescar,
          color: Marca.dorado,
          child: Padding(
            padding: const EdgeInsets.only(right: 6),
            child: RejillaSemana(
              dias: datos.dias,
              citas: datos.citas,
              hoy: hoy,
              seleccionado: _dia,
              desdeMin: (desde ~/ 60) * 60,
              hastaMin: ((hasta + 59) ~/ 60) * 60,
              alTocarCita: _abrirCitaPorId,
              alTocarDia: (d) {
                _irA(d);
                _mirarLaSemana(false);
              },
            ),
          ),
        );
      },
    );
  }

  Widget _diaEntero() {
    return FutureBuilder<_DatosDia>(
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
                      _Cabecera(fecha: _dia, datos: datos),
                      Expanded(
                        child: RefreshIndicator(
                          onRefresh: _refrescar,
                          color: Marca.dorado,
                          child: Cambia(
                            clave: claveDia(_dia),
                            child: Padding(
                              padding: const EdgeInsets.only(left: 6, right: 14),
                              child: RejillaDia(
                                citas: datos.citas,
                                especialistas: datos.especialistas,
                                horario: horario,
                                miEspecialistaId: Sesion.de(context).miEspecialistaId,
                                alTocarCita: _abrirCita,
                                alTocarHueco: (minuto, especialistaId) => _agendar(
                                  especialistaId: especialistaId,
                                  minuto: minuto,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
      },
    );
  }
}

/// El resumen del día y los nombres de las columnas, alineados con la rejilla.

/// Día o semana, en dos pestañas planas. No es un menú: son dos maneras de
/// mirar lo mismo y se alternan a menudo.
class _Alternador extends StatelessWidget {
  const _Alternador({required this.porSemana, required this.alCambiar});

  final bool porSemana;
  final ValueChanged<bool> alCambiar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      child: Row(
        children: [
          for (final (etiqueta, semana) in const [('Día', false), ('Semana', true)])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Material(
                color: porSemana == semana ? Marca.negro : Marca.tarjeta,
                borderRadius: BorderRadius.circular(20),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => alCambiar(semana),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                    child: Text(
                      etiqueta,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: porSemana == semana ? Colors.white : Marca.textoSuave,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Lo que devuelve la consulta de la semana, ya listo para pintar.
class _DatosSemana {
  _DatosSemana({required this.dias, required this.citas});

  final List<DateTime> dias;
  final List<CitaSemana> citas;

  factory _DatosSemana.desdeJson(Map<String, dynamic> j, DateTime lunes) {
    final colores = <String, Color>{
      for (final e in (j['especialistas'] as List? ?? []))
        (e as Map)['id'] as String: Marca.desdeHex(e['color'] as String?),
    };

    return _DatosSemana(
      dias: List.generate(7, (i) => lunes.add(Duration(days: i))),
      citas: [
        for (final c in (j['citas'] as List? ?? []))
          CitaSemana.desdeJson(c as Map<String, dynamic>, colores),
      ],
    );
  }
}

/// El resumen del día y los nombres de las columnas, alineados con la rejilla.
class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.fecha, required this.datos});

  final DateTime fecha;
  final _DatosDia datos;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 18, 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Marca.borde)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(diaYNumero(fecha), style: titulo(17)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  datos.citas.isEmpty
                    ? 'Sin citas'
                    : '${datos.total} '
                        '${datos.total == 1 ? 'cita' : 'citas'}'
                        '${datos.porConfirmar > 0 ? ' · ${datos.porConfirmar} por confirmar' : ''}'
                        ' · ${dinero(datos.previstoCentavos)}',
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sutil(12.5),
                ),
              ),
            ],
          ),
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
            const Icon(Ico.cerrado, size: 36, color: Marca.textoSuave),
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
              icon: const Icon(Ico.agregar, size: 18),
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

    // Una cita cancelada no ocupa sitio: ese hueco está libre de verdad.
    final citas = [
      for (final c in (j['citas'] as List)) Cita.desdeJson(c as Map<String, dynamic>),
    ]..removeWhere((cita) => cita.cancelada);

    return _DatosDia(
      citas: citas,
      especialistas: [
        for (final e in (j['especialistas'] as List))
          Especialista(
            id: (e as Map)['id'] as String,
            nombre: e['nombre'] as String,
            color: e['color'] as String,
            servicioIds: const [],
          ),
      ],
      // El número que se enseña es el de citas que de verdad se pintan.
      total: citas.length,
      porConfirmar: contadores['porConfirmar'] as int,
      previstoCentavos: j['previstoCentavos'] as int,
    );
  }
}
