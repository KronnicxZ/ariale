import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'cita_detalle.dart';
import 'nueva_cita.dart';

/// Agenda de un día, con navegación entre días y filtros por especialista
/// y estado. Es la pantalla que más se abre después de "Hoy".
class PantallaAgenda extends StatefulWidget {
  const PantallaAgenda({super.key, this.diaInicial});

  final String? diaInicial;

  @override
  State<PantallaAgenda> createState() => _PantallaAgendaState();
}

class _PantallaAgendaState extends State<PantallaAgenda> {
  String? _dia;
  String? _especialistaId;
  String? _estado;
  late Future<_DatosAgenda> _futuro;

  @override
  void initState() {
    super.initState();
    _dia = widget.diaInicial;
    _futuro = _cargar();
  }

  @override
  void didUpdateWidget(PantallaAgenda anterior) {
    super.didUpdateWidget(anterior);
    // Al llegar desde "Hoy" con un día concreto, saltamos a ese día.
    if (widget.diaInicial != null && widget.diaInicial != anterior.diaInicial) {
      _dia = widget.diaInicial;
      _futuro = _cargar();
    }
  }

  Future<_DatosAgenda> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/agenda',
      params: {
        if (_dia case final d?) 'dia': d,
        if (_especialistaId case final e?) 'especialista': e,
        if (_estado case final x?) 'estado': x,
      },
    );
    return _DatosAgenda.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  void _cambiarDia(String dia) {
    setState(() {
      _dia = dia;
      _futuro = _cargar();
    });
  }

  void _desplazarDia(int dias) {
    final actual = DateTime.parse(_dia ?? claveDia(DateTime.now()));
    _cambiarDia(claveDia(actual.add(Duration(days: dias))));
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<_DatosAgenda>(
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
            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.only(bottom: 28),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Agenda', style: titulo(29)),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            IconButton(
                              onPressed: () => _desplazarDia(-1),
                              icon: const Icon(Icons.chevron_left),
                              visualDensity: VisualDensity.compact,
                            ),
                            Expanded(
                              child: Text(
                                fechaLarga(DateTime.parse(datos.dia)),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Marca.textoSuave,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () => _desplazarDia(1),
                              icon: const Icon(Icons.chevron_right),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        FilledButton.icon(
                          onPressed: () async {
                            final creada = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => PantallaNuevaCita(diaSugerido: datos.dia),
                              ),
                            );
                            if (creada == true) _refrescar();
                          },
                          icon: const Icon(Icons.calendar_month_outlined),
                          label: const Text('Agendar una cita'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TiraDias(
                    dias: datos.semana,
                    diaActivo: datos.dia,
                    hoy: datos.hoy,
                    alElegir: _cambiarDia,
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      datos.resumen,
                      style: const TextStyle(color: Marca.textoSuave, fontSize: 13.5),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _Filtros(
                    especialistas: datos.especialistas,
                    especialistaId: _especialistaId,
                    estado: _estado,
                    alCambiarEspecialista: (id) => setState(() {
                      _especialistaId = id;
                      _futuro = _cargar();
                    }),
                    alCambiarEstado: (estado) => setState(() {
                      _estado = estado;
                      _futuro = _cargar();
                    }),
                  ),
                  const SizedBox(height: 12),
                  if (datos.citas.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: const Vacio(
                        icono: Icons.event_busy_outlined,
                        titulo: 'No hay citas ese día',
                        descripcion: 'Cuando agendes, aparecerán aquí ordenadas por hora.',
                      ),
                    )
                  else
                    ...datos.citas.map(
                      (cita) => Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: TarjetaCita(
                          cita: cita,
                          negocio: negocio?.nombre ?? 'Arialé Studio',
                          prefijo: negocio?.prefijo ?? '+58',
                          alTocar: () async {
                            final cambio = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => PantallaCitaDetalle(citaId: cita.id),
                              ),
                            );
                            if (cambio == true) _refrescar();
                          },
                        ),
                      ),
                    ),
                  if (datos.citas.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                      child: Text(
                        'Previsto del día: ${dinero(datos.previstoCentavos)}',
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: Marca.textoSuave, fontSize: 13),
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

class _Filtros extends StatelessWidget {
  const _Filtros({
    required this.especialistas,
    required this.especialistaId,
    required this.estado,
    required this.alCambiarEspecialista,
    required this.alCambiarEstado,
  });

  final List<Especialista> especialistas;
  final String? especialistaId;
  final String? estado;
  final ValueChanged<String?> alCambiarEspecialista;
  final ValueChanged<String?> alCambiarEstado;

  static const _estados = [
    ('PENDING', 'Por confirmar'),
    ('CONFIRMED', 'Confirmada'),
    ('ATTENDED', 'Atendida'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (especialistas.length > 1)
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _Pastilla(
                  texto: 'Todo el equipo',
                  activa: especialistaId == null,
                  alTocar: () => alCambiarEspecialista(null),
                ),
                for (final e in especialistas)
                  _Pastilla(
                    texto: e.nombre,
                    color: Marca.desdeHex(e.color),
                    activa: especialistaId == e.id,
                    alTocar: () => alCambiarEspecialista(e.id),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 6),
        SizedBox(
          height: 38,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _Pastilla(
                texto: 'Todas',
                activa: estado == null,
                alTocar: () => alCambiarEstado(null),
              ),
              for (final (valor, etiqueta) in _estados)
                _Pastilla(
                  texto: etiqueta,
                  activa: estado == valor,
                  alTocar: () => alCambiarEstado(valor),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Pastilla extends StatelessWidget {
  const _Pastilla({
    required this.texto,
    required this.activa,
    required this.alTocar,
    this.color,
  });

  final String texto;
  final bool activa;
  final VoidCallback alTocar;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: activa ? Marca.dorado : Marca.tarjeta,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: activa ? Marca.dorado : Marca.borde),
            ),
            child: Row(
              children: [
                if (color != null) ...[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 7),
                ],
                Text(
                  texto,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: activa ? Marca.negro : Marca.texto,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DatosAgenda {
  _DatosAgenda({
    required this.dia,
    required this.hoy,
    required this.citas,
    required this.semana,
    required this.especialistas,
    required this.previstoCentavos,
    required this.resumen,
  });

  final String dia;
  final String hoy;
  final List<Cita> citas;
  final List<DiaResumen> semana;
  final List<Especialista> especialistas;
  final int previstoCentavos;
  final String resumen;

  factory _DatosAgenda.desdeJson(Map<String, dynamic> j) {
    final c = j['contadores'] as Map<String, dynamic>;
    final total = c['total'] as int;
    final porConfirmar = c['porConfirmar'] as int;
    final atendidas = c['atendidas'] as int;

    final partes = <String>[
      '$total ${total == 1 ? 'cita' : 'citas'}',
      if (porConfirmar > 0) '$porConfirmar por confirmar',
      if (atendidas > 0) '$atendidas atendidas',
    ];

    return _DatosAgenda(
      dia: j['dia'] as String,
      hoy: j['hoy'] as String,
      previstoCentavos: j['previstoCentavos'] as int,
      resumen: total == 0 ? 'Sin citas ese día' : partes.join(' · '),
      citas: [
        for (final x in (j['citas'] as List)) Cita.desdeJson(x as Map<String, dynamic>),
      ],
      semana: [
        for (final x in (j['semana'] as List))
          DiaResumen.desdeJson(x as Map<String, dynamic>),
      ],
      especialistas: [
        for (final x in (j['especialistas'] as List))
          Especialista(
            id: (x as Map)['id'] as String,
            nombre: x['nombre'] as String,
            color: x['color'] as String,
            servicioIds: const [],
          ),
      ],
    );
  }
}
