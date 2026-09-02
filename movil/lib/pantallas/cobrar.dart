import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';

/// Cuentas por cobrar: quién debe, cuánto, y las dos acciones que importan
/// — cobrar y recordar por WhatsApp.
class PantallaCobrar extends StatefulWidget {
  const PantallaCobrar({super.key});

  @override
  State<PantallaCobrar> createState() => _PantallaCobrarState();
}

class _PantallaCobrarState extends State<PantallaCobrar> {
  bool _soloVencidas = false;
  late Future<_DatosCobrar> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosCobrar> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/cobrar',
      params: {if (_soloVencidas) 'estado': 'vencidas'},
    );
    return _DatosCobrar.desdeJson(datos);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro;
  }

  Future<void> _cobrar(_Cuenta cuenta) async {
    final montoTexto = await showDialog<String>(
      context: context,
      builder: (context) => _DialogoCobro(cuenta: cuenta),
    );
    if (montoTexto == null) return;

    final monto = double.tryParse(montoTexto.replaceAll(',', '.')) ?? 0;
    if (monto <= 0 || !mounted) return;

    try {
      final datos = await Sesion.de(context).enviar(
        '/api/v1/ventas/${cuenta.id}/pagos',
        {'montoCentavos': (monto * 100).round(), 'metodo': 'CASH_USD'},
      );
      if (!mounted) return;

      final aplicado = datos['aplicadoCentavos'] as int;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            datos['parcial'] == true
                ? 'Se abonaron ${dinero(aplicado)}: era lo que faltaba.'
                : 'Abono de ${dinero(aplicado)} registrado.',
          ),
        ),
      );
      _refrescar();
    } on ErrorApi catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.mensaje)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<_DatosCobrar>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorConReintento(
                mensaje: snap.error is ErrorApi
                    ? (snap.error as ErrorApi).mensaje
                    : 'No pudimos cargar las cuentas.',
                alReintentar: _refrescar,
              );
            }

            final datos = snap.data!;
            return RefreshIndicator(
              onRefresh: _refrescar,
              color: Marca.dorado,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  Text('Por cobrar', style: titulo(29)),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Te deben en total',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Marca.textoSuave,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  dinero(datos.saldoCentavos),
                                  style: cifra(24),
                                ),
                                Text(
                                  '${datos.cuentas.length} '
                                  '${datos.cuentas.length == 1 ? 'deuda' : 'deudas'}'
                                  '${datos.vencidas > 0 ? ' · ${datos.vencidas} vencidas' : ''}',
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    color: Marca.textoSuave,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          FilterChip(
                            label: const Text('Solo vencidas'),
                            selected: _soloVencidas,
                            onSelected: (v) {
                              setState(() => _soloVencidas = v);
                              _refrescar();
                            },
                            backgroundColor: Marca.fondo,
                            selectedColor: Marca.texto,
                            labelStyle: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.2,
                              color: _soloVencidas ? Colors.white : Marca.textoSuave,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (datos.cuentas.isEmpty)
                    const Vacio(
                      icono: Icons.celebration_outlined,
                      titulo: 'No hay nada por cobrar',
                      descripcion: 'Todas las clientas están al día. Bien hecho.',
                    )
                  else
                    ...datos.cuentas.map(
                      (c) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _TarjetaCuenta(
                          cuenta: c,
                          prefijo: negocio?.prefijo ?? '+58',
                          negocio: negocio?.nombre ?? 'Arialé Studio',
                          alCobrar: () => _cobrar(c),
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

class _TarjetaCuenta extends StatelessWidget {
  const _TarjetaCuenta({
    required this.cuenta,
    required this.prefijo,
    required this.negocio,
    required this.alCobrar,
  });

  final _Cuenta cuenta;
  final String prefijo;
  final String negocio;
  final VoidCallback alCobrar;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Marca.tarjeta,
        borderRadius: BorderRadius.circular(18),
        border: cuenta.vencida
            ? Border.all(color: Marca.error.withValues(alpha: 0.35))
            : null,
      ),
      padding: const EdgeInsets.all(14),
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
                      cuenta.clientaNombre,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      cuenta.concepto,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Marca.textoSuave,
                        fontSize: 12.5,
                      ),
                    ),
                    if (cuenta.vence != null)
                      Text(
                        cuenta.vencida
                            ? 'Vencida hace ${cuenta.diasVencida} d'
                            : 'Vence el ${fechaNumerica(cuenta.vence!)}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight:
                              cuenta.vencida ? FontWeight.w600 : FontWeight.w400,
                          color: cuenta.vencida ? Marca.error : Marca.textoSuave,
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(dinero(cuenta.saldoCentavos), style: cifra(17)),
                  Text(
                    'de ${dinero(cuenta.totalCentavos)}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Marca.textoSuave,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: alCobrar,
                  icon: const Icon(Icons.payments_outlined, size: 18),
                  label: const Text('Cobrar'),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => abrirWhatsApp(
                    cuenta.clientaTelefono,
                    Mensajes.saldo(
                      clienta: cuenta.clientaNombre,
                      saldoCentavos: cuenta.saldoCentavos,
                      negocio: negocio,
                    ),
                    prefijo: prefijo,
                  ),
                  icon: const Icon(Icons.chat_bubble_outline, size: 18),
                  label: const Text('Recordar'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    foregroundColor: Marca.exito,
                    side: BorderSide(color: Marca.exito.withValues(alpha: 0.4)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DialogoCobro extends StatefulWidget {
  const _DialogoCobro({required this.cuenta});
  final _Cuenta cuenta;

  @override
  State<_DialogoCobro> createState() => _DialogoCobroState();
}

class _DialogoCobroState extends State<_DialogoCobro> {
  late final TextEditingController _monto;

  @override
  void initState() {
    super.initState();
    _monto = TextEditingController(
      text: (widget.cuenta.saldoCentavos / 100).toStringAsFixed(2),
    );
  }

  @override
  void dispose() {
    _monto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Cobrar a ${primerNombre(widget.cuenta.clientaNombre)}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Debe ${dinero(widget.cuenta.saldoCentavos)}.',
            style: const TextStyle(color: Marca.textoSuave, fontSize: 13.5),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _monto,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Monto', prefixText: '\$ '),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _monto.text),
          child: const Text('Registrar'),
        ),
      ],
    );
  }
}

class _Cuenta {
  _Cuenta({
    required this.id,
    required this.clientaNombre,
    required this.clientaTelefono,
    required this.concepto,
    required this.totalCentavos,
    required this.saldoCentavos,
    required this.vencida,
    required this.diasVencida,
    this.vence,
  });

  final String id;
  final String clientaNombre;
  final String clientaTelefono;
  final String concepto;
  final int totalCentavos;
  final int saldoCentavos;
  final bool vencida;
  final int diasVencida;
  final DateTime? vence;

  factory _Cuenta.desdeJson(Map<String, dynamic> j) => _Cuenta(
        id: j['id'] as String,
        clientaNombre: (j['clienta'] as Map)['nombre'] as String,
        clientaTelefono: (j['clienta'] as Map)['telefono'] as String,
        concepto: j['concepto'] as String? ?? '',
        totalCentavos: j['totalCentavos'] as int,
        saldoCentavos: j['saldoCentavos'] as int,
        vencida: j['vencida'] as bool? ?? false,
        diasVencida: j['diasVencida'] as int? ?? 0,
        vence: j['vence'] == null
            ? null
            : DateTime.parse(j['vence'] as String).toLocal(),
      );
}

class _DatosCobrar {
  _DatosCobrar({
    required this.cuentas,
    required this.saldoCentavos,
    required this.vencidas,
  });

  final List<_Cuenta> cuentas;
  final int saldoCentavos;
  final int vencidas;

  factory _DatosCobrar.desdeJson(Map<String, dynamic> j) {
    final t = j['totales'] as Map<String, dynamic>;
    return _DatosCobrar(
      saldoCentavos: t['saldoCentavos'] as int,
      vencidas: t['vencidas'] as int,
      cuentas: [
        for (final c in (j['cuentas'] as List)) _Cuenta.desdeJson(c as Map<String, dynamic>),
      ],
    );
  }
}
