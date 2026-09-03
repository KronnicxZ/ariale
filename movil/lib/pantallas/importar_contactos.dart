import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';

import '../api/cliente.dart';
import '../formato.dart';
import '../iconos.dart';
import '../sesion.dart';
import '../tema.dart';
import '../widgets/animar.dart';
import '../widgets/comunes.dart';

/// Trae clientas de un tirón desde la agenda del teléfono.
///
/// No existe una "lista de contactos de WhatsApp": WhatsApp usa la misma
/// agenda del teléfono que cualquier otra app, así que esto es en la
/// práctica lo mismo que pedía Alejandra —traer quien ya está guardada en
/// WhatsApp— sin depender de un permiso que WhatsApp no concede a nadie.
class PantallaImportarContactos extends StatefulWidget {
  const PantallaImportarContactos({super.key});

  @override
  State<PantallaImportarContactos> createState() =>
      _PantallaImportarContactosState();
}

enum _Estado { pidiendoPermiso, sinPermiso, cargando, listo, error, importando }

class _ContactoConTelefono {
  _ContactoConTelefono({required this.nombre, required this.telefono});
  final String nombre;
  final String telefono;
}

class _PantallaImportarContactosState extends State<PantallaImportarContactos> {
  _Estado _estado = _Estado.pidiendoPermiso;
  String? _mensajeError;
  List<_ContactoConTelefono> _contactos = [];
  final Set<String> _marcados = {};
  final _busqueda = TextEditingController();
  String _filtro = '';

  @override
  void initState() {
    super.initState();
    _pedirPermiso();
  }

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  Future<void> _pedirPermiso() async {
    setState(() => _estado = _Estado.pidiendoPermiso);

    try {
      var estado = await FlutterContacts.permissions.check(PermissionType.read);
      if (estado != PermissionStatus.granted) {
        estado = await FlutterContacts.permissions.request(PermissionType.read);
      }

      if (estado != PermissionStatus.granted) {
        if (mounted) setState(() => _estado = _Estado.sinPermiso);
        return;
      }

      await _cargarContactos();
    } catch (_) {
      // Esta función solo existe en Android/iOS. Si algo falla —incluido
      // abrirla en un dispositivo sin agenda de contactos— se avisa en vez
      // de dejar la pantalla colgada.
      if (mounted) {
        setState(() {
          _estado = _Estado.error;
          _mensajeError =
              'No pudimos abrir los contactos de este dispositivo.';
        });
      }
    }
  }

  Future<void> _cargarContactos() async {
    setState(() => _estado = _Estado.cargando);
    try {
      final crudos = await FlutterContacts.getAll(
        properties: const {ContactProperty.phone},
      );

      // Un contacto puede traer dos o tres números; nos quedamos con el
      // primero que parezca un teléfono real, que es lo único que importa
      // para escribirle por WhatsApp.
      final vistos = <String>{};
      final limpios = <_ContactoConTelefono>[];
      for (final c in crudos) {
        final nombre = (c.displayName ?? '').trim();
        if (nombre.isEmpty || c.phones.isEmpty) continue;
        final telefono = soloDigitos(c.phones.first.number);
        if (telefono.length < 10) continue;
        if (!vistos.add(telefono)) continue;
        limpios.add(_ContactoConTelefono(nombre: nombre, telefono: telefono));
      }
      limpios.sort((a, b) => a.nombre.toLowerCase().compareTo(b.nombre.toLowerCase()));

      if (!mounted) return;
      setState(() {
        _contactos = limpios;
        _estado = _Estado.listo;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _estado = _Estado.error;
        _mensajeError = 'No pudimos leer tus contactos.';
      });
    }
  }

  List<_ContactoConTelefono> get _visibles {
    if (_filtro.isEmpty) return _contactos;
    final q = _filtro.toLowerCase();
    return _contactos.where((c) => c.nombre.toLowerCase().contains(q)).toList();
  }

  void _alternar(String telefono) {
    setState(() {
      if (!_marcados.remove(telefono)) _marcados.add(telefono);
    });
  }

  void _marcarTodosLosVisibles() {
    setState(() {
      final visibles = _visibles.map((c) => c.telefono);
      final faltanAlgunos = visibles.any((t) => !_marcados.contains(t));
      if (faltanAlgunos) {
        _marcados.addAll(visibles);
      } else {
        _marcados.removeAll(visibles);
      }
    });
  }

  Future<void> _importar() async {
    if (_marcados.isEmpty) return;
    setState(() => _estado = _Estado.importando);

    final elegidos = _contactos.where((c) => _marcados.contains(c.telefono));
    final mensajero = ScaffoldMessenger.of(context);
    final navegador = Navigator.of(context);

    try {
      final r = await Sesion.de(context).enviar('/api/v1/clientas/importar', {
        'contactos': [
          for (final c in elegidos) {'nombre': c.nombre, 'telefono': c.telefono},
        ],
      });

      final creadas = r['creadas'] as int;
      final existentes = r['existentes'] as int;

      navegador.pop(creadas > 0);
      mensajero.showSnackBar(
        SnackBar(
          content: Text(
            existentes > 0
                ? '$creadas ${creadas == 1 ? 'clienta nueva' : 'clientas nuevas'}'
                    ' · $existentes ya estaban'
                : '$creadas ${creadas == 1 ? 'clienta importada' : 'clientas importadas'}',
          ),
        ),
      );
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _estado = _Estado.listo);
      mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Importar contactos'),
        actions: [
          if (_estado == _Estado.listo && _contactos.isNotEmpty)
            TextButton(
              onPressed: _marcarTodosLosVisibles,
              child: const Text('Marcar todos'),
            ),
        ],
      ),
      bottomNavigationBar: _marcados.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                child: FilledButton.icon(
                  onPressed: _estado == _Estado.importando ? null : _importar,
                  icon: _estado == _Estado.importando
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Marca.negro,
                          ),
                        )
                      : const Icon(Ico.nuevaClienta),
                  label: Text(
                    _marcados.length == 1
                        ? 'Importar 1 contacto'
                        : 'Importar ${_marcados.length} contactos',
                  ),
                ),
              ),
            ),
      body: SafeArea(child: _cuerpo()),
    );
  }

  Widget _cuerpo() {
    switch (_estado) {
      case _Estado.pidiendoPermiso:
      case _Estado.cargando:
        return const Center(child: CircularProgressIndicator());

      case _Estado.sinPermiso:
        return Padding(
          padding: const EdgeInsets.all(28),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Ico.buscarClienta, size: 34, color: Marca.textoTenue),
                const SizedBox(height: 16),
                Text(
                  'Necesitamos ver tus contactos',
                  textAlign: TextAlign.center,
                  style: titulo(19),
                ),
                const SizedBox(height: 8),
                Text(
                  'Solo para copiar el nombre y el teléfono de quien elijas. '
                  'La app no guarda ni comparte el resto de tu agenda.',
                  textAlign: TextAlign.center,
                  style: sutil(14),
                ),
                const SizedBox(height: 20),
                FilledButton(onPressed: _pedirPermiso, child: const Text('Intentar de nuevo')),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => FlutterContacts.permissions.openSettings(),
                  child: const Text('Abrir ajustes del teléfono'),
                ),
              ],
            ),
          ),
        );

      case _Estado.error:
        return ErrorConReintento(
          mensaje: _mensajeError ?? 'Algo salió mal.',
          alReintentar: _cargarContactos,
        );

      case _Estado.listo:
      case _Estado.importando:
        if (_contactos.isEmpty) {
          return const Vacio(
            icono: Ico.buscarClienta,
            titulo: 'Tu agenda está vacía',
            descripcion: 'No encontramos contactos con teléfono en el equipo.',
          );
        }
        final visibles = _visibles;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: TextField(
                controller: _busqueda,
                onChanged: (v) => setState(() => _filtro = v.trim()),
                decoration: const InputDecoration(
                  hintText: 'Buscar por nombre',
                  prefixIcon: Icon(Ico.buscar, size: 19),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: visibles.isEmpty
                  ? const Vacio(
                      icono: Ico.buscarClienta,
                      titulo: 'Nadie con ese nombre',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                      itemCount: visibles.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final c = visibles[i];
                        final marcado = _marcados.contains(c.telefono);
                        return Aparece(
                          posicion: i,
                          child: _FilaContacto(
                            nombre: c.nombre,
                            telefono: c.telefono,
                            marcado: marcado,
                            alTocar: () => _alternar(c.telefono),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
    }
  }
}

class _FilaContacto extends StatelessWidget {
  const _FilaContacto({
    required this.nombre,
    required this.telefono,
    required this.marcado,
    required this.alTocar,
  });

  final String nombre;
  final String telefono;
  final bool marcado;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: marcado ? Marca.dorado.withValues(alpha: 0.16) : Marca.tarjeta,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: marcado ? Marca.dorado : Colors.transparent,
                  border: Border.all(
                    color: marcado ? Marca.dorado : Marca.borde,
                    width: 1.6,
                  ),
                ),
                child: marcado
                    ? const Icon(Ico.listo, size: 15, color: Marca.negro)
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nombre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                      ),
                    ),
                    Text(telefonoBonito(telefono), style: sutil(12.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
