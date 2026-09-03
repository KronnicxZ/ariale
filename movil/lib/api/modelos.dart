/// Modelos que corresponden uno a uno con lo que devuelve la API.
/// El dinero siempre en centavos de USD; las fechas llegan en UTC y se
/// muestran en la zona del salón.
library;

class Cita {
  Cita({
    required this.id,
    required this.inicio,
    required this.fin,
    required this.estado,
    required this.origen,
    required this.clientaId,
    required this.clientaNombre,
    required this.clientaTelefono,
    required this.especialistaId,
    required this.especialistaNombre,
    required this.especialistaColor,
    required this.servicios,
    required this.totalCentavos,
    required this.duracionMin,
    this.nota,
    this.ventaId,
  });

  final String id;
  final DateTime inicio;
  final DateTime fin;
  final String estado;
  final String origen;
  final String clientaId;
  final String clientaNombre;
  final String clientaTelefono;
  final String especialistaId;
  final String especialistaNombre;
  final String especialistaColor;
  final List<String> servicios;
  final int totalCentavos;
  final int duracionMin;
  final String? nota;
  final String? ventaId;

  bool get atendida => estado == 'ATTENDED';
  bool get cancelada => estado == 'CANCELLED' || estado == 'NO_SHOW';
  bool get porConfirmar => estado == 'PENDING';
  bool get cobrada => ventaId != null;
  String get resumenServicios => servicios.join(' + ');

  factory Cita.desdeJson(Map<String, dynamic> j) => Cita(
        id: j['id'] as String,
        inicio: DateTime.parse(j['inicio'] as String).toLocal(),
        fin: DateTime.parse(j['fin'] as String).toLocal(),
        estado: j['estado'] as String,
        origen: j['origen'] as String? ?? 'ADMIN',
        nota: j['nota'] as String?,
        clientaId: (j['clienta'] as Map)['id'] as String,
        clientaNombre: (j['clienta'] as Map)['nombre'] as String,
        clientaTelefono: (j['clienta'] as Map)['telefono'] as String,
        especialistaId: (j['especialista'] as Map)['id'] as String,
        especialistaNombre: (j['especialista'] as Map)['nombre'] as String,
        especialistaColor: (j['especialista'] as Map)['color'] as String,
        servicios: [
          for (final s in (j['servicios'] as List)) (s as Map)['nombre'] as String,
        ],
        totalCentavos: j['totalCentavos'] as int,
        duracionMin: j['duracionMin'] as int,
        ventaId: j['ventaId'] as String?,
      );
}

class DiaResumen {
  DiaResumen({
    required this.dia,
    required this.diaSemana,
    required this.numero,
    required this.mes,
    required this.citas,
  });

  final String dia;
  final int diaSemana;
  final int numero;
  final String mes;
  final int citas;

  factory DiaResumen.desdeJson(Map<String, dynamic> j) => DiaResumen(
        dia: j['dia'] as String,
        diaSemana: j['diaSemana'] as int,
        numero: j['numero'] as int,
        mes: j['mes'] as String,
        citas: j['citas'] as int,
      );
}

class ResumenHoy {
  ResumenHoy({
    required this.hoy,
    required this.citas,
    required this.semana,
    required this.proximaCitaId,
    required this.total,
    required this.atendidas,
    required this.porConfirmar,
    required this.vencidas,
    required this.previstoCentavos,
    required this.ventasMesCentavos,
    required this.cobradoMesCentavos,
    required this.porCobrarCentavos,
  });

  final String hoy;
  final List<Cita> citas;
  final List<DiaResumen> semana;
  final String? proximaCitaId;
  final int total;
  final int atendidas;
  final int porConfirmar;
  final int vencidas;
  final int previstoCentavos;
  final int ventasMesCentavos;
  final int cobradoMesCentavos;
  final int porCobrarCentavos;

  factory ResumenHoy.desdeJson(Map<String, dynamic> j) {
    final contadores = j['contadores'] as Map<String, dynamic>;
    final dinero = j['dinero'] as Map<String, dynamic>;
    return ResumenHoy(
      hoy: j['hoy'] as String,
      proximaCitaId: j['proximaCitaId'] as String?,
      citas: [
        for (final c in (j['citas'] as List)) Cita.desdeJson(c as Map<String, dynamic>),
      ],
      semana: [
        for (final d in (j['semana'] as List))
          DiaResumen.desdeJson(d as Map<String, dynamic>),
      ],
      total: contadores['total'] as int,
      atendidas: contadores['atendidas'] as int,
      porConfirmar: contadores['porConfirmar'] as int,
      vencidas: contadores['vencidas'] as int,
      previstoCentavos: dinero['previstoCentavos'] as int,
      ventasMesCentavos: dinero['ventasMesCentavos'] as int,
      cobradoMesCentavos: dinero['cobradoMesCentavos'] as int,
      porCobrarCentavos: dinero['porCobrarCentavos'] as int,
    );
  }
}

class Servicio {
  Servicio({
    required this.id,
    required this.nombre,
    required this.precioCentavos,
    required this.duracionMin,
    required this.categoriaId,
    required this.categoriaNombre,
    required this.categoriaColor,
    this.zona,
    this.requierePrueba = false,
  });

  final String id;
  final String nombre;
  final int precioCentavos;
  final int duracionMin;
  final String categoriaId;
  final String categoriaNombre;
  final String categoriaColor;
  final String? zona;
  final bool requierePrueba;

  factory Servicio.desdeJson(Map<String, dynamic> j) => Servicio(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        precioCentavos: j['precioCentavos'] as int,
        duracionMin: j['duracionMin'] as int,
        categoriaId: j['categoriaId'] as String,
        categoriaNombre: j['categoriaNombre'] as String,
        categoriaColor: j['categoriaColor'] as String,
        zona: j['zona'] as String?,
        requierePrueba: j['requierePrueba'] as bool? ?? false,
      );
}

class Especialista {
  Especialista({
    required this.id,
    required this.nombre,
    required this.color,
    required this.servicioIds,
  });

  final String id;
  final String nombre;
  final String color;
  final List<String> servicioIds;

  factory Especialista.desdeJson(Map<String, dynamic> j) => Especialista(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        color: j['color'] as String,
        servicioIds: [for (final s in (j['servicioIds'] as List)) s as String],
      );

  bool puedeHacer(List<String> ids) =>
      servicioIds.isEmpty || ids.every(servicioIds.contains);
}

class Negocio {
  Negocio({
    required this.nombre,
    required this.lema,
    required this.prefijo,
    required this.zonaHoraria,
    required this.colorAcento,
  });

  final String nombre;
  final String lema;
  final String prefijo;
  final String zonaHoraria;
  final String colorAcento;

  factory Negocio.desdeJson(Map<String, dynamic> j) => Negocio(
        nombre: j['nombre'] as String,
        lema: j['lema'] as String? ?? '',
        prefijo: j['prefijo'] as String? ?? '+58',
        zonaHoraria: j['zonaHoraria'] as String? ?? 'America/Caracas',
        colorAcento: j['colorAcento'] as String? ?? '#E9B21C',
      );
}

/// Un día de la semana en el horario del estudio.
class HorarioDia {
  HorarioDia({
    required this.dia,
    required this.abierto,
    required this.desde,
    required this.hasta,
  });

  /// 0 = domingo, como en Dart y como en la base de datos.
  final int dia;
  final bool abierto;

  /// "09:00" y "18:00".
  final String desde;
  final String hasta;

  int get desdeMin => _aMinutos(desde, 9 * 60);
  int get hastaMin => _aMinutos(hasta, 18 * 60);

  static int _aMinutos(String texto, int alterno) {
    final partes = texto.split(':');
    if (partes.length != 2) return alterno;
    final h = int.tryParse(partes[0]);
    final m = int.tryParse(partes[1]);
    if (h == null || m == null) return alterno;
    return h * 60 + m;
  }

  factory HorarioDia.desdeJson(Map<String, dynamic> j) => HorarioDia(
        dia: j['dia'] as int,
        abierto: j['abierto'] as bool? ?? true,
        desde: j['desde'] as String? ?? '09:00',
        hasta: j['hasta'] as String? ?? '18:00',
      );
}

class Catalogo {
  Catalogo({
    required this.hoy,
    required this.maxDia,
    required this.negocio,
    required this.servicios,
    required this.especialistas,
    required this.horario,
    required this.masPedidos,
    required this.tasa,
  });

  final String hoy;
  final String maxDia;
  final Negocio negocio;
  final List<Servicio> servicios;
  final List<Especialista> especialistas;
  final List<HorarioDia> horario;

  /// Ids de los servicios más agendados en los últimos meses. Salen primero
  /// al agendar porque son los que casi siempre se agendan.
  final List<String> masPedidos;
  final double tasa;

  /// El horario de un día concreto; si falta, se asume abierto 9–18.
  HorarioDia horarioDe(DateTime fecha) => horario.firstWhere(
        (h) => h.dia == fecha.weekday % 7,
        orElse: () => HorarioDia(dia: fecha.weekday % 7, abierto: true, desde: '09:00', hasta: '18:00'),
      );

  factory Catalogo.desdeJson(Map<String, dynamic> j) => Catalogo(
        hoy: j['hoy'] as String,
        maxDia: j['maxDia'] as String,
        negocio: Negocio.desdeJson(j['negocio'] as Map<String, dynamic>),
        tasa: ((j['tasa'] as Map)['valor'] as num).toDouble(),
        servicios: [
          for (final s in (j['servicios'] as List))
            Servicio.desdeJson(s as Map<String, dynamic>),
        ],
        especialistas: [
          for (final e in (j['especialistas'] as List))
            Especialista.desdeJson(e as Map<String, dynamic>),
        ],
        horario: [
          for (final h in (j['horario'] as List? ?? const []))
            HorarioDia.desdeJson(h as Map<String, dynamic>),
        ],
        masPedidos: [
          for (final s in (j['masPedidos'] as List? ?? const [])) s as String,
        ],
      );
}

class Clienta {
  Clienta({
    required this.id,
    required this.nombre,
    required this.telefono,
    required this.activa,
    required this.visitas,
    required this.gastadoCentavos,
    required this.saldoCentavos,
    required this.citasProximas,
    required this.sesionesBono,
    this.correo,
    this.alergias,
    this.ultimaVisita,
  });

  final String id;
  final String nombre;
  final String telefono;
  final bool activa;
  final int visitas;
  final int gastadoCentavos;
  final int saldoCentavos;
  final int citasProximas;
  final int sesionesBono;
  final String? correo;
  final String? alergias;
  final DateTime? ultimaVisita;

  factory Clienta.desdeJson(Map<String, dynamic> j) => Clienta(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        telefono: j['telefono'] as String,
        activa: j['activa'] as bool? ?? true,
        visitas: j['visitas'] as int? ?? 0,
        gastadoCentavos: j['gastadoCentavos'] as int? ?? 0,
        saldoCentavos: j['saldoCentavos'] as int? ?? 0,
        citasProximas: j['citasProximas'] as int? ?? 0,
        sesionesBono: j['sesionesBono'] as int? ?? 0,
        correo: j['correo'] as String?,
        alergias: j['alergias'] as String?,
        ultimaVisita: j['ultimaVisita'] == null
            ? null
            : DateTime.parse(j['ultimaVisita'] as String).toLocal(),
      );
}

class Hueco {
  Hueco({required this.hora, required this.franja});
  final String hora;
  final String franja;

  factory Hueco.desdeJson(Map<String, dynamic> j) =>
      Hueco(hora: j['hora'] as String, franja: j['franja'] as String);
}
