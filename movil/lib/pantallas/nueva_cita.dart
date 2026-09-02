import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import 'elegir_clienta.dart';

/// Agendar en cuatro decisiones: clienta, servicios, día y hora.
///
/// Los huecos los calcula el servidor con las mismas reglas que la web, así
/// que la app nunca ofrece una hora que luego se rechace.
class PantallaNuevaCita extends StatefulWidget {
  const PantallaNuevaCita({super.key, this.diaSugerido, this.clientaPreseleccionada});

  final String? diaSugerido;
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
    final elegibles = _especialistasElegibles;
    _especialistaId = elegibles.isEmpty ? null : elegibles.first.id;
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

  /// Solo ofrecemos a quien sabe hacer todo lo seleccionado.
  List<Especialista> get _especialistasElegibles {
    if (_servicioIds.isEmpty) return _catalogo.especialistas;
    return _catalogo.especialistas.where((e) => e.puedeHacer(_servicioIds)).toList();
  }

  /// Si la elegida deja de poder hacerlo todo, se corrige al vuelo.
  String? get _especialistaActivo {
    final elegibles = _especialistasElegibles;
    if (elegibles.any((e) => e.id == _especialistaId)) return _especialistaId;
    return elegibles.isEmpty ? null : elegibles.first.id;
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

      final huecos = [
        for (final h in (datos['huecos'] as List))
          Hueco.desdeJson(h as Map<String, dynamic>),
      ];
      setState(() {
        _huecos = huecos;
        _motivoSinHuecos = datos['motivo'] as String?;
        if (_hora != null && !huecos.any((h) => h.hora == _hora)) _hora = null;
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

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
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

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cita agendada.')),
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

  @override
  Widget build(BuildContext context) {
    final listo = _clienta != null && _servicioIds.isNotEmpty && _hora != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva cita')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
        children: [
          _Seccion(
            rotulo: '¿Para quién?',
            hijo: _SelectorClienta(
              clienta: _clienta,
              prefijo: _catalogo.negocio.prefijo,
              alElegir: (c) => setState(() => _clienta = c),
            ),
          ),
          _Seccion(
            rotulo: 'Elige el servicio',
            subtitulo: 'Puedes combinar más de uno. El tiempo se suma solo.',
            hijo: _ListaServicios(
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
                      onSelected: (_) {
                        setState(() => _especialistaId = e.id);
                        _recargarHuecos();
                      },
                      avatar: CircleAvatar(
                        backgroundColor: Marca.desdeHex(e.color),
                        radius: 7,
                      ),
                      selectedColor: Marca.dorado.withValues(alpha: 0.25),
                    ),
                ],
              ),
            ),
          _Seccion(
            rotulo: 'Elige el día',
            subtitulo: _servicioIds.isEmpty
                ? 'Primero elige al menos un servicio.'
                : 'La cita dura ${duracion(_duracionMin)}.',
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
                  const Icon(Icons.error_outline, size: 18, color: Marca.error),
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
      bottomSheet: _BarraResumen(
        servicios: _seleccionados.map((s) => s.nombre).join(' + '),
        duracionMin: _duracionMin,
        totalCentavos: _totalCentavos,
        tasa: _catalogo.tasa,
        hora: _hora,
        listo: listo,
        guardando: _guardando,
        alConfirmar: _guardar,
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
        icon: const Icon(Icons.person_search_outlined, size: 20),
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
            icon: const Icon(Icons.close, size: 20),
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
    required this.tasa,
    required this.alAlternar,
  });

  final List<Servicio> servicios;
  final List<String> seleccionados;
  final double tasa;
  final ValueChanged<String> alAlternar;

  @override
  Widget build(BuildContext context) {
    // Agrupamos por categoría manteniendo el orden que da la API.
    final grupos = <String, List<Servicio>>{};
    for (final s in servicios) {
      grupos.putIfAbsent(s.categoriaNombre, () => []).add(s);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                Text(
                  entrada.key.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Marca.textoSuave,
                  ),
                ),
              ],
            ),
          ),
          for (final s in entrada.value)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
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
                    ? const Icon(Icons.check, size: 15, color: Marca.negro)
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
              Icon(Icons.calendar_today_outlined, size: 17, color: Marca.textoSuave),
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
              padding: const EdgeInsets.only(bottom: 8),
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
  });

  final String servicios;
  final int duracionMin;
  final int totalCentavos;
  final double tasa;
  final String? hora;
  final bool listo;
  final bool guardando;
  final VoidCallback alConfirmar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
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
                      servicios.isEmpty ? 'Elige un servicio' : servicios,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      servicios.isEmpty
                          ? 'Servicio, día y hora'
                          : '${duracion(duracionMin)}'
                              '${hora != null ? ' · hora elegida' : ' · elige la hora'}',
                      style: const TextStyle(color: Marca.textoSuave, fontSize: 12),
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
                  : const Text('Confirmar cita'),
            ),
          ),
        ],
      ),
    );
  }
}
