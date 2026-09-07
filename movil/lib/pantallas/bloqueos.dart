import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Los ratos en que no se atiende: un día libre, una tarde de médico, una
/// semana de viaje.
///
/// Lo que se marque aquí desaparece de la página al momento. La clienta no ve
/// esas horas, y si el día se queda entero sin sitio, el calendario lo apaga.
/// No hace falta desplegar nada ni avisar a nadie.
class PantallaBloqueos extends StatefulWidget {
  const PantallaBloqueos({super.key});

  @override
  State<PantallaBloqueos> createState() => _PantallaBloqueosState();
}

class _PantallaBloqueosState extends State<PantallaBloqueos> {
  late Future<List<_Bloqueo>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<_Bloqueo>> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/bloqueos');
    return [
      for (final b in (datos['bloqueos'] as List))
        _Bloqueo.desdeJson(b as Map<String, dynamic>),
    ];
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _nuevo() async {
    final creado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => const _HojaBloqueo(),
    );
    if (creado == true) _refrescar();
  }

  Future<void> _borrar(_Bloqueo b) async {
    final seguro = await confirmar(
      context,
      titulo_: '¿Quitar el bloqueo?',
      mensaje: 'Esas horas vuelven a quedar libres y las clientas podrán '
          'reservarlas otra vez.',
      confirmarTexto: 'Quitar',
    );
    if (!seguro || !mounted) return;

    final mensajero = ScaffoldMessenger.of(context);
    try {
      await Sesion.de(context).borrar('/api/v1/bloqueos', params: {'id': b.id});
      mensajero.showSnackBar(const SnackBar(content: Text('Bloqueo quitado.')));
      _refrescar();
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Días y horas bloqueadas')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _nuevo,
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        icon: const Icon(Ico.agregar),
        label: const Text('Bloquear'),
      ),
      body: SafeArea(
        child: FutureBuilder<List<_Bloqueo>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar los bloqueos.',
                alReintentar: _refrescar,
              );
            }

            final bloqueos = snap.data!;
            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 104),
                children: [
                  const Aviso(
                    icono: Ico.info,
                    texto: 'Lo que bloquees aquí deja de ofrecerse en la página '
                        'al momento. Si un día queda entero sin sitio, a las '
                        'clientas les sale apagado.',
                    color: Marca.lavanda,
                  ),
                  const SizedBox(height: 14),
                  if (bloqueos.isEmpty)
                    const Vacio(
                      icono: Ico.cerrado,
                      titulo: 'No hay nada bloqueado',
                      descripcion: 'Toca «Bloquear» para marcar un día libre o '
                          'un rato en que no atiendes.',
                    )
                  else
                    ...bloqueos.map(
                      (b) => Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          leading: Container(
                            width: 10,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Marca.desdeHex(b.especialistaColor),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          title: Text(b.cuando, style: titulo(15)),
                          subtitle: Text(
                            [b.especialistaNombre, if (b.motivo != null) b.motivo!]
                                .join(' · '),
                            style: sutil(13),
                          ),
                          trailing: IconButton(
                            tooltip: 'Quitar',
                            onPressed: () => _borrar(b),
                            icon: const Icon(Ico.borrar, size: 19),
                            color: Marca.error,
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

/// Marcar un bloqueo: de quién, qué días y, si hace falta, qué horas.
class _HojaBloqueo extends StatefulWidget {
  const _HojaBloqueo();

  @override
  State<_HojaBloqueo> createState() => _HojaBloqueoState();
}

class _HojaBloqueoState extends State<_HojaBloqueo> {
  final Set<String> _quienes = {};
  late String _desde = Sesion.catalogo!.hoy;
  late String _hasta = Sesion.catalogo!.hoy;

  /// Día entero por defecto: es lo que se marca nueve de cada diez veces.
  bool _diaEntero = true;
  TimeOfDay _horaDesde = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _horaHasta = const TimeOfDay(hour: 13, minute: 0);

  final _motivo = TextEditingController();
  bool _guardando = false;

  bool _yaElegiPorDefecto = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Quien está usando la app suele bloquear su propia agenda. Va aquí y no
    // en `initState` porque leer la sesión necesita el contexto ya montado.
    if (_yaElegiPorDefecto) return;
    _yaElegiPorDefecto = true;
    final yo = Sesion.de(context).miEspecialistaId;
    if (yo != null) _quienes.add(yo);
  }

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  String _texto(TimeOfDay h) =>
      '${h.hour.toString().padLeft(2, '0')}:${h.minute.toString().padLeft(2, '0')}';

  Future<void> _elegirDia({required bool inicial}) async {
    final base = DateTime.parse(inicial ? _desde : _hasta);
    final elegido = await showDatePicker(
      context: context,
      initialDate: base,
      firstDate: DateTime.parse(Sesion.catalogo!.hoy),
      lastDate: DateTime.parse(Sesion.catalogo!.hoy).add(const Duration(days: 365)),
    );
    if (elegido == null) return;
    setState(() {
      final clave = claveDia(elegido);
      if (inicial) {
        _desde = clave;
        // El final nunca puede quedar antes del inicio.
        if (_hasta.compareTo(clave) < 0) _hasta = clave;
      } else {
        _hasta = clave;
        if (clave.compareTo(_desde) < 0) _desde = clave;
      }
    });
  }

  Future<void> _elegirHora({required bool inicial}) async {
    final elegida = await showTimePicker(
      context: context,
      initialTime: inicial ? _horaDesde : _horaHasta,
    );
    if (elegida == null) return;
    setState(() {
      if (inicial) {
        _horaDesde = elegida;
      } else {
        _horaHasta = elegida;
      }
    });
  }

  Future<void> _guardar() async {
    if (_quienes.isEmpty) {
      _avisar('Elige de quién es el bloqueo.');
      return;
    }
    if (!_diaEntero && _texto(_horaHasta).compareTo(_texto(_horaDesde)) <= 0) {
      _avisar('La hora final tiene que ser después de la inicial.');
      return;
    }

    setState(() => _guardando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);
    try {
      await Sesion.de(context).enviar('/api/v1/bloqueos', {
        'especialistaIds': _quienes.toList(),
        'desde': _desde,
        'hasta': _hasta,
        if (!_diaEntero) 'horaDesde': _texto(_horaDesde),
        if (!_diaEntero) 'horaHasta': _texto(_horaHasta),
        'motivo': _motivo.text.trim(),
      });
      mensajero.showSnackBar(const SnackBar(content: Text('Bloqueado.')));
      navegador.pop(true);
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _guardando = false);
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final equipo = Sesion.catalogo!.especialistas;

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
            Text('Bloquear', style: titulo(24)),
            const SizedBox(height: 4),
            Text('Nadie podrá reservar en ese rato.', style: sutil(13.5)),

            const SizedBox(height: 20),
            Text('¿De quién?', style: titulo(18)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final e in equipo)
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

            const SizedBox(height: 20),
            Text('¿Qué días?', style: titulo(18)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _Selector(
                    rotulo: 'Desde',
                    valor: fechaCorta(DateTime.parse(_desde)),
                    alTocar: () => _elegirDia(inicial: true),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Selector(
                    rotulo: 'Hasta',
                    valor: fechaCorta(DateTime.parse(_hasta)),
                    alTocar: () => _elegirDia(inicial: false),
                  ),
                ),
              ],
            ),
            if (_desde != _hasta) ...[
              const SizedBox(height: 6),
              Text(
                'Los dos días entran, y todos los de en medio.',
                style: sutil(12.5),
              ),
            ],

            const SizedBox(height: 16),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _diaEntero,
              onChanged: (v) => setState(() => _diaEntero = v),
              title: Text('Todo el día', style: titulo(15)),
              subtitle: Text(
                _diaEntero
                    ? 'No se atiende en toda la jornada.'
                    : 'Solo el rato que elijas abajo.',
                style: sutil(12.5),
              ),
              activeThumbColor: Marca.dorado,
            ),
            if (!_diaEntero)
              Row(
                children: [
                  Expanded(
                    child: _Selector(
                      rotulo: 'Desde las',
                      valor: _texto(_horaDesde),
                      alTocar: () => _elegirHora(inicial: true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Selector(
                      rotulo: 'Hasta las',
                      valor: _texto(_horaHasta),
                      alTocar: () => _elegirHora(inicial: false),
                    ),
                  ),
                ],
              ),

            const SizedBox(height: 16),
            TextField(
              controller: _motivo,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Motivo',
                helperText: 'Opcional, y solo lo ves tú',
              ),
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
                  : const Text('Bloquear'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Campo que parece un desplegable y abre un selector nativo al tocarlo.
class _Selector extends StatelessWidget {
  const _Selector({required this.rotulo, required this.valor, required this.alTocar});

  final String rotulo;
  final String valor;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: alTocar,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Marca.tarjeta,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Marca.borde),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(rotulo, style: sutil(11.5)),
            const SizedBox(height: 2),
            Text(valor, style: cifra(16)),
          ],
        ),
      ),
    );
  }
}

class _Bloqueo {
  _Bloqueo({
    required this.id,
    required this.especialistaNombre,
    required this.especialistaColor,
    required this.cuando,
    this.motivo,
  });

  final String id;
  final String especialistaNombre;
  final String especialistaColor;

  /// Ya viene escrito para leer: "Sáb 12 de septiembre, todo el día".
  final String cuando;
  final String? motivo;

  factory _Bloqueo.desdeJson(Map<String, dynamic> j) {
    final inicio = DateTime.parse(j['inicio'] as String).toLocal();
    final fin = DateTime.parse(j['fin'] as String).toLocal();
    final unSoloDia = (j['dia'] as String) == (j['diaFin'] as String);

    // Un bloqueo que va de la apertura al cierre del mismo día se cuenta como
    // "todo el día": decir "de 00:00 a 23:59" no lo entiende nadie.
    final deExtremoAExtremo = inicio.hour == 0 && inicio.minute == 0 && fin.hour >= 23;

    final String cuando;
    if (!unSoloDia) {
      cuando = '${fechaCorta(inicio)} — ${fechaCorta(fin)}';
    } else if (deExtremoAExtremo) {
      cuando = '${fechaCorta(inicio)}, todo el día';
    } else {
      cuando = '${fechaCorta(inicio)}, de ${hora(inicio)} a ${hora(fin)}';
    }

    final esp = j['especialista'] as Map;
    return _Bloqueo(
      id: j['id'] as String,
      especialistaNombre: esp['nombre'] as String,
      especialistaColor: esp['color'] as String,
      cuando: cuando,
      motivo: (j['motivo'] as String?)?.trim().isEmpty ?? true
          ? null
          : (j['motivo'] as String),
    );
  }
}
