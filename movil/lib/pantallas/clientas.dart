import 'package:flutter/material.dart';

import '../api/cliente.dart';
import '../api/modelos.dart';
import '../formato.dart';
import '../iconos.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/animar.dart';
import '../widgets/comunes.dart';
import 'clienta_detalle.dart';
import 'elegir_clienta.dart';
import 'nueva_cita.dart';

/// Directorio de clientas con búsqueda y filtros.
///
/// Manteniendo pulsada una tarjeta se entra en modo selección, para borrar
/// varias de una vez sin tener que abrir cada ficha.
class PantallaClientas extends StatefulWidget {
  const PantallaClientas({super.key});

  @override
  State<PantallaClientas> createState() => _PantallaClientasState();
}

class _PantallaClientasState extends State<PantallaClientas> {
  final _busqueda = TextEditingController();
  String _filtro = 'todas';
  late Future<_DatosClientas> _futuro;

  /// Vacío mientras no se esté seleccionando. Con algo dentro, la pantalla
  /// cambia de modo: tocar marca en vez de abrir.
  final Set<String> _marcadas = {};
  bool _borrando = false;

  static const _filtros = [
    ('todas', 'Todas'),
    ('con-cita', 'Con cita'),
    ('con-saldo', 'Con saldo'),
    ('con-bono', 'Con bono'),
    ('nuevas', 'Nuevas'),
  ];

  bool get _seleccionando => _marcadas.isNotEmpty;

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
    setState(() {
      _futuro = futuro;
      _marcadas.clear();
    });
    await futuro;
  }

  void _alternarMarca(String id) {
    setState(() {
      if (!_marcadas.remove(id)) _marcadas.add(id);
    });
  }

  /// Borra las marcadas. Las que tienen historial no se borran de verdad:
  /// el servidor las desactiva para que las ventas pasadas sigan cuadrando.
  Future<void> _borrarMarcadas() async {
    final cuantas = _marcadas.length;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(cuantas == 1 ? '¿Eliminar la clienta?' : '¿Eliminar $cuantas clientas?'),
        content: const Text(
          'Las que ya tengan citas o ventas no se borran del todo: se '
          'archivan, para que las cuentas de antes sigan cuadrando.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: Marca.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;

    setState(() => _borrando = true);
    final api = Sesion.de(context);
    final mensajero = ScaffoldMessenger.of(context);
    var archivadas = 0;

    try {
      for (final id in _marcadas.toList()) {
        final r = await api.borrar('/api/v1/clientas/$id');
        if (r['desactivada'] == true) archivadas++;
      }
      mensajero.showSnackBar(
        SnackBar(
          content: Text(
            archivadas == 0
                ? (cuantas == 1 ? 'Clienta eliminada.' : '$cuantas clientas eliminadas.')
                : '$archivadas con historial se archivaron; el resto se eliminó.',
          ),
        ),
      );
    } on ErrorApi catch (e) {
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    } finally {
      if (mounted) setState(() => _borrando = false);
      await _refrescar();
    }
  }

  @override
  Widget build(BuildContext context) {
    final negocio = Sesion.catalogo?.negocio;

    return PopScope(
      canPop: !_seleccionando,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(_marcadas.clear);
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              if (_seleccionando)
                _BarraSeleccion(
                  cuantas: _marcadas.length,
                  borrando: _borrando,
                  alCancelar: () => setState(_marcadas.clear),
                  alBorrar: _borrarMarcadas,
                )
              else
                _Buscador(
                  controlador: _busqueda,
                  alBuscar: _refrescar,
                ),
              const SizedBox(height: 10),
              SizedBox(
                height: 38,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    for (final (valor, etiqueta) in _filtros)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(etiqueta),
                          selected: _filtro == valor,
                          showCheckmark: false,
                          onSelected: (_) {
                            setState(() {
                              _filtro = valor;
                              _marcadas.clear();
                            });
                            _refrescar();
                          },
                          labelStyle: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.2,
                            color: _filtro == valor ? Colors.white : Marca.textoSuave,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
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
                        padding: EdgeInsets.all(20),
                        child: Vacio(
                          icono: Ico.clientas,
                          titulo: 'No encontramos a nadie',
                          descripcion: 'Prueba con otro nombre o cambia el filtro.',
                        ),
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: _refrescar,
                      color: Marca.dorado,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 104),
                        itemCount: datos.clientas.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text(
                                '${datos.clientas.length} '
                                '${datos.clientas.length == 1 ? 'clienta' : 'clientas'}'
                                '${datos.conSaldo > 0 ? ' · ${datos.conSaldo} con saldo' : ''}',
                                style: sutil(13),
                              ),
                            );
                          }

                          final c = datos.clientas[i - 1];
                          return Aparece(
                            posicion: i,
                            child: _TarjetaClienta(
                              clienta: c,
                              prefijo: negocio?.prefijo ?? '+58',
                              marcada: _marcadas.contains(c.id),
                              seleccionando: _seleccionando,
                              alMarcar: () => _alternarMarca(c.id),
                              alAgendar: () => _agendar(c),
                              alAbrir: () => _abrir(c),
                            ),
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
      ),
    );
  }

  Future<void> _agendar(Clienta c) async {
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
  }

  Future<void> _abrir(Clienta c) async {
    final cambio = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => PantallaClientaDetalle(id: c.id)),
    );
    if (cambio == true) _refrescar();
  }
}

class _Buscador extends StatelessWidget {
  const _Buscador({required this.controlador, required this.alBuscar});

  final TextEditingController controlador;
  final VoidCallback alBuscar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Clientas', style: titulo(24)),
          const SizedBox(height: 12),
          TextField(
            controller: controlador,
            onSubmitted: (_) => alBuscar(),
            decoration: InputDecoration(
              hintText: 'Buscar por nombre o teléfono',
              prefixIcon: const Icon(Ico.buscar, size: 19),
              suffixIcon: controlador.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Ico.cerrar, size: 17),
                      onPressed: () {
                        controlador.clear();
                        alBuscar();
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sustituye al buscador mientras hay clientas marcadas.
class _BarraSeleccion extends StatelessWidget {
  const _BarraSeleccion({
    required this.cuantas,
    required this.borrando,
    required this.alCancelar,
    required this.alBorrar,
  });

  final int cuantas;
  final bool borrando;
  final VoidCallback alCancelar;
  final VoidCallback alBorrar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: alCancelar,
            icon: const Icon(Ico.cerrar, size: 20),
            tooltip: 'Cancelar',
          ),
          Expanded(
            child: Text(
              cuantas == 1 ? '1 seleccionada' : '$cuantas seleccionadas',
              style: titulo(19),
            ),
          ),
          if (borrando)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
            )
          else
            TextButton.icon(
              onPressed: alBorrar,
              icon: const Icon(Ico.borrar, size: 18),
              label: const Text('Eliminar'),
              style: TextButton.styleFrom(foregroundColor: Marca.error),
            ),
        ],
      ),
    );
  }
}

/// La clienta en la lista: quién es arriba, cómo va debajo. Sin columnas ni
/// botones anchos, que era lo que hacía la tarjeta desordenada.
class _TarjetaClienta extends StatelessWidget {
  const _TarjetaClienta({
    required this.clienta,
    required this.prefijo,
    required this.marcada,
    required this.seleccionando,
    required this.alMarcar,
    required this.alAgendar,
    required this.alAbrir,
  });

  final Clienta clienta;
  final String prefijo;
  final bool marcada;
  final bool seleccionando;
  final VoidCallback alMarcar;
  final VoidCallback alAgendar;
  final VoidCallback alAbrir;

  @override
  Widget build(BuildContext context) {
    final resumen = [
      '${clienta.visitas} ${clienta.visitas == 1 ? 'visita' : 'visitas'}',
      dinero(clienta.gastadoCentavos),
      if (clienta.ultimaVisita case final u?) diaRelativo(u),
    ].join('  ·  ');

    return Material(
      color: marcada ? Marca.dorado.withValues(alpha: 0.16) : Marca.tarjeta,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: seleccionando ? alMarcar : alAbrir,
        onLongPress: alMarcar,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Avatar(nombre: clienta.nombre, marcada: marcada),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          clienta.nombre,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          telefonoBonito(clienta.telefono, prefijo),
                          style: sutil(12.5, color: Marca.textoTenue),
                        ),
                      ],
                    ),
                  ),
                  if (!seleccionando) ...[
                    IconButton(
                      tooltip: 'Agendar',
                      onPressed: alAgendar,
                      icon: const Icon(Ico.agendar, size: 19),
                      color: Marca.texto,
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      tooltip: 'Escribir por WhatsApp',
                      onPressed: () => abrirWhatsApp(
                        clienta.telefono,
                        '¡Hola ${primerNombre(clienta.nombre)}! 💅',
                        prefijo: prefijo,
                      ),
                      icon: const Icon(Ico.whatsapp, size: 19),
                      color: Marca.exito,
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(resumen, style: sutil(12.5)),
              if (clienta.saldoCentavos > 0 ||
                  clienta.citasProximas > 0 ||
                  clienta.sesionesBono > 0) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (clienta.saldoCentavos > 0)
                      Etiqueta('Debe ${dinero(clienta.saldoCentavos)}',
                          color: Marca.error),
                    if (clienta.citasProximas > 0)
                      Etiqueta(
                        '${clienta.citasProximas} '
                        '${clienta.citasProximas == 1 ? 'cita' : 'citas'}',
                        color: Marca.exito,
                      ),
                    if (clienta.sesionesBono > 0)
                      Etiqueta('${clienta.sesionesBono} de bono',
                          color: Marca.dorado),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.nombre, required this.marcada});

  final String nombre;
  final bool marcada;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: marcada ? Marca.dorado : Marca.dorado.withValues(alpha: 0.16),
        shape: BoxShape.circle,
      ),
      child: marcada
          ? const Icon(Ico.listo, size: 20, color: Marca.negro)
          : Text(
              iniciales(nombre),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Marca.negro,
              ),
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
          for (final c in (j['clientas'] as List))
            Clienta.desdeJson(c as Map<String, dynamic>),
        ],
      );
}
