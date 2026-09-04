import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Detalle de una cita con las acciones del día a día: confirmar, marcar
/// atendida, cancelar y escribirle a la clienta.
class PantallaCitaDetalle extends StatefulWidget {
  const PantallaCitaDetalle({super.key, required this.citaId});

  final String citaId;

  @override
  State<PantallaCitaDetalle> createState() => _PantallaCitaDetalleState();
}

class _PantallaCitaDetalleState extends State<PantallaCitaDetalle> {
  late Future<_Detalle> _futuro;
  bool _huboCambios = false;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_Detalle> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/citas/${widget.citaId}');
    return _Detalle.desdeJson(datos['cita'] as Map<String, dynamic>);
  }

  /// Cambia el estado y, si la clienta tiene que enterarse, abre WhatsApp
  /// con el aviso ya escrito.
  ///
  /// Confirmar o cancelar sin avisar deja a la clienta sin saber si tiene
  /// cita o no: por eso el mensaje sale solo. No se envía por su cuenta
  /// —WhatsApp se abre con el texto puesto y quien decide es la dueña—,
  /// igual que en todo el resto de la app.
  Future<void> _cambiarEstado(String estado, _Detalle d) async {
    setState(() => _guardando = true);
    try {
      await Sesion.de(context).parchear(
        '/api/v1/citas/${widget.citaId}',
        {'estado': estado},
      );
      _huboCambios = true;
      if (mounted) setState(() => _futuro = _cargar());
      await _avisarALaClienta(estado, d);
    } on ErrorApi catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.mensaje)));
      }
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _avisarALaClienta(String estado, _Detalle d) async {
    if (estado != 'CONFIRMED' && estado != 'CANCELLED') return;

    final cita = d.cita;
    if (cita.clientaTelefono.isEmpty) return;

    final negocio = Sesion.catalogo?.negocio;
    final texto = estado == 'CONFIRMED'
        ? Mensajes.citaConfirmada(
            clienta: cita.clientaNombre,
            cuando: cita.inicio,
            servicios: cita.resumenServicios,
            negocio: negocio?.nombre ?? 'Arialé Studio',
            totalCentavos: cita.totalCentavos,
          )
        : Mensajes.citaCancelada(
            clienta: cita.clientaNombre,
            cuando: cita.inicio,
            servicios: cita.resumenServicios,
            negocio: negocio?.nombre ?? 'Arialé Studio',
          );

    await abrirWhatsApp(
      cita.clientaTelefono,
      texto,
      prefijo: negocio?.prefijo ?? '+58',
    );
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _huboCambios);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Cita'),
          leading: IconButton(
            icon: const Icon(Ico.atras),
            onPressed: () => Navigator.pop(context, _huboCambios),
          ),
        ),
        body: FutureBuilder<_Detalle>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar la cita.',
                alReintentar: () => setState(() => _futuro = _cargar()),
              );
            }

            final d = snap.data!;
            final cita = d.cita;

            return ListView(
              padding: const EdgeInsets.all(18),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
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
                                    fechaLarga(cita.inicio),
                                    style: const TextStyle(
                                      color: Marca.textoSuave,
                                      fontSize: 13.5,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${hora(cita.inicio)} — ${hora(cita.fin)}',
                                    style: titulo(22),
                                  ),
                                  Text(
                                    duracion(cita.duracionMin),
                                    style: const TextStyle(
                                      color: Marca.textoSuave,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Etiqueta.cita(cita.estado),
                          ],
                        ),
                        const Divider(height: 26),
                        Row(
                          children: [
                            CircleAvatar(
                              backgroundColor:
                                  Marca.desdeHex(cita.especialistaColor),
                              radius: 20,
                              child: Text(
                                iniciales(cita.clientaNombre),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Marca.contrasteSobre(
                                    Marca.desdeHex(cita.especialistaColor),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cita.clientaNombre,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 15,
                                    ),
                                  ),
                                  Text(
                                    '${telefonoBonito(cita.clientaTelefono, negocio?.prefijo ?? '+58')}'
                                    ' · ${cita.especialistaNombre}',
                                    style: const TextStyle(
                                      color: Marca.textoSuave,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () => abrirWhatsApp(
                                cita.clientaTelefono,
                                Mensajes.citaConfirmada(
                                  clienta: cita.clientaNombre,
                                  cuando: cita.inicio,
                                  servicios: cita.resumenServicios,
                                  negocio: negocio?.nombre ?? 'Arialé Studio',
                                  totalCentavos: cita.totalCentavos,
                                ),
                                prefijo: negocio?.prefijo ?? '+58',
                              ),
                              icon: const Icon(Ico.whatsapp),
                              color: Marca.exito,
                              style: IconButton.styleFrom(
                                backgroundColor: Marca.exito.withValues(alpha: 0.12),
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 26),
                        for (final s in d.servicios)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        s.nombre,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w500,
                                          fontSize: 14,
                                        ),
                                      ),
                                      Text(
                                        duracion(s.duracionMin),
                                        style: const TextStyle(
                                          color: Marca.textoSuave,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(dinero(s.precioCentavos), style: cifra(14)),
                              ],
                            ),
                          ),
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Total',
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(dinero(cita.totalCentavos), style: cifra(18)),
                                if ((Sesion.catalogo?.tasa ?? 0) > 0)
                                  Text(
                                    bolivares(
                                      cita.totalCentavos,
                                      Sesion.catalogo!.tasa,
                                    ),
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: Marca.textoSuave,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                        if (cita.nota != null && cita.nota!.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Marca.fondo,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              cita.nota!,
                              style: const TextStyle(fontSize: 13.5),
                            ),
                          ),
                        ],
                        // El diseño que trajo la clienta. Se abre en el
                        // navegador al tocarlo: para copiar unas uñas hace
                        // falta verlas de cerca, no en una miniatura.
                        if (cita.disenoUrl != null && cita.disenoUrl!.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          _Diseno(url: cita.disenoUrl!),
                        ],
                        if (d.alergias != null && d.alergias!.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Marca.alerta.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Ico.alergia,
                                    size: 18, color: Marca.alerta),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Ojo: ${d.alergias}',
                                    style: const TextStyle(fontSize: 13.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_guardando)
                  const Center(child: CircularProgressIndicator())
                else
                  Row(
                    children: [
                      if (cita.porConfirmar)
                        _Accion(
                          icono: Ico.bien,
                          rotulo: 'Confirmar',
                          principal: true,
                          alTocar: () => _cambiarEstado('CONFIRMED', d),
                        ),
                      if (!cita.atendida && !cita.cancelada)
                        _Accion(
                          icono: Ico.listo,
                          rotulo: 'Atendida',
                          alTocar: () => _cambiarEstado('ATTENDED', d),
                        ),
                      if (!cita.cancelada)
                        _Accion(
                          icono: Ico.anular,
                          rotulo: 'Cancelar',
                          color: Marca.error,
                          alTocar: () => _cambiarEstado('CANCELLED', d),
                        ),
                    ],
                  ),
                const SizedBox(height: 18),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      children: [
                        const Icon(Ico.ventas,
                            size: 18, color: Marca.textoSuave),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            d.ventaEstado == null
                                ? 'Esta cita todavía no se ha cobrado.'
                                : 'Venta #${d.ventaNumero} · '
                                    'cobrado ${dinero(d.ventaCobradoCentavos ?? 0)}',
                            style: const TextStyle(fontSize: 13.5),
                          ),
                        ),
                        if (d.ventaEstado != null) Etiqueta.venta(d.ventaEstado!),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ServicioCita {
  _ServicioCita({
    required this.nombre,
    required this.precioCentavos,
    required this.duracionMin,
  });

  final String nombre;
  final int precioCentavos;
  final int duracionMin;
}

class _Detalle {
  _Detalle({
    required this.cita,
    required this.servicios,
    this.alergias,
    this.ventaEstado,
    this.ventaNumero,
    this.ventaCobradoCentavos,
  });

  final Cita cita;
  final List<_ServicioCita> servicios;
  final String? alergias;
  final String? ventaEstado;
  final int? ventaNumero;
  final int? ventaCobradoCentavos;

  factory _Detalle.desdeJson(Map<String, dynamic> j) {
    final venta = j['venta'] as Map<String, dynamic>?;
    return _Detalle(
      cita: Cita.desdeJson(j),
      alergias: (j['clienta'] as Map)['alergias'] as String?,
      servicios: [
        for (final s in (j['servicios'] as List))
          _ServicioCita(
            nombre: (s as Map)['nombre'] as String,
            precioCentavos: s['precioCentavos'] as int,
            duracionMin: s['duracionMin'] as int,
          ),
      ],
      ventaEstado: venta?['estado'] as String?,
      ventaNumero: venta?['numero'] as int?,
      ventaCobradoCentavos: venta?['cobradoCentavos'] as int?,
    );
  }
}


/// Una de las tres acciones de una cita. Van en fila y a partes iguales:
/// son la misma decisión tomada de tres maneras.
class _Accion extends StatelessWidget {
  const _Accion({
    required this.icono,
    required this.rotulo,
    required this.alTocar,
    this.principal = false,
    this.color,
  });

  final IconData icono;
  final String rotulo;
  final VoidCallback alTocar;
  final bool principal;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tinte = color ?? (principal ? Marca.negro : Marca.texto);

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Material(
          color: principal ? Marca.dorado : Marca.tarjeta,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: alTocar,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                children: [
                  Icon(icono, size: 19, color: tinte),
                  const SizedBox(height: 5),
                  Text(
                    rotulo,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: tinte,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// El diseño que la clienta quiere, tal cual lo dejó al agendar.
///
/// La miniatura sirve para reconocerlo de un vistazo; el trabajo de verdad
/// se mira en grande, así que al tocarlo se abre en el navegador. Si la
/// imagen no carga —un enlace que caducó, una página que no deja verla de
/// fuera— igual queda el botón para abrirla.
class _Diseno extends StatelessWidget {
  const _Diseno({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Marca.fondo,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: Image.network(
                url,
                width: 62,
                height: 62,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 62,
                  height: 62,
                  color: Marca.tarjeta,
                  child: const Icon(Ico.nota, size: 20, color: Marca.textoTenue),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('El diseño que quiere', style: titulo(15)),
                  const SizedBox(height: 2),
                  Text('Lo dejó al agendar · toca para verlo grande', style: sutil(12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
