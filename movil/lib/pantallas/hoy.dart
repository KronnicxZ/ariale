import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'cita_detalle.dart';
import 'nueva_cita.dart';

/// Pantalla de arranque: el día de hoy manda, el dinero va resumido.
class PantallaHoy extends StatefulWidget {
  const PantallaHoy({
    super.key,
    required this.alIrAAgenda,
    required this.alIrACobrar,
  });

  final void Function(String dia) alIrAAgenda;
  final VoidCallback alIrACobrar;

  @override
  State<PantallaHoy> createState() => _PantallaHoyState();
}

class _PantallaHoyState extends State<PantallaHoy> {
  late Future<ResumenHoy> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<ResumenHoy> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/hoy');
    return ResumenHoy.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<ResumenHoy>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar tu día.',
                alReintentar: _refrescar,
              );
            }

            final datos = snap.data!;
            final saludo = _saludo();
            final quien = Sesion.de(context).nombreUsuaria;

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
                        Text(
                          '$saludo${quien == null ? '' : ', ${primerNombre(quien)}'}',
                          style: sutil(14.5),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _capitalizar(fechaLarga(DateTime.parse(datos.hoy))),
                          style: titulo(29),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () async {
                            final creada = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const PantallaNuevaCita(),
                              ),
                            );
                            if (creada == true) _refrescar();
                          },
                          icon: const Icon(Icons.calendar_month_outlined),
                          label: const Text('Agendar una cita'),
                        ),
                        if (datos.porConfirmar > 0 || datos.vencidas > 0) ...[
                          const SizedBox(height: 14),
                          if (datos.porConfirmar > 0)
                            Aviso(
                              icono: Icons.schedule,
                              color: Marca.dorado,
                              texto: '${datos.porConfirmar} '
                                  '${datos.porConfirmar == 1 ? 'cita sin confirmar' : 'citas sin confirmar'}',
                              alTocar: () => widget.alIrAAgenda(datos.hoy),
                            ),
                          if (datos.porConfirmar > 0 && datos.vencidas > 0)
                            const SizedBox(height: 8),
                          if (datos.vencidas > 0)
                            Aviso(
                              icono: Icons.warning_amber_rounded,
                              color: Marca.alerta,
                              texto: '${datos.vencidas} '
                                  '${datos.vencidas == 1 ? 'clienta te debe' : 'clientas te deben'}'
                                  ' desde hace tiempo',
                              alTocar: widget.alIrACobrar,
                            ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TiraDias(
                    dias: datos.semana,
                    diaActivo: datos.hoy,
                    hoy: datos.hoy,
                    alElegir: widget.alIrAAgenda,
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('Tu día', style: titulo(21)),
                        const Spacer(),
                        Flexible(
                          child: Text(
                            datos.total == 0
                                ? 'Sin citas'
                                : '${datos.total} ${datos.total == 1 ? 'cita' : 'citas'} · '
                                    '${dinero(datos.previstoCentavos)}',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Marca.textoSuave,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (datos.citas.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Vacio(
                        icono: Icons.event_available_outlined,
                        titulo: 'Hoy no hay nada agendado',
                        descripcion:
                            'Buen momento para escribirle a las clientas que no vienen '
                            'hace rato.',
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
                          esProxima: cita.id == datos.proximaCitaId,
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
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: OutlinedButton.icon(
                      onPressed: () => widget.alIrAAgenda(datos.hoy),
                      icon: const Icon(Icons.calendar_today_outlined, size: 18),
                      label: const Text('Ver toda la agenda'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _ResumenMes(datos: datos),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  String _saludo() {
    final h = DateTime.now().hour;
    if (h >= 5 && h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  String _capitalizar(String texto) =>
      texto.isEmpty ? texto : texto[0].toUpperCase() + texto.substring(1);
}

class _ResumenMes extends StatelessWidget {
  const _ResumenMes({required this.datos});

  final ResumenHoy datos;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Este mes', style: titulo(20)),
            const SizedBox(height: 14),
            Row(
              children: [
                _Cifra(rotulo: 'Ventas', centavos: datos.ventasMesCentavos),
                _Cifra(rotulo: 'Cobrado', centavos: datos.cobradoMesCentavos),
                _Cifra(
                  rotulo: 'Por cobrar',
                  centavos: datos.porCobrarCentavos,
                  color: datos.porCobrarCentavos > 0 ? Marca.error : null,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Cifra extends StatelessWidget {
  const _Cifra({required this.rotulo, required this.centavos, this.color});

  final String rotulo;
  final int centavos;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: const TextStyle(fontSize: 12, color: Marca.textoSuave)),
          const SizedBox(height: 3),
          Text(dineroCorto(centavos), style: cifra(18, color: color)),
        ],
      ),
    );
  }
}
