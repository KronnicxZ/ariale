import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// El vocabulario de iconos de la app.
///
/// Uno solo, de Lucide —la misma familia que usa el panel web—, en su corte
/// de trazo fino (300). Un icono más grueso que el texto que acompaña se
/// lee como un botón; con este grosor se lee como una palabra más.
///
/// Se nombran por lo que significan en el estudio, no por su dibujo: si
/// mañana el icono de cobrar cambia, se cambia aquí y en ningún sitio más.
class Ico {
  const Ico._();

  // Acciones
  static const agregar = LucideIcons.plus300;
  static const quitar = LucideIcons.minus300;
  static const sumarUno = LucideIcons.circlePlus300;
  static const restarUno = LucideIcons.circleMinus300;
  static const editar = LucideIcons.pencil300;
  static const borrar = LucideIcons.trash2300;
  static const buscar = LucideIcons.search300;
  static const cerrar = LucideIcons.x300;
  static const listo = LucideIcons.check300;
  static const reintentar = LucideIcons.refreshCw300;
  static const salir = LucideIcons.logOut300;
  static const anular = LucideIcons.ban300;
  static const atras = LucideIcons.arrowLeft300;
  static const siguiente = LucideIcons.chevronRight300;
  static const anterior = LucideIcons.chevronLeft300;
  static const ver = LucideIcons.eye300;
  static const ocultar = LucideIcons.eyeOff300;

  // Agenda
  static const hoy = LucideIcons.calendarCheck300;
  static const agenda = LucideIcons.calendarDays300;
  static const agendar = LucideIcons.calendarPlus300;
  static const hora = LucideIcons.clock300;
  static const cerrado = LucideIcons.moon300;
  static const repetir = LucideIcons.repeat300;

  // Clientas
  static const clientas = LucideIcons.users300;
  static const clienta = LucideIcons.user300;
  static const buscarClienta = LucideIcons.userSearch300;
  static const nuevaClienta = LucideIcons.userPlus300;
  static const whatsapp = LucideIcons.messageCircle300;
  static const cumple = LucideIcons.cake300;
  static const alergia = LucideIcons.heartPulse300;
  static const nota = LucideIcons.notebookPen300;

  // Dinero
  static const cobrar = LucideIcons.banknote300;
  static const ventas = LucideIcons.receipt300;
  static const gastos = LucideIcons.trendingDown300;
  static const subida = LucideIcons.trendingUp300;
  static const bajada = LucideIcons.trendingDown300;
  static const compras = LucideIcons.package300;
  static const proveedores = LucideIcons.truck300;
  static const reportes = LucideIcons.chartColumn300;

  // El estudio
  static const mas = LucideIcons.layoutGrid300;
  static const servicios = LucideIcons.sparkles300;
  static const bonos = LucideIcons.gift300;
  static const equipo = LucideIcons.users300;
  static const negocio = LucideIcons.store300;
  static const clave = LucideIcons.lock300;

  // Avisos
  static const recordatorios = LucideIcons.bell300;
  static const atencion = LucideIcons.triangleAlert300;
  static const error = LucideIcons.circleAlert300;
  static const info = LucideIcons.info300;
  static const bien = LucideIcons.circleCheck300;
  static const celebrar = LucideIcons.partyPopper300;
  static const sinPendientes = LucideIcons.mailCheck300;
  static const sinConexion = LucideIcons.cloudOff300;

  /// Lucide dibuja con el trazo centrado y sale algo más grande que Material
  /// al mismo tamaño nominal. Este ajuste iguala el peso óptico.
  static const double tamano = 19;
  static const double tamanoBarra = 22;
  static const double tamanoPequeno = 16;
}

/// Icono de la app, siempre con el mismo grosor de trazo.
class Icono extends StatelessWidget {
  const Icono(this.icono, {super.key, this.tamano = Ico.tamano, this.color});

  final IconData icono;
  final double tamano;
  final Color? color;

  @override
  Widget build(BuildContext context) =>
      Icon(icono, size: tamano, color: color);
}
