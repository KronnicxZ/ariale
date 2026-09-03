import 'package:flutter/material.dart';

import '../iconos.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Los mensajes que conviene mandar hoy: citas de mañana, saldos vencidos,
/// sesiones de depilación que ya tocan y cumpleaños.
///
/// Nada se envía solo. Cada tarjeta abre WhatsApp con el texto ya escrito
/// para que la dueña lo lea, lo ajuste si quiere y pulse enviar.
class PantallaRecordatorios extends StatefulWidget {
  const PantallaRecordatorios({super.key});

  @override
  State<PantallaRecordatorios> createState() => _PantallaRecordatoriosState();
}

class _PantallaRecordatoriosState extends State<PantallaRecordatorios> {
  String? _tipo;
  late Future<_DatosRecordatorios> _futuro;

  static const _tipos = <(String?, String)>[
    (null, 'Todos'),
    ('APPOINTMENT', 'Citas'),
    ('DEBT', 'Saldos'),
    ('NEXT_SESSION', 'Toca repetir'),
    ('BIRTHDAY', 'Cumpleaños'),
  ];

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosRecordatorios> _cargar() async {
    final datos = await Sesion.de(context).obtener('/api/v1/recordatorios');
    return _DatosRecordatorios.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  /// Abre WhatsApp y, si se envió, lo marca para que no vuelva a salir.
  Future<void> _enviar(_Recordatorio r, String negocio, String prefijo) async {
    final mensaje = switch (r.tipo) {
      'APPOINTMENT' => Mensajes.recordatorio(
          clienta: r.clientaNombre,
          cuando: r.cuando ?? DateTime.now(),
          servicios: r.detalle,
          negocio: negocio,
        ),
      'DEBT' => Mensajes.saldo(
          clienta: r.clientaNombre,
          saldoCentavos: r.montoCentavos ?? 0,
          negocio: negocio,
        ),
      'NEXT_SESSION' => Mensajes.proximaSesion(
          clienta: r.clientaNombre,
          servicio: r.servicio ?? r.detalle,
          negocio: negocio,
        ),
      _ => '¡Feliz cumpleaños, ${primerNombre(r.clientaNombre)}! 🎉\n\n'
          'Te deseamos un día precioso de parte de todo $negocio. '
          'Cuando quieras venir a consentirte, aquí te esperamos 💛',
    };

    final abierto = await abrirWhatsApp(r.clientaTelefono, mensaje, prefijo: prefijo);
    if (!abierto || !mounted) return;

    final marcar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Lo enviaste?'),
        content: Text(
          'Si ya le escribiste a ${primerNombre(r.clientaNombre)}, lo quitamos '
          'de la lista para no repetirlo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Todavía no'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sí, enviado'),
          ),
        ],
      ),
    );
    if (marcar != true || !mounted) return;

    try {
      await Sesion.de(context).enviar('/api/v1/recordatorios', {
        'tipo': r.tipo,
        'clientaId': r.clientaId,
        if (r.citaId != null) 'citaId': r.citaId,
        if (r.citaId == null) 'nota': r.clave,
      });
      _refrescar();
    } on ErrorApi catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recordatorios')),
      body: SafeArea(
        child: FutureBuilder<_DatosRecordatorios>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar los recordatorios.',
                alReintentar: _refrescar,
              );
            }

            final datos = snap.data!;
            final visibles = _tipo == null
                ? datos.recordatorios
                : datos.recordatorios.where((r) => r.tipo == _tipo).toList();

            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  Cabecera(
                    etiqueta: 'Mensajes por enviar',
                    valor: '${datos.total}',
                    apoyo: 'Se abren en WhatsApp ya escritos. '
                        'Tú decides qué se manda.',
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 36,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _tipos.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (context, i) {
                        final (clave, rotulo) = _tipos[i];
                        final cuantos = clave == null
                            ? datos.total
                            : datos.recordatorios.where((r) => r.tipo == clave).length;
                        return ChoiceChip(
                          label: Text(cuantos > 0 ? '$rotulo · $cuantos' : rotulo),
                          selected: _tipo == clave,
                          showCheckmark: false,
                          onSelected: (_) => setState(() => _tipo = clave),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (visibles.isEmpty)
                    const Vacio(
                      icono: Ico.sinPendientes,
                      titulo: 'Nada pendiente por avisar',
                      descripcion:
                          'Cuando haya citas cercanas, saldos vencidos o '
                          'sesiones que tocan, aparecerán aquí.',
                    )
                  else
                    ...visibles.map(
                      (r) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _TarjetaRecordatorio(
                          recordatorio: r,
                          alEnviar: () => _enviar(r, datos.negocio, datos.prefijo),
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

class _TarjetaRecordatorio extends StatelessWidget {
  const _TarjetaRecordatorio({required this.recordatorio, required this.alEnviar});

  final _Recordatorio recordatorio;
  final VoidCallback alEnviar;

  @override
  Widget build(BuildContext context) {
    final (icono, color) = switch (recordatorio.tipo) {
      'APPOINTMENT' => (Ico.hoy, Marca.dorado),
      'DEBT' => (Ico.cobrar, Marca.error),
      'NEXT_SESSION' => (Ico.repetir, Marca.lavanda),
      _ => (Ico.cumple, Marca.rosa),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icono, size: 19, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    recordatorio.clientaNombre,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  Text(
                    recordatorio.titulo,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      recordatorio.detalle,
                      if (recordatorio.montoCentavos != null)
                        dinero(recordatorio.montoCentavos!),
                      if (recordatorio.cuando != null)
                        recordatorio.tipo == 'APPOINTMENT'
                            ? '${diaRelativo(recordatorio.cuando!)} a las '
                                '${hora(recordatorio.cuando!)}'
                            : fechaCorta(recordatorio.cuando!),
                    ].join(' · '),
                    style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Abrir WhatsApp',
              onPressed: alEnviar,
              icon: const Icon(Ico.whatsapp, size: 20),
              color: Marca.exito,
              style: IconButton.styleFrom(
                backgroundColor: Marca.exito.withValues(alpha: 0.12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Recordatorio {
  _Recordatorio({
    required this.clave,
    required this.tipo,
    required this.titulo,
    required this.detalle,
    required this.urgente,
    required this.clientaId,
    required this.clientaNombre,
    required this.clientaTelefono,
    this.cuando,
    this.montoCentavos,
    this.servicio,
    this.citaId,
  });

  final String clave;
  final String tipo;
  final String titulo;
  final String detalle;
  final bool urgente;
  final String clientaId;
  final String clientaNombre;
  final String clientaTelefono;
  final DateTime? cuando;
  final int? montoCentavos;
  final String? servicio;
  final String? citaId;

  factory _Recordatorio.desdeJson(Map<String, dynamic> j) => _Recordatorio(
        clave: j['clave'] as String,
        tipo: j['tipo'] as String,
        titulo: j['titulo'] as String,
        detalle: j['detalle'] as String? ?? '',
        urgente: j['urgente'] as bool? ?? false,
        clientaId: (j['clienta'] as Map)['id'] as String,
        clientaNombre: (j['clienta'] as Map)['nombre'] as String,
        clientaTelefono: (j['clienta'] as Map)['telefono'] as String,
        cuando: j['cuando'] == null
            ? null
            : DateTime.parse(j['cuando'] as String).toLocal(),
        montoCentavos: j['montoCentavos'] as int?,
        servicio: j['servicio'] as String?,
        citaId: j['citaId'] as String?,
      );
}

class _DatosRecordatorios {
  _DatosRecordatorios({
    required this.total,
    required this.negocio,
    required this.prefijo,
    required this.recordatorios,
  });

  final int total;
  final String negocio;
  final String prefijo;
  final List<_Recordatorio> recordatorios;

  factory _DatosRecordatorios.desdeJson(Map<String, dynamic> j) => _DatosRecordatorios(
        total: (j['contadores'] as Map)['total'] as int,
        negocio: (j['negocio'] as Map)['nombre'] as String,
        prefijo: (j['negocio'] as Map)['prefijo'] as String? ?? '+58',
        recordatorios: [
          for (final r in (j['recordatorios'] as List))
            _Recordatorio.desdeJson(r as Map<String, dynamic>),
        ],
      );
}
