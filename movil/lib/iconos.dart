import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// El vocabulario de iconos de la app.
///
/// Uno solo, de Lucide —la misma familia que usa el panel web—, de trazo
/// fino y grosor uniforme. Estaban mezclados los rellenos y los contornos de
/// Material, y eso se nota aunque no se sepa por qué.
///
/// Se nombran por lo que significan en el estudio, no por su dibujo: si
/// mañana el icono de cobrar cambia, se cambia aquí y en ningún sitio más.
class Ico {
  const Ico._();

  // Acciones
  static const agregar = LucideIcons.plus;
  static const quitar = LucideIcons.minus;
  static const sumarUno = LucideIcons.circlePlus;
  static const restarUno = LucideIcons.circleMinus;
  static const editar = LucideIcons.pencil;
  static const borrar = LucideIcons.trash2;
  static const buscar = LucideIcons.search;
  static const cerrar = LucideIcons.x;
  static const listo = LucideIcons.check;
  static const reintentar = LucideIcons.refreshCw;
  static const salir = LucideIcons.logOut;
  static const anular = LucideIcons.ban;
  static const atras = LucideIcons.arrowLeft;
  static const siguiente = LucideIcons.chevronRight;
  static const anterior = LucideIcons.chevronLeft;
  static const ver = LucideIcons.eye;
  static const ocultar = LucideIcons.eyeOff;

  // Agenda
  static const hoy = LucideIcons.calendarCheck;
  static const agenda = LucideIcons.calendarDays;
  static const agendar = LucideIcons.calendarPlus;
  static const hora = LucideIcons.clock;
  static const cerrado = LucideIcons.moon;
  static const repetir = LucideIcons.repeat;

  // Clientas
  static const clientas = LucideIcons.users;
  static const clienta = LucideIcons.user;
  static const buscarClienta = LucideIcons.userSearch;
  static const nuevaClienta = LucideIcons.userPlus;
  static const whatsapp = LucideIcons.messageCircle;
  static const cumple = LucideIcons.cake;
  static const alergia = LucideIcons.heartPulse;
  static const nota = LucideIcons.notebookPen;

  // Dinero
  static const cobrar = LucideIcons.banknote;
  static const ventas = LucideIcons.receipt;
  static const gastos = LucideIcons.trendingDown;
  static const subida = LucideIcons.trendingUp;
  static const bajada = LucideIcons.trendingDown;
  static const compras = LucideIcons.package;
  static const proveedores = LucideIcons.truck;
  static const reportes = LucideIcons.chartColumn;

  // El estudio
  static const mas = LucideIcons.layoutGrid;
  static const servicios = LucideIcons.sparkles;
  static const bonos = LucideIcons.gift;
  static const equipo = LucideIcons.users;
  static const negocio = LucideIcons.store;
  static const clave = LucideIcons.lock;

  // Avisos
  static const recordatorios = LucideIcons.bell;
  static const atencion = LucideIcons.triangleAlert;
  static const error = LucideIcons.circleAlert;
  static const info = LucideIcons.info;
  static const bien = LucideIcons.circleCheck;
  static const celebrar = LucideIcons.partyPopper;
  static const sinPendientes = LucideIcons.mailCheck;
  static const sinConexion = LucideIcons.cloudOff;

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
