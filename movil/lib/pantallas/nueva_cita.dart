import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'elegir_clienta.dart';

/// Agendar en cuatro decisiones: clienta, servicios, día y hora.
///
/// Los huecos los calcula el servidor con las mismas reglas que la web, así
/// que la app nunca ofrece una hora que luego se rechace.
class PantallaNuevaCita extends StatefulWidget {
  const PantallaNuevaCita({
    super.key,
    this.diaSugerido,
    this.especialistaSugerido,
    this.minutoSugerido,
    this.clientaPreseleccionada,
  });

  final String? diaSugerido;

  /// Al tocar la columna de alguien en el calendario, viene ya elegida.
  final String? especialistaSugerido;

  /// El minuto del día que se tocó en el calendario. Si a esa hora hay
  /// hueco, se elige sola.
  final int? minutoSugerido;
  final ClientaElegida? clientaPreseleccionada;

  @override
  State<PantallaNuevaCita> createState() => _PantallaNuevaCitaState();
}

class _PantallaNuevaCitaState extends State<PantallaNuevaCita> {
  ClientaElegida? _clienta;
  final _servicioIds = <String>[];
  String? _especialistaId;
  late String _dia;
  String? _hora;
  final _nota = TextEditingController();

  List<Hueco> _huecos = [];

  /// Lo que llevó la clienta la última vez. Repetirlo es un toque.
  List<String> _loDeSiempre = [];
  String _loDeSiempreTexto = '';
  bool _yaUseSugerencia = false;
  String? _motivoSinHuecos;
  bool _cargandoHuecos = false;
  bool _guardando = false;
  String? _error;
  int _peticion = 0;

  Catalogo get _catalogo => Sesion.catalogo!;

  @override
  void initState() {
    super.initState();
    _clienta = widget.clientaPreseleccionada;
    _dia = widget.diaSugerido ?? _catalogo.hoy;
  }



  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // La primera vez elegimos por ella: la columna que tocó, o ella misma,
    // que es para quien agenda casi siempre.
    if (_especialistaId != null) return;
    final elegibles = _especialistasElegibles;
    final yo = Sesion.de(context).miEspecialistaId;
    _especialistaId = widget.especialistaSugerido ??
        (elegibles.any((e) => e.id == yo) ? yo : null) ??
        (elegibles.isEmpty ? null : elegibles.first.id);

    if (_clienta?.id case final id?) _cargarLoDeSiempre(id);
  }

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  List<Servicio> get _seleccionados =>
      _catalogo.servicios.where((s) => _servicioIds.contains(s.id)).toList();

  int get _totalCentavos =>
      _seleccionados.fold(0, (suma, s) => suma + s.precioCentavos);

  int get _duracionMin => _seleccionados.fold(0, (suma, s) => suma + s.duracionMin);

  /// Solo ofrecemos a quien sabe hacer todo lo seleccionado. Con reparto no
  /// se elige a nadie: van las dos.
  List<Especialista> get _especialistasElegibles {
    if (_servicioIds.isEmpty) return _catalogo.especialistas;
    if (_reparteEntreDos) return const [];
    return _catalogo.especialistas.where((e) => e.puedeHacer(_servicioIds)).toList();
  }

  /// Si la elegida deja de poder hacerlo todo, se corrige al vuelo.
  String? get _especialistaActivo {
    final elegibles = _especialistasElegibles;
    if (elegibles.any((e) => e.id == _especialistaId)) return _especialistaId;
    return elegibles.isEmpty ? null : elegibles.first.id;
  }

  /// Dos áreas en el estudio: uñas y pies (Alejandra) y depilación (Arianny).
  /// Si la cita mezcla las dos, se reparte por área —aunque alguna sepa
  /// hacer algo de la otra, como las cejas— y cada quien atiende lo suyo a
  /// la misma hora. Misma regla que aplica el servidor en la web.
  Set<String> get _areas => {for (final s in _seleccionados) s.area};

  bool get _reparteEntreDos {
    if (_areas.length < 2) return false;
    return _gruposReparto.length >= 2 || _serviciosSinDueno.isNotEmpty;
  }

  /// Para cada área, quien cubra todo lo pedido de esa área prefiriendo a
  /// la que menos hace de la otra: la especialista de verdad.
  Map<Especialista, List<Servicio>> get _gruposReparto {
    final mapa = <Especialista, List<Servicio>>{};
    if (_areas.length < 2) return mapa;

    for (final area in _areas) {
      final delArea = _seleccionados.where((s) => s.area == area).toList();
      final otras = _seleccionados.where((s) => s.area != area).toList();

      Especialista? mejor;
      var peso = 1 << 30;
      for (final e in _catalogo.especialistas) {
        if (!delArea.every((s) => e.puedeHacer([s.id]))) continue;
        final p = otras.where((s) => e.puedeHacer([s.id])).length;
        if (p < peso) {
          mejor = e;
          peso = p;
        }
      }
      if (mejor == null) continue;
      mapa.putIfAbsent(mejor, () => []).addAll(delArea);
    }
    return mapa;
  }

  /// Un servicio que nadie del equipo sabe hacer: no debería pasar, pero si
  /// pasa hay que avisar en vez de dejar la cita coja.
  List<Servicio> get _serviciosSinDueno {
    final grupos = _gruposReparto;
    final cubiertos = grupos.values.expand((l) => l).map((s) => s.id).toSet();
    return _seleccionados.where((s) => !cubiertos.contains(s.id)).toList();
  }

  /// La duración que se le enseña a la clienta: si se reparte entre dos, lo
  /// que tarda es lo que tarde la más larga de las dos, no la suma —
  /// trabajan a la vez, no una detrás de otra.
  int get _duracionMostrada {
    if (!_reparteEntreDos) return _duracionMin;
    final grupos = _gruposReparto.values;
    if (grupos.isEmpty) return _duracionMin;
    return grupos
        .map((l) => l.fold(0, (suma, s) => suma + s.duracionMin))
        .reduce((a, b) => a > b ? a : b);
  }

  Future<void> _recargarHuecos() async {
    if (_servicioIds.isEmpty) {
      setState(() {
        _huecos = [];
        _hora = null;
      });
      return;
    }

    final id = ++_peticion;
    setState(() => _cargandoHuecos = true);

    try {
      List<Hueco> huecos;
      String? motivo;

      if (_reparteEntreDos) {
        final resultado = await _huecosRepartidos();
        if (id != _peticion || !mounted) return;
        huecos = resultado.$1;
        motivo = resultado.$2;
      } else {
        final datos = await Sesion.de(context).obtener(
          '/api/v1/huecos',
          params: {
            'dia': _dia,
            'servicios': _servicioIds.join(','),
            if (_especialistaActivo case final e?) 'especialista': e,
          },
        );
        // Descartamos respuestas que llegan tarde.
        if (id != _peticion || !mounted) return;
        huecos = [
          for (final h in (datos['huecos'] as List))
            Hueco.desdeJson(h as Map<String, dynamic>),
        ];
        motivo = datos['motivo'] as String?;
      }

      setState(() {
        _huecos = huecos;
        _motivoSinHuecos = motivo;
        if (_hora != null && !huecos.any((h) => h.hora == _hora)) _hora = null;

        // Si se llegó tocando un hueco del calendario y a esa hora cabe,
        // no hay nada más que elegir.
        if (!_yaUseSugerencia && _hora == null) {
          _yaUseSugerencia = true;
          if (widget.minutoSugerido case final minuto?) {
            final buscada =
                '${(minuto ~/ 60).toString().padLeft(2, '0')}:'
                '${(minuto % 60).toString().padLeft(2, '0')}';
            if (huecos.any((h) => h.hora == buscada)) _hora = buscada;
          }
        }
      });
    } on ErrorApi catch (e) {
      if (mounted && id == _peticion) {
        setState(() {
          _huecos = [];
          _motivoSinHuecos = e.mensaje;
        });
      }
    } finally {
      if (mounted && id == _peticion) setState(() => _cargandoHuecos = false);
    }
  }

  /// Pide los huecos de cada especialista implicada por separado —cada una
  /// con solo su parte de los servicios— y se queda con las horas en las que
  /// las dos coinciden libres a la vez.
  Future<(List<Hueco>, String?)> _huecosRepartidos() async {
    final grupos = _gruposReparto;
    if (grupos.length < 2 || _serviciosSinDueno.isNotEmpty) {
      final quien =
          _serviciosSinDueno.isEmpty ? null : _serviciosSinDueno.first.nombre;
      return (
        <Hueco>[],
        quien != null
            ? 'Nadie del equipo hace "$quien" todavía.'
            : 'No hay quien haga esta combinación.',
      );
    }

    final respuestas = await Future.wait([
      for (final entrada in grupos.entries)
        Sesion.de(context).obtener('/api/v1/huecos', params: {
          'dia': _dia,
          'servicios': entrada.value.map((s) => s.id).join(','),
          'especialista': entrada.key.id,
        }),
    ]);

    final listasDeHoras = [
      for (final datos in respuestas)
        {
          for (final h in (datos['huecos'] as List)) (h as Map)['hora'] as String,
        },
    ];
    final horasComunes = listasDeHoras.reduce((a, b) => a.intersection(b));

    final huecos = [
      for (final h in (respuestas.first['huecos'] as List))
        Hueco.desdeJson(h as Map<String, dynamic>),
    ].where((h) => horasComunes.contains(h.hora)).toList();

    final nombres = grupos.keys.map((e) => e.nombre).join(' y ');
    return (huecos, huecos.isEmpty ? '$nombres no coinciden libres ese día.' : null);
  }

  /// Lee la última visita de la clienta para poder repetirla de un toque.
  /// Si falla, simplemente no aparece el atajo.
  Future<void> _cargarLoDeSiempre(String? clientaId) async {
    setState(() {
      _loDeSiempre = [];
      _loDeSiempreTexto = '';
    });
    if (clientaId == null) return;

    try {
      final datos = await Sesion.de(context).obtener('/api/v1/clientas/$clientaId');
      final historial = datos['historial'] as List;
      if (historial.isEmpty || !mounted) return;

      final ultima = historial.first as Map<String, dynamic>;
      final ids = [
        for (final s in (ultima['servicioIds'] as List? ?? const [])) s as String,
      ].where((id) => _catalogo.servicios.any((s) => s.id == id)).toList();
      if (ids.isEmpty) return;

      setState(() {
        _loDeSiempre = ids;
        _loDeSiempreTexto = [
          for (final s in (ultima['servicios'] as List)) s as String,
        ].join(' + ');
      });
    } on ErrorApi {
      // El atajo es una comodidad: sin él la pantalla funciona igual.
    }
  }

  void _repetirLoDeSiempre() {
    setState(() {
      _servicioIds
        ..clear()
        ..addAll(_loDeSiempre);
    });
    _recargarHuecos();
  }

  void _alternarServicio(String id) {
    setState(() {
      if (_servicioIds.contains(id)) {
        _servicioIds.remove(id);
      } else {
        _servicioIds.add(id);
      }
    });
    _recargarHuecos();
  }

  Future<void> _guardar() async {
    if (_clienta == null || _servicioIds.isEmpty || _hora == null) return;
    if (_reparteEntreDos && _serviciosSinDueno.isNotEmpty) return;

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
      if (_reparteEntreDos) {
        await _guardarRepartida();
      } else {
        await Sesion.de(context).enviar('/api/v1/citas', {
          if (_clienta!.id != null) 'clientaId': _clienta!.id,
          if (_clienta!.id == null) 'clientaNombre': _clienta!.nombre,
          if (_clienta!.id == null) 'clientaTelefono': _clienta!.telefono,
          'especialistaId': _especialistaActivo,
          'servicioIds': _servicioIds,
          'dia': _dia,
          'hora': _hora,
          if (_nota.text.trim().isNotEmpty) 'nota': _nota.text.trim(),
        });
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _reparteEntreDos ? 'Quedaron las dos citas agendadas.' : 'Cita agendada.',
          ),
        ),
      );
      Navigator.pop(context, true);
    } on ErrorApi catch (e) {
      if (mounted) {
        setState(() => _error = e.mensaje);
        // El hueco pudo ocuparse mientras elegía: refrescamos.
        _recargarHuecos();
      }
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  /// Una cita por especialista, mismo día y misma hora —cada quien atiende
  /// su parte a la vez—. La segunda reutiliza la clienta que acaba de crear
  /// la primera, para no duplicarla si era nueva.
  Future<void> _guardarRepartida() async {
    String? clientaId = _clienta!.id;
    final yaCreadas = <String>[];

    try {
      for (final entrada in _gruposReparto.entries) {
        final respuesta = await Sesion.de(context).enviar('/api/v1/citas', {
          if (clientaId != null) 'clientaId': clientaId,
          if (clientaId == null) 'clientaNombre': _clienta!.nombre,
          if (clientaId == null) 'clientaTelefono': _clienta!.telefono,
          'especialistaId': entrada.key.id,
          'servicioIds': [for (final s in entrada.value) s.id],
          'dia': _dia,
          'hora': _hora,
          if (_nota.text.trim().isNotEmpty) 'nota': _nota.text.trim(),
        });
        clientaId ??= ((respuesta['cita'] as Map)['clienta'] as Map?)?['id'] as String?;
        yaCreadas.add(entrada.key.nombre);
      }
    } on ErrorApi catch (e) {
      if (yaCreadas.isEmpty) rethrow;
      throw ErrorApi(
        'Quedó agendado con ${yaCreadas.join(" y ")}, pero no con quien faltaba: ${e.mensaje}',
      );
    }
  }

  /// Qué falta para poder confirmar, en el mismo orden en que se pide.
  /// Null cuando ya no falta nada.
  String? get _queFalta {
    if (_clienta == null) return 'Elige la clienta';
    if (_servicioIds.isEmpty) return 'Elige el servicio';
    if (_hora == null) return 'Elige la hora';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final listo = _queFalta == null;

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva cita')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _Seccion(
            rotulo: '¿Para quién?',
            hijo: _SelectorClienta(
              clienta: _clienta,
              prefijo: _catalogo.negocio.prefijo,
              alElegir: (c) {
                setState(() => _clienta = c);
                _cargarLoDeSiempre(c?.id);
              },
            ),
          ),
          if (_loDeSiempre.isNotEmpty && _servicioIds.isEmpty)
            _Seccion(
              rotulo: 'Lo de siempre',
              subtitulo: 'Lo que se llevó la última vez',
              hijo: _Atajo(
                texto: _loDeSiempreTexto,
                alTocar: _repetirLoDeSiempre,
              ),
            ),
          _Seccion(
            rotulo: 'Elige el servicio',
            subtitulo: 'Puedes combinar más de uno. El tiempo se suma solo.',
            hijo: _ListaServicios(
              masPedidos: _catalogo.masPedidos,
              servicios: _catalogo.servicios,
              seleccionados: _servicioIds,
              tasa: _catalogo.tasa,
              alAlternar: _alternarServicio,
            ),
          ),
          if (_especialistasElegibles.length > 1)
            _Seccion(
              rotulo: '¿Con quién?',
              hijo: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in _especialistasElegibles)
                    ChoiceChip(
                      label: Text(e.nombre),
                      selected: _especialistaActivo == e.id,
                      showCheckmark: false,
                      onSelected: (_) {
                        setState(() => _especialistaId = e.id);
                        _recargarHuecos();
                      },
                      avatar: CircleAvatar(
                        backgroundColor: Marca.desdeHex(e.color),
                        radius: 7,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                        color: _especialistaActivo == e.id
                            ? Colors.white
                            : Marca.textoSuave,
                      ),
                    ),
                ],
              ),
            ),
          if (_reparteEntreDos && _serviciosSinDueno.isEmpty)
            _Seccion(
              rotulo: '¿Con quién?',
              subtitulo: 'Nadie hace las dos cosas: se reparte sola.',
              hijo: _Reparto(grupos: _gruposReparto),
            ),
          if (_reparteEntreDos && _serviciosSinDueno.isNotEmpty)
            _Seccion(
              rotulo: '¿Con quién?',
              hijo: Aviso(
                icono: Ico.atencion,
                color: Marca.alerta,
                texto:
                    'Nadie del equipo hace "${_serviciosSinDueno.first.nombre}" todavía.',
              ),
            ),
          _Seccion(
            rotulo: 'Elige el día',
            subtitulo: _servicioIds.isEmpty
                ? 'Primero elige al menos un servicio.'
                : 'La cita dura ${duracion(_duracionMostrada)}.',
            hijo: _SelectorDia(
              dia: _dia,
              desde: _catalogo.hoy,
              hasta: _catalogo.maxDia,
              alElegir: (d) {
                setState(() => _dia = d);
                _recargarHuecos();
              },
            ),
          ),
          _Seccion(
            rotulo: 'Elige la hora',
            hijo: _servicioIds.isEmpty
                ? _Mensaje('Elige un servicio y te mostramos los horarios libres.')
                : _cargandoHuecos
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _huecos.isEmpty
                        ? _Mensaje(_motivoSinHuecos ??
                            'Ese día no queda un hueco de esa duración.')
                        : _ListaHoras(
                            huecos: _huecos,
                            hora: _hora,
                            alElegir: (h) => setState(() => _hora = h),
                          ),
          ),
          _Seccion(
            rotulo: 'Nota',
            subtitulo: 'Opcional · diseño, llegada tarde, algo que debas saber',
            hijo: TextField(
              controller: _nota,
              maxLines: 3,
              maxLength: 400,
              decoration: const InputDecoration(
                hintText: 'Ej.: quiere francesa con dorado',
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Ico.error, size: 18, color: Marca.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Marca.error, fontSize: 13.5),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: _BarraResumen(
          servicios: _seleccionados.map((s) => s.nombre).join(' + '),
          duracionMin: _duracionMin,
          totalCentavos: _totalCentavos,
          tasa: _catalogo.tasa,
          hora: _hora,
          listo: listo,
          falta: _queFalta,
          guardando: _guardando,
          alConfirmar: _guardar,
        ),
      ),
    );
  }
}

class _Seccion extends StatelessWidget {
  const _Seccion({required this.rotulo, required this.hijo, this.subtitulo});

  final String rotulo;
  final String? subtitulo;
  final Widget hijo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: titulo(20)),
          if (subtitulo != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitulo!,
              style: const TextStyle(color: Marca.textoSuave, fontSize: 13.5),
            ),
          ],
          const SizedBox(height: 12),
          hijo,
        ],
      ),
    );
  }
}

/// Quién hace qué, cuando la cita se reparte entre dos especialistas.
class _Reparto extends StatelessWidget {
  const _Reparto({required this.grupos});

  final Map<Especialista, List<Servicio>> grupos;

  @override
  Widget build(BuildContext context) {
    final entradas = grupos.entries.toList();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Marca.tarjeta,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < entradas.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: CircleAvatar(
                    backgroundColor: Marca.desdeHex(entradas[i].key.color),
                    radius: 5,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: sutil(13.5),
                      children: [
                        TextSpan(
                          text: '${entradas[i].key.nombre}: ',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Marca.texto,
                          ),
                        ),
                        TextSpan(
                          text: entradas[i].value.map((s) => s.nombre).join(' + '),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Text('Las dos citas quedan a la misma hora.', style: micro()),
        ],
      ),
    );
  }
}

class _Mensaje extends StatelessWidget {
  const _Mensaje(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      decoration: BoxDecoration(
        color: Marca.fondo,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        texto,
        textAlign: TextAlign.center,
        style: const TextStyle(color: Marca.textoSuave, fontSize: 13.5),
      ),
    );
  }
}

class _SelectorClienta extends StatelessWidget {
  const _SelectorClienta({
    required this.clienta,
    required this.prefijo,
    required this.alElegir,
  });

  final ClientaElegida? clienta;
  final String prefijo;
  final ValueChanged<ClientaElegida?> alElegir;

  @override
  Widget build(BuildContext context) {
    if (clienta == null) {
      return OutlinedButton.icon(
        onPressed: () async {
          final elegida = await Navigator.push<ClientaElegida>(
            context,
            MaterialPageRoute(builder: (_) => const PantallaElegirClienta()),
          );
          if (elegida != null) alElegir(elegida);
        },
        icon: const Icon(Ico.buscarClienta, size: 20),
        label: const Text('Elegir clienta'),
        style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 54)),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Marca.dorado.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Marca.dorado),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: Marca.dorado,
            radius: 20,
            child: Text(
              iniciales(clienta!.nombre),
              style: const TextStyle(
                color: Marca.negro,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  clienta!.nombre,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                Text(
                  clienta!.id == null
                      ? 'Nueva · ${telefonoBonito(clienta!.telefono, prefijo)}'
                      : telefonoBonito(clienta!.telefono, prefijo),
                  style: const TextStyle(color: Marca.textoSuave, fontSize: 12.5),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => alElegir(null),
            icon: const Icon(Ico.cerrar, size: 20),
            tooltip: 'Cambiar de clienta',
          ),
        ],
      ),
    );
  }
}

class _ListaServicios extends StatelessWidget {
  const _ListaServicios({
    required this.servicios,
    required this.seleccionados,
    required this.masPedidos,
    required this.tasa,
    required this.alAlternar,
  });

  final List<Servicio> servicios;
  final List<String> seleccionados;
  final List<String> masPedidos;
  final double tasa;
  final ValueChanged<String> alAlternar;

  @override
  Widget build(BuildContext context) {
    // Agrupamos por categoría manteniendo el orden que da la API.
    final grupos = <String, List<Servicio>>{};
    for (final s in servicios) {
      grupos.putIfAbsent(s.categoriaNombre, () => []).add(s);
    }

    // Lo que más se pide, arriba del todo: casi siempre la cita es una de
    // estas, y así no hay que recorrer el catálogo entero.
    final frecuentes = [
      for (final id in masPedidos)
        if (servicios.where((s) => s.id == id).firstOrNull case final s?) s,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (frecuentes.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('LOS MÁS PEDIDOS', style: micro()),
          ),
          for (final servicio in frecuentes.take(4))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _FilaServicio(
                servicio: servicio,
                elegido: seleccionados.contains(servicio.id),
                tasa: tasa,
                alTocar: () => alAlternar(servicio.id),
              ),
            ),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('TODO EL CATÁLOGO', style: micro()),
          ),
        ],
        for (final entrada in grupos.entries) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: Marca.desdeHex(entrada.value.first.categoriaColor),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(entrada.key.toUpperCase(), style: micro()),
              ],
            ),
          ),
          for (final s in entrada.value)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _FilaServicio(
                servicio: s,
                elegido: seleccionados.contains(s.id),
                tasa: tasa,
                alTocar: () => alAlternar(s.id),
              ),
            ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _FilaServicio extends StatelessWidget {
  const _FilaServicio({
    required this.servicio,
    required this.elegido,
    required this.tasa,
    required this.alTocar,
  });

  final Servicio servicio;
  final bool elegido;
  final double tasa;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: elegido ? Marca.dorado.withValues(alpha: 0.1) : Marca.tarjeta,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: elegido ? Marca.dorado : Marca.borde),
          ),
          child: Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: elegido ? Marca.dorado : Colors.transparent,
                  border: Border.all(
                    color: elegido ? Marca.dorado : Marca.borde,
                    width: 2,
                  ),
                ),
                child: elegido
                    ? const Icon(Ico.listo, size: 15, color: Marca.negro)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      servicio.nombre,
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14.5),
                    ),
                    Text(
                      '${duracion(servicio.duracionMin)}'
                      '${servicio.zona != null ? ' · ${servicio.zona}' : ''}',
                      style: const TextStyle(color: Marca.textoSuave, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(dinero(servicio.precioCentavos), style: cifra(14.5)),
                  if (tasa > 0)
                    Text(
                      bolivares(servicio.precioCentavos, tasa),
                      style: const TextStyle(fontSize: 11, color: Marca.textoSuave),
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

class _SelectorDia extends StatelessWidget {
  const _SelectorDia({
    required this.dia,
    required this.desde,
    required this.hasta,
    required this.alElegir,
  });

  final String dia;
  final String desde;
  final String hasta;
  final ValueChanged<String> alElegir;

  static const _nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  @override
  Widget build(BuildContext context) {
    final inicio = DateTime.parse(desde);
    final dias = List.generate(21, (i) => inicio.add(Duration(days: i)));

    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: dias.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          if (i == dias.length) {
            return _BotonCalendario(
              dia: dia,
              desde: desde,
              hasta: hasta,
              alElegir: alElegir,
            );
          }

          final fecha = dias[i];
          final clave = claveDia(fecha);
          final activo = clave == dia;

          return Material(
            color: activo ? Marca.dorado : Marca.tarjeta,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: () => alElegir(clave),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 66,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: activo ? Marca.dorado : Marca.borde),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      i == 0
                          ? 'Hoy'
                          : i == 1
                              ? 'Mañana'
                              : _nombres[fecha.weekday % 7],
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: activo
                            ? Marca.negro.withValues(alpha: 0.7)
                            : Marca.textoSuave,
                      ),
                    ),
                    Text(
                      '${fecha.day}',
                      style: cifra(19, color: activo ? Marca.negro : Marca.texto),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BotonCalendario extends StatelessWidget {
  const _BotonCalendario({
    required this.dia,
    required this.desde,
    required this.hasta,
    required this.alElegir,
  });

  final String dia;
  final String desde;
  final String hasta;
  final ValueChanged<String> alElegir;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Marca.tarjeta,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          final elegida = await showDatePicker(
            context: context,
            initialDate: DateTime.parse(dia),
            firstDate: DateTime.parse(desde),
            lastDate: DateTime.parse(hasta),
            locale: const Locale('es'),
          );
          if (elegida != null) alElegir(claveDia(elegida));
        },
        child: Container(
          width: 62,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Marca.borde),
          ),
          child: const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Ico.agenda, size: 17, color: Marca.textoSuave),
              SizedBox(height: 5),
              Text(
                'Otro día',
                style: TextStyle(fontSize: 9.5, color: Marca.textoSuave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ListaHoras extends StatelessWidget {
  const _ListaHoras({
    required this.huecos,
    required this.hora,
    required this.alElegir,
  });

  final List<Hueco> huecos;
  final String? hora;
  final ValueChanged<String> alElegir;

  static const _franjas = [
    ('morning', 'Mañana'),
    ('afternoon', 'Tarde'),
    ('evening', 'Noche'),
  ];

  /// "14:30" -> "2:30 pm"
  String _bonita(String h) {
    final partes = h.split(':');
    final hh = int.parse(partes[0]);
    final sufijo = hh < 12 ? 'am' : 'pm';
    final doce = hh % 12 == 0 ? 12 : hh % 12;
    return '$doce:${partes[1]} $sufijo';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (clave, etiqueta) in _franjas)
          if (huecos.any((h) => h.franja == clave)) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                etiqueta.toUpperCase(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Marca.textoSuave,
                ),
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final h in huecos.where((h) => h.franja == clave))
                  Material(
                    color: hora == h.hora ? Marca.dorado : Marca.tarjeta,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: () => alElegir(h.hora),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: hora == h.hora ? Marca.dorado : Marca.borde,
                          ),
                        ),
                        child: Text(
                          _bonita(h.hora),
                          style: cifra(
                            13.5,
                            color: hora == h.hora ? Marca.negro : Marca.texto,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
          ],
      ],
    );
  }
}

/// Resumen fijo abajo: siempre visible mientras se elige.
class _BarraResumen extends StatelessWidget {
  const _BarraResumen({
    required this.servicios,
    required this.duracionMin,
    required this.totalCentavos,
    required this.tasa,
    required this.hora,
    required this.listo,
    required this.guardando,
    required this.alConfirmar,
    required this.falta,
  });

  final String servicios;
  final int duracionMin;
  final int totalCentavos;
  final double tasa;
  final String? hora;
  final bool listo;
  final bool guardando;
  final VoidCallback alConfirmar;

  /// Lo primero que falta para poder confirmar, en el orden en que se pide.
  final String? falta;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Marca.tarjeta,
        border: Border(top: BorderSide(color: Marca.borde)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      servicios.isEmpty ? 'Sin servicios todavía' : servicios,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        letterSpacing: -0.2,
                      ),
                    ),
                    Text(
                      falta ??
                          '${duracion(duracionMin)} · todo listo',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sutil(
                        12.5,
                        color: falta == null ? Marca.exito : Marca.alerta,
                        peso: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(dinero(totalCentavos), style: cifra(19)),
                  if (tasa > 0)
                    Text(
                      bolivares(totalCentavos, tasa),
                      style: const TextStyle(fontSize: 11, color: Marca.textoSuave),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: listo && !guardando ? alConfirmar : null,
              child: guardando
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Marca.negro,
                      ),
                    )
                  : Text(falta ?? 'Confirmar cita'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Repetir la última cita de la clienta. En un estudio, la mayoría de las
/// citas son la de antes otra vez.
class _Atajo extends StatelessWidget {
  const _Atajo({required this.texto, required this.alTocar});

  final String texto;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Marca.dorado.withValues(alpha: 0.14),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(14),
        hoverColor: Marca.dorado.withValues(alpha: 0.22),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
          child: Row(
            children: [
              const Icon(Ico.repetir, size: 18, color: Marca.negro),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  texto,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('Repetir', style: sutil(13, peso: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}
