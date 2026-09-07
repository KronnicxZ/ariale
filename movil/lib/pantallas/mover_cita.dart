import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../iconos.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import '../widgets/selector_cuando.dart';

/// Mover una cita de día o de hora.
///
/// Los servicios y la especialista no se tocan: es la misma cita, en otro
/// momento. Antes esto solo se podía hacer desde el panel web, y la llamada
/// de "¿me lo pasas al jueves?" entra al teléfono, no al ordenador.
///
/// Son los mismos selectores que al agendar, y el mismo cálculo de huecos
/// del servidor. La única diferencia: esta cita no se cuenta a sí misma como
/// ocupada, o su propia hora saldría llena.
class PantallaMoverCita extends StatefulWidget {
  const PantallaMoverCita({
    super.key,
    required this.citaId,
    required this.diaActual,
    required this.horaActual,
    required this.resumen,
  });

  final String citaId;
  final String diaActual;
  final String horaActual;

  /// "Esmaltado Semipermanente · con Alejandra", para no perder de vista qué
  /// se está moviendo.
  final String resumen;

  @override
  State<PantallaMoverCita> createState() => _PantallaMoverCitaState();
}

class _PantallaMoverCitaState extends State<PantallaMoverCita> {
  late String _dia;
  String? _hora;
  List<Hueco> _huecos = [];
  Set<String>? _conHueco;
  String? _motivo;
  bool _cargandoHuecos = false;
  bool _guardando = false;

  late final String _desde;
  late final String _hasta;

  @override
  void initState() {
    super.initState();
    final hoy = DateTime.now();
    _desde = claveDia(hoy);
    _hasta = claveDia(hoy.add(const Duration(days: 60)));
    // Si la cita es de hoy o de mañana, se abre en su propio día; si ya
    // pasó (no debería), en hoy.
    _dia = widget.diaActual.compareTo(_desde) < 0 ? _desde : widget.diaActual;
    _cargarDias();
    _cargarHuecos();
  }

  Future<void> _cargarDias() async {
    try {
      final datos = await Sesion.de(context).obtener(
        '/api/v1/dias',
        // Basta con decir qué cita: el servidor saca de ella los servicios y
        // la especialista, y no la cuenta a sí misma como ocupada.
        params: {'desde': _desde, 'hasta': _hasta, 'cita': widget.citaId},
      );
      if (!mounted) return;
      setState(() {
        _conHueco = ((datos['dias'] as List?) ?? []).map((d) => d.toString()).toSet();
      });
    } on ErrorApi {
      // Sin la lista de días no se apaga ninguno: los huecos de cada día
      // siguen mandando y la pantalla se puede usar igual.
    }
  }

  Future<void> _cargarHuecos() async {
    setState(() {
      _cargandoHuecos = true;
      _hora = null;
    });
    try {
      final datos = await Sesion.de(context).obtener(
        '/api/v1/huecos',
        params: {'dia': _dia, 'cita': widget.citaId},
      );
      if (!mounted) return;
      setState(() {
        _huecos = ((datos['huecos'] as List?) ?? [])
            .map((h) => Hueco.desdeJson(h as Map<String, dynamic>))
            .toList();
        _motivo = datos['motivo'] as String?;
      });
    } on ErrorApi catch (e) {
      if (!mounted) return;
      setState(() {
        _huecos = [];
        _motivo = e.mensaje;
      });
    } finally {
      if (mounted) setState(() => _cargandoHuecos = false);
    }
  }

  Future<void> _mover() async {
    final hora = _hora;
    if (hora == null) return;

    setState(() => _guardando = true);
    try {
      await Sesion.de(context).parchear(
        '/api/v1/citas/${widget.citaId}',
        {'dia': _dia, 'hora': hora},
      );
      if (mounted) Navigator.pop(context, true);
    } on ErrorApi catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.mensaje)));
      }
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mismoMomento = _dia == widget.diaActual && _hora == widget.horaActual;

    return Scaffold(
      appBar: AppBar(title: const Text('Mover la cita')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.resumen,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Ico.hora, size: 15, color: Marca.textoSuave),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Ahora: ${fechaLarga(DateTime.parse(widget.diaActual))} · '
                          '${horaBonita(widget.horaActual)}',
                          style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Seccion('Día'),
          SelectorDia(
            dia: _dia,
            desde: _desde,
            hasta: _hasta,
            conHueco: _conHueco,
            alElegir: (d) {
              setState(() => _dia = d);
              _cargarHuecos();
            },
          ),
          const SizedBox(height: 22),

          const Seccion('Hora'),
          if (_cargandoHuecos)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 26),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_huecos.isEmpty)
            Aviso(
              icono: Ico.info,
              texto: _motivo ?? 'Ese día ya no queda hueco.',
              color: Marca.textoSuave,
            )
          else
            ListaHoras(
              huecos: _huecos,
              hora: _hora,
              alElegir: (h) => setState(() => _hora = h),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _hora == null || _guardando || mismoMomento ? null : _mover,
            child: _guardando
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    _hora == null
                        ? 'Elige una hora'
                        : mismoMomento
                            ? 'Es la misma hora'
                            : 'Mover a las ${horaBonita(_hora!)}',
                  ),
          ),
        ),
      ),
    );
  }
}
