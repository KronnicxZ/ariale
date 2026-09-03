import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

/// Formato de dinero, fechas y enlaces de WhatsApp.
/// Mismas reglas que la web para que las dos se lean igual.

final _usd = NumberFormat('#,##0.00', 'es');
final _bs = NumberFormat('#,##0.00', 'es');

/// 167500 -> "$1.675,00". Los negativos con el menos delante.
String dinero(int centavos) {
  final signo = centavos < 0 ? '−' : '';
  return '$signo\$${_usd.format(centavos.abs() / 100)}';
}

/// Compacto para tarjetas estrechas: "$1,7k" a partir de 10.000.
String dineroCorto(int centavos) {
  final valor = centavos.abs() / 100;
  if (valor < 10000) return dinero(centavos);
  final signo = centavos < 0 ? '−' : '';
  return '$signo\$${(valor / 1000).toStringAsFixed(1).replaceAll('.', ',')}k';
}

/// El equivalente en bolívares a la tasa del día.
String bolivares(int centavos, double tasa) {
  if (tasa <= 0) return '—';
  return '${_bs.format(centavos / 100 * tasa)} Bs.';
}

/// "9:00 am". Lo armamos a mano porque el locale español devuelve
/// "a. m." con espacios y eso parte la hora en dos líneas en las tarjetas.
String hora(DateTime fecha) {
  final h = fecha.hour % 12 == 0 ? 12 : fecha.hour % 12;
  final m = fecha.minute.toString().padLeft(2, '0');
  return '$h:$m ${fecha.hour < 12 ? 'am' : 'pm'}';
}
String fechaCorta(DateTime fecha) => DateFormat('d MMM', 'es').format(fecha);
String fechaLarga(DateTime fecha) => DateFormat("EEEE d 'de' MMMM", 'es').format(fecha);
String fechaNumerica(DateTime fecha) => DateFormat('dd/MM/yyyy', 'es').format(fecha);

/// "Miércoles 2". El mes ya lo dice el título de arriba.
String diaYNumero(DateTime fecha) {
  final texto = DateFormat('EEEE d', 'es').format(fecha);
  return texto[0].toUpperCase() + texto.substring(1);
}

/// "Septiembre 2026", con mayúscula: es un título.
String mesYAno(DateTime fecha) {
  final texto = DateFormat('MMMM yyyy', 'es').format(fecha);
  return texto[0].toUpperCase() + texto.substring(1);
}

/// "2h 30min" a partir de minutos.
String duracion(int minutos) {
  final h = minutos ~/ 60;
  final m = minutos % 60;
  if (h == 0) return '$m min';
  if (m == 0) return '$h h';
  return '$h h $m min';
}

/// "hoy", "mañana" o la fecha corta.
String diaRelativo(DateTime fecha) {
  final ahora = DateTime.now();
  final dia = DateTime(fecha.year, fecha.month, fecha.day);
  final hoy = DateTime(ahora.year, ahora.month, ahora.day);
  final diferencia = dia.difference(hoy).inDays;
  if (diferencia == 0) return 'hoy';
  if (diferencia == 1) return 'mañana';
  if (diferencia == -1) return 'ayer';
  return fechaCorta(fecha);
}

/// yyyy-MM-dd, que es como viajan los días por la API.
String claveDia(DateTime fecha) => DateFormat('yyyy-MM-dd').format(fecha);

String iniciales(String nombre) {
  final partes = nombre.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (partes.isEmpty) return '?';
  if (partes.length == 1) return partes.first.substring(0, 1).toUpperCase();
  return (partes.first[0] + partes.last[0]).toUpperCase();
}

String primerNombre(String nombre) => nombre.trim().split(RegExp(r'\s+')).first;

/// Deja el teléfono en dígitos nacionales, sin prefijo ni cero inicial.
String soloDigitos(String telefono) => telefono
    .replaceAll(RegExp(r'\D'), '')
    .replaceFirst(RegExp(r'^58'), '')
    .replaceFirst(RegExp(r'^0'), '');

String telefonoBonito(String telefono, [String prefijo = '+58']) {
  final d = soloDigitos(telefono);
  if (d.length < 10) return d.isEmpty ? '' : '$prefijo $d';
  return '$prefijo 0${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}';
}

/// Abre WhatsApp con el mensaje ya escrito. Nunca se envía solo: la dueña
/// revisa y pulsa enviar, que es como quiere el estudio que funcione.
Future<bool> abrirWhatsApp(
  String telefono,
  String mensaje, {
  String prefijo = '+58',
}) async {
  final numero = '${prefijo.replaceAll(RegExp(r'\D'), '')}${soloDigitos(telefono)}';
  final uri = Uri.parse('https://wa.me/$numero?text=${Uri.encodeComponent(mensaje)}');
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<bool> llamar(String telefono, {String prefijo = '+58'}) {
  final numero = '${prefijo.replaceAll(RegExp(r'\D'), '')}${soloDigitos(telefono)}';
  return launchUrl(Uri.parse('tel:+$numero'));
}

/// Plantillas de mensaje, iguales a las de la web.
class Mensajes {
  const Mensajes._();

  static String citaConfirmada({
    required String clienta,
    required DateTime cuando,
    required String servicios,
    required String negocio,
    int? totalCentavos,
  }) {
    final total = totalCentavos == null ? '' : '\nTotal: ${dinero(totalCentavos)}';
    return '¡Hola ${primerNombre(clienta)}! 💅\n\n'
        'Tu cita en $negocio quedó confirmada:\n'
        '📅 ${fechaLarga(cuando)}\n'
        '🕐 ${hora(cuando)}\n'
        '✨ $servicios$total\n\n'
        'Si necesitas cambiarla, escríbeme por aquí. ¡Te esperamos!';
  }

  static String recordatorio({
    required String clienta,
    required DateTime cuando,
    required String servicios,
    required String negocio,
  }) =>
      '¡Hola ${primerNombre(clienta)}! 💕\n\n'
      'Te recuerdo tu cita en $negocio:\n'
      '🕐 ${diaRelativo(cuando)} a las ${hora(cuando)}\n'
      '✨ $servicios\n\n'
      '¿Todo bien para esa hora? Confírmame por favor 🙌';

  static String saldo({
    required String clienta,
    required int saldoCentavos,
    required String negocio,
  }) =>
      '¡Hola ${primerNombre(clienta)}! 😊\n\n'
      'Te escribo de $negocio para recordarte que tienes un saldo '
      'pendiente de ${dinero(saldoCentavos)}.\n\n'
      'Cuando puedas me avisas y lo cuadramos. ¡Gracias!';

  static String proximaSesion({
    required String clienta,
    required String servicio,
    required String negocio,
  }) =>
      '¡Hola ${primerNombre(clienta)}! 🌸\n\n'
      'Ya toca tu próxima sesión de $servicio en $negocio. '
      'Mantener el ciclo es lo que hace que el vello salga cada vez más fino.\n\n'
      '¿Te agendo esta semana?';
}
