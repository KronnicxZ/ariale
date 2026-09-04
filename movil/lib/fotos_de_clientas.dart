import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';

import 'api/cliente.dart';
import 'formato.dart';
import 'sesion.dart';
import 'tema.dart';

/// Las caras de las clientas, sacadas de la agenda del teléfono.
///
/// No son las fotos de perfil de WhatsApp: esas no las da nadie, no hay forma
/// de pedirlas. Son las de la ficha del contacto, que en Android suelen ser
/// las mismas porque WhatsApp las sincroniza en la agenda cuando tiene
/// permiso. Para quien no tenga foto guardada, se quedan las iniciales.
///
/// Se usa en los dos momentos: justo después de importar contactos, y cuando
/// se pide a mano volver a sincronizarlas desde la lista de clientas.

/// Un contacto con su cara, listo para subir.
typedef FotoDeContacto = ({String telefono, Uint8List? foto});

/// Sube las que tengan foto, una por una, con un aviso del avance.
///
/// Devuelve cuántas se guardaron. Las que fallen no cortan el resto: una cara
/// que no sube no es motivo para dejar a las demás sin la suya.
Future<int> subirFotosDeContactos(
  BuildContext context,
  List<FotoDeContacto> contactos, {
  bool mostrarResultado = false,
}) async {
  final conFoto = contactos.where((c) => c.foto != null && c.foto!.isNotEmpty).toList();
  if (conFoto.isEmpty) return 0;

  final api = Sesion.de(context);
  final mensajero = ScaffoldMessenger.of(context);
  final avance = ValueNotifier<int>(0);

  final aviso = mensajero.showSnackBar(
    SnackBar(
      duration: const Duration(minutes: 5),
      content: ValueListenableBuilder<int>(
        valueListenable: avance,
        builder: (context, hechas, _) => Text('Guardando fotos… $hechas de ${conFoto.length}'),
      ),
    ),
  );

  var guardadas = 0;
  for (final c in conFoto) {
    try {
      await api.subirArchivo(
        '/api/v1/clientas/foto',
        bytes: c.foto!,
        nombreArchivo: '${c.telefono}.jpg',
        tipo: 'image/jpeg',
        campos: {'telefono': c.telefono},
      );
      guardadas++;
    } on ErrorApi {
      // Una clienta que ya no está, o una foto que el servidor rechaza: se
      // salta y seguimos con las demás.
    }
    avance.value++;
  }

  aviso.close();
  avance.dispose();

  if (mostrarResultado) {
    mensajero.showSnackBar(
      SnackBar(
        content: Text(
          guardadas == 0
              ? 'Ninguno de tus contactos tenía foto guardada.'
              : '$guardadas ${guardadas == 1 ? 'foto guardada' : 'fotos guardadas'}.',
        ),
      ),
    );
  }
  return guardadas;
}

/// Vuelve a leer la agenda y actualiza las caras de las clientas que ya están.
///
/// Se cruza por teléfono: solo toca a las que ya son clientas, no da de alta a
/// nadie. Sirve para cuando alguien se cambia la foto.
Future<void> sincronizarFotosDesdeLaAgenda(BuildContext context) async {
  final mensajero = ScaffoldMessenger.of(context);

  var permiso = await FlutterContacts.permissions.check(PermissionType.read);
  if (permiso != PermissionStatus.granted) {
    permiso = await FlutterContacts.permissions.request(PermissionType.read);
  }
  if (permiso != PermissionStatus.granted) {
    mensajero.showSnackBar(
      const SnackBar(content: Text('Sin permiso para leer los contactos.')),
    );
    return;
  }

  if (!context.mounted) return;
  final api = Sesion.de(context);

  // La lista de clientas manda: solo se actualiza a quien ya está dada de
  // alta, no se importa a nadie por la puerta de atrás.
  final Set<String> telefonos;
  try {
    final datos = await api.obtener('/api/v1/clientas', params: {'filtro': 'todas'});
    telefonos = {
      for (final c in (datos['clientas'] as List))
        soloDigitos((c as Map)['telefono'] as String),
    };
  } on ErrorApi catch (e) {
    mensajero.showSnackBar(SnackBar(content: Text(e.mensaje)));
    return;
  }

  final crudos = await FlutterContacts.getAll(
    properties: const {ContactProperty.phone, ContactProperty.photoThumbnail},
  );

  final aSubir = <FotoDeContacto>[];
  final vistos = <String>{};
  for (final c in crudos) {
    final cara = c.photo?.thumbnail;
    if (cara == null || cara.isEmpty || c.phones.isEmpty) continue;
    for (final t in c.phones) {
      final telefono = soloDigitos(t.number);
      if (!telefonos.contains(telefono) || !vistos.add(telefono)) continue;
      aSubir.add((telefono: telefono, foto: cara));
      break;
    }
  }

  if (!context.mounted) return;
  if (aSubir.isEmpty) {
    mensajero.showSnackBar(
      const SnackBar(content: Text('Ninguna de tus clientas tiene foto en la agenda.')),
    );
    return;
  }

  await subirFotosDeContactos(context, aSubir, mostrarResultado: true);
}

/// El círculo de la clienta: su foto si la hay, y si no sus iniciales.
class CaraDeClienta extends StatelessWidget {
  const CaraDeClienta({
    super.key,
    required this.nombre,
    this.foto,
    this.tamano = 44,
  });

  final String nombre;
  final String? foto;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final letras = Container(
      width: tamano,
      height: tamano,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Marca.dorado, shape: BoxShape.circle),
      child: Text(
        iniciales(nombre),
        style: titulo(tamano * 0.34, color: Marca.negro),
      ),
    );

    if (foto == null || foto!.isEmpty) return letras;

    return ClipOval(
      child: Image.network(
        foto!,
        width: tamano,
        height: tamano,
        fit: BoxFit.cover,
        // Mientras carga, y si no carga, las iniciales: nunca un hueco gris.
        loadingBuilder: (context, hijo, avance) => avance == null ? hijo : letras,
        errorBuilder: (_, _, _) => letras,
      ),
    );
  }
}
