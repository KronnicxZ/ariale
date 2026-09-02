import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/comunes.dart';
import 'elegir_clienta.dart';
import 'clienta_detalle.dart';
import 'nueva_cita.dart';

/// Directorio de clientas con búsqueda y filtros.
class PantallaClientas extends StatefulWidget {
  const PantallaClientas({super.key});

  @override
  State<PantallaClientas> createState() => _PantallaClientasState();
}

class _PantallaClientasState extends State<PantallaClientas> {
  final _busqueda = TextEditingController();
  String _filtro = 'todas';
  late Future<_DatosClientas> _futuro;

  static const _filtros = [
    ('todas', 'Todas'),
    ('con-cita', 'Con cita'),
    ('con-saldo', 'Con saldo'),
    ('con-bono', 'Con bono'),
    ('nuevas', 'Nuevas'),
  ];

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  Future<_DatosClientas> _cargar() async {
    final datos = await Sesion.de(context).obtener(
      '/api/v1/clientas',
      params: {
        'filtro': _filtro,
        if (_busqueda.text.trim().isNotEmpty) 'q': _busqueda.text.trim(),
      },
    );
    return _DatosClientas.desdeJson(datos);
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
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Clientas', style: titulo(29)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _busqueda,
                    onSubmitted: (_) => _refrescar(),
                    decoration: InputDecoration(
                      hintText: 'Buscar por nombre o teléfono',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _busqueda.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _busqueda.clear();
                                _refrescar();
                              },
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final (valor, etiqueta) in _filtros)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(etiqueta),
                        selected: _filtro == valor,
                        onSelected: (_) {
                          setState(() => _filtro = valor);
                          _refrescar();
                        },
                        selectedColor: Marca.dorado,
                        labelStyle: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _filtro == valor ? Marca.negro : Marca.texto,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: FutureBuilder<_DatosClientas>(
                future: _futuro,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ErrorConReintento(
                      mensaje: snap.error is ErrorApi
                          ? (snap.error as ErrorApi).mensaje
                          : 'No pudimos cargar las clientas.',
                      alReintentar: _refrescar,
                    );
                  }

                  final datos = snap.data!;
                  if (datos.clientas.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(16),
                      child: Vacio(
                        icono: Icons.people_outline,
                        titulo: 'No encontramos a nadie',
                        descripcion: 'Prueba con otro nombre o cambia el filtro.',
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: _refrescar,
                    color: Marca.dorado,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: datos.clientas.length + 1,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        if (i == 0) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              '${datos.clientas.length} '
                              '${datos.clientas.length == 1 ? 'clienta' : 'clientas'}'
                              '${datos.conSaldo > 0 ? ' · ${datos.conSaldo} con saldo' : ''}',
                              style: const TextStyle(color: Marca.textoSuave, fontSize: 13),
                            ),
                          );
                        }

                        final c = datos.clientas[i - 1];
                        return _TarjetaClienta(
                          clienta: c,
                          prefijo: negocio?.prefijo ?? '+58',
                          negocio: negocio?.nombre ?? 'Arialé Studio',
                          alAgendar: () async {
                            final creada = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => PantallaNuevaCita(
                                  clientaPreseleccionada: ClientaElegida(
                                    id: c.id,
                                    nombre: c.nombre,
                                    telefono: c.telefono,
                                  ),
                                ),
                              ),
                            );
                            if (creada == true) _refrescar();
                          },
                          alAbrir: () async {
                            final cambio = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => PantallaClientaDetalle(id: c.id),
                              ),
                            );
                            if (cambio == true) _refrescar();
                          },
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TarjetaClienta extends StatelessWidget {
  const _TarjetaClienta({
    required this.clienta,
    required this.prefijo,
    required this.negocio,
    required this.alAgendar,
    required this.alAbrir,
  });

  final Clienta clienta;
  final String prefijo;
  final String negocio;
  final VoidCallback alAgendar;
  final VoidCallback alAbrir;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: alAbrir,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 21,
                    backgroundColor: Marca.dorado.withValues(alpha: 0.18),
                    child: Text(
                      iniciales(clienta.nombre),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Marca.negro,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          clienta.nombre,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                        Text(
                          telefonoBonito(clienta.telefono, prefijo),
                          style: const TextStyle(color: Marca.textoSuave, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => abrirWhatsApp(
                      clienta.telefono,
                      '¡Hola ${primerNombre(clienta.nombre)}! 💅',
                      prefijo: prefijo,
                    ),
                    icon: const Icon(Icons.chat_bubble_outline, size: 20),
                    color: Marca.exito,
                    style: IconButton.styleFrom(
                      backgroundColor: Marca.exito.withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
              const Divider(height: 20),
              Row(
                children: [
                  _Dato(rotulo: 'Visitas', valor: '${clienta.visitas}'),
                  _Dato(rotulo: 'Gastado', valor: dineroCorto(clienta.gastadoCentavos)),
                  _Dato(
                    rotulo: 'Última',
                    valor: clienta.ultimaVisita == null
                        ? '—'
                        : diaRelativo(clienta.ultimaVisita!),
                  ),
                ],
              ),
              if (clienta.saldoCentavos > 0 ||
                  clienta.citasProximas > 0 ||
                  clienta.sesionesBono > 0) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (clienta.saldoCentavos > 0)
                      Etiqueta('Debe ${dinero(clienta.saldoCentavos)}', color: Marca.error),
                    if (clienta.citasProximas > 0)
                      Etiqueta(
                        '${clienta.citasProximas} '
                        '${clienta.citasProximas == 1 ? 'cita' : 'citas'}',
                        color: Marca.exito,
                      ),
                    if (clienta.sesionesBono > 0)
                      Etiqueta('${clienta.sesionesBono} de bono', color: Marca.dorado),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: alAgendar,
                  icon: const Icon(Icons.calendar_month_outlined, size: 18),
                  label: const Text('Agendar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.rotulo, required this.valor});

  final String rotulo;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            rotulo.toUpperCase(),
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: Marca.textoSuave,
            ),
          ),
          const SizedBox(height: 2),
          Text(valor, style: cifra(14)),
        ],
      ),
    );
  }
}

class _DatosClientas {
  _DatosClientas({required this.clientas, required this.conSaldo});

  final List<Clienta> clientas;
  final int conSaldo;

  factory _DatosClientas.desdeJson(Map<String, dynamic> j) => _DatosClientas(
    conSaldo: (j['resumen'] as Map)['conSaldo'] as int? ?? 0,
    clientas: [
      for (final c in (j['clientas'] as List)) Clienta.desdeJson(c as Map<String, dynamic>),
    ],
  );
}
