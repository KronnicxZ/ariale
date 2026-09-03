import 'dart:async';

import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../recordatorios.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/animar.dart';
import '../widgets/comunes.dart';
import 'cita_detalle.dart';
import 'nueva_cita.dart';
import 'recordatorios.dart' show PantallaRecordatorios;

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
    final resumen = ResumenHoy.desdeJson(datos);
    // Al mismo tiempo que se ve el día, se rearman los avisos de hoy: así
    // siempre reflejan lo último (citas nuevas, canceladas o movidas).
    if (mounted) {
      unawaited(
        Recordatorios.sincronizar(
          resumen.citas,
          miEspecialistaId: Sesion.de(context).miEspecialistaId,
        ),
      );
    }
    return resumen;
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
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
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
                                    style: titulo(24),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            _Campana(
                              porConfirmar: datos.porConfirmar,
                              vencidas: datos.vencidas,
                              alAbrir: () => _abrirAvisos(datos),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
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
                          icon: const Icon(Ico.agenda),
                          label: const Text('Agendar una cita'),
                        ),
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
                    padding: const EdgeInsets.symmetric(horizontal: 20),
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
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Vacio(
                        icono: Ico.hoy,
                        titulo: 'Hoy no hay nada agendado',
                        descripcion:
                            'Buen momento para escribirle a las clientas que no vienen '
                            'hace rato.',
                      ),
                    )
                  else
                    ...datos.citas.indexed.map(
                      ((int, Cita) par) => Aparece(
                        posicion: par.$1,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                          child: TarjetaCita(
                            cita: par.$2,
                            negocio: negocio?.nombre ?? 'Arialé Studio',
                            prefijo: negocio?.prefijo ?? '+58',
                            esProxima: par.$2.id == datos.proximaCitaId,
                            alTocar: () async {
                              final cambio = await Navigator.push<bool>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      PantallaCitaDetalle(citaId: par.$2.id),
                                ),
                              );
                              if (cambio == true) _refrescar();
                            },
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: OutlinedButton.icon(
                      onPressed: () => widget.alIrAAgenda(datos.hoy),
                      icon: const Icon(Ico.agenda, size: 18),
                      label: const Text('Ver toda la agenda'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
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

  /// Los avisos ya no ocupan la portada: se abren desde la campana, que
  /// lleva el número encima para que se vea que hay algo sin atender.
  Future<void> _abrirAvisos(ResumenHoy datos) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Marca.fondo,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (hoja) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Pendientes', style: titulo(24)),
              const SizedBox(height: 16),
              // Siempre a la mano, haya o no algo urgente: los mensajes de
              // WhatsApp listos para mandar (citas de mañana, deudas, cumples).
              Aviso(
                icono: Ico.whatsapp,
                color: Marca.exito,
                texto: 'Recordatorios por WhatsApp',
                alTocar: () {
                  Navigator.pop(hoja);
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PantallaRecordatorios()),
                  );
                },
              ),
              const SizedBox(height: 10),
              if (datos.porConfirmar > 0) ...[
                Aviso(
                  icono: Ico.hora,
                  color: Marca.dorado,
                  texto: '${datos.porConfirmar} '
                      '${datos.porConfirmar == 1 ? 'cita sin confirmar' : 'citas sin confirmar'}',
                  alTocar: () {
                    Navigator.pop(hoja);
                    widget.alIrAAgenda(datos.hoy);
                  },
                ),
                const SizedBox(height: 10),
              ],
              if (datos.vencidas > 0)
                Aviso(
                  icono: Ico.atencion,
                  color: Marca.alerta,
                  texto: '${datos.vencidas} '
                      '${datos.vencidas == 1 ? 'clienta te debe' : 'clientas te deben'}'
                      ' desde hace tiempo',
                  alTocar: () {
                    Navigator.pop(hoja);
                    widget.alIrACobrar();
                  },
                ),
              if (datos.porConfirmar == 0 && datos.vencidas == 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Nada más pendiente: todo confirmado y al día.',
                    style: sutil(13),
                  ),
                ),
            ],
          ),
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
        padding: const EdgeInsets.all(18),
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


/// Campana con el número de cosas sin atender. Ocupa una esquina en vez de
/// dos tarjetas, y deja el botón de agendar donde llega el pulgar.
class _Campana extends StatelessWidget {
  const _Campana({
    required this.porConfirmar,
    required this.vencidas,
    required this.alAbrir,
  });

  final int porConfirmar;
  final int vencidas;
  final VoidCallback alAbrir;

  @override
  Widget build(BuildContext context) {
    final total = porConfirmar + vencidas;
    // Si hay deudas vencidas el aviso es más serio que una cita por confirmar.
    final color = vencidas > 0 ? Marca.alerta : Marca.dorado;

    return Material(
      color: Marca.tarjeta,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: alAbrir,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(11),
          child: Badge(
            isLabelVisible: total > 0,
            backgroundColor: color,
            textColor: Marca.contrasteSobre(color),
            label: Text(
              total > 99 ? '99+' : '$total',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
            ),
            child: const Icon(Ico.recordatorios, size: 21, color: Marca.texto),
          ),
        ),
      ),
    );
  }
}
