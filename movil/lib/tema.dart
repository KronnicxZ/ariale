import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Identidad de Arialé Studio.
///
/// La regla es de contención: fondo gris cálido, tarjetas blancas sin borde
/// ni sombra, texto casi negro y gris para lo secundario. El dorado del logo
/// aparece poco —selección y acción principal— y por eso se nota.
class Marca {
  const Marca._();

  static const dorado = Color(0xFFE9B21C);
  static const negro = Color(0xFF17171A);

  /// Gris cálido de fondo. Las tarjetas blancas se recortan contra él sin
  /// necesidad de bordes ni sombras.
  static const fondo = Color(0xFFF2F1EE);
  static const tarjeta = Colors.white;

  static const texto = Color(0xFF17171A);
  static const textoSuave = Color(0xFF8A8A8F);
  static const textoTenue = Color(0xFFB6B6BB);

  /// Filo de un pelo, como los separadores de iOS.
  static const borde = Color(0xFFE6E5E2);

  /// El velo que aparece al pasar por encima o al pulsar. Es el mismo en
  /// toda la app: si cada componente inventa el suyo, se nota.
  static const roce = Color(0x0A17171A);
  static const rocePulsado = Color(0x1417171A);

  /// Medidas del respiro. Están aquí para que el aire sea el mismo en todas
  /// las pantallas y no dependa de lo que recordara cada una.
  static const margen = 20.0;
  static const entreTarjetas = 10.0;
  static const dentroTarjeta = 16.0;

  static const exito = Color(0xFF2F9E68);
  static const alerta = Color(0xFFD1901E);
  static const error = Color(0xFFDE3B40);

  /// Pasteles para distinguir categorías y especialistas.
  static const rosa = Color(0xFFE9A8B4);
  static const salvia = Color(0xFFA8C7A9);
  static const lavanda = Color(0xFFBDAEDC);
  static const cielo = Color(0xFFA6C4DC);
  static const durazno = Color(0xFFF0C79A);

  /// Convierte "#E9B21C" en Color. Los colores de categorías y especialistas
  /// vienen así desde la API, configurables desde el panel.
  static Color desdeHex(String? hex, {Color alterno = dorado}) {
    if (hex == null) return alterno;
    final limpio = hex.replaceFirst('#', '').trim();
    if (limpio.length != 6) return alterno;
    final valor = int.tryParse(limpio, radix: 16);
    return valor == null ? alterno : Color(0xFF000000 | valor);
  }

  /// Negro sobre dorado se lee mejor que blanco: el dorado es claro.
  static Color contrasteSobre(Color fondo) =>
      fondo.computeLuminance() > 0.55 ? negro : Colors.white;
}

/// El sistema tipográfico tiene tres voces y una regla para cada una.
///
/// Instrument Serif, de contraste alto, solo en los títulos grandes: es de
/// donde sale la elegancia. No es una script ni una cursiva —cada letra va
/// suelta y en vertical—, sino una serif moderna de las que usan las marcas
/// de belleza en portada.
///
/// Manrope en todo lo demás: encabezados de sección, texto y cifras. Es
/// geométrica y limpia, y aguanta bien el tamaño pequeño, que es donde una
/// serif de contraste alto se rompe.
///
/// A partir de este tamaño, un título se lee como una pieza y puede ir en
/// serif. Por debajo es un rótulo de trabajo y va en sans.
const _tamanoSerif = 22.0;

double _apretado(double tamano) {
  if (tamano >= 30) return -0.8;
  if (tamano >= 24) return -0.6;
  if (tamano >= 19) return -0.4;
  return -0.2;
}

TextStyle titulo(double tamano, {Color? color, FontWeight? peso}) {
  if (tamano >= _tamanoSerif) {
    return GoogleFonts.instrumentSerif(
      fontSize: tamano * 1.12,
      fontWeight: peso ?? FontWeight.w400,
      color: color ?? Marca.texto,
      height: 1.06,
      letterSpacing: _apretado(tamano),
    );
  }
  return GoogleFonts.manrope(
    fontSize: tamano,
    fontWeight: peso ?? FontWeight.w700,
    color: color ?? Marca.texto,
    height: 1.15,
    letterSpacing: _apretado(tamano),
  );
}

/// Rótulo diminuto en versales para encabezar una sección o una columna.
/// Es el escalón que faltaba entre el título y el texto gris.
TextStyle micro({Color? color}) => GoogleFonts.manrope(
      fontSize: 10.5,
      fontWeight: FontWeight.w700,
      color: color ?? Marca.textoTenue,
      letterSpacing: 0.8,
    );

/// Cifras con espaciado tabular: el dinero se lee de un vistazo y las
/// columnas de números no bailan al cambiar de valor.
TextStyle cifra(double tamano, {Color? color, FontWeight peso = FontWeight.w600}) =>
    GoogleFonts.manrope(
      fontSize: tamano,
      fontWeight: peso,
      color: color ?? Marca.texto,
      letterSpacing: _apretado(tamano),
      fontFeatures: const [FontFeature.tabularFigures()],
    );

/// Rótulo pequeño y gris para lo secundario. Se llama `sutil` y no `apoyo`
/// porque varios widgets ya tienen un campo con ese nombre.
TextStyle sutil(double tamano, {Color? color, FontWeight peso = FontWeight.w400}) =>
    GoogleFonts.manrope(
      fontSize: tamano,
      fontWeight: peso,
      color: color ?? Marca.textoSuave,
      letterSpacing: -0.1,
      height: 1.3,
    );

ThemeData construirTema() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Marca.dorado,
      primary: Marca.dorado,
      onPrimary: Marca.negro,
      surface: Marca.tarjeta,
      onSurface: Marca.texto,
      error: Marca.error,
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: Marca.fondo,
    splashFactory: InkSparkle.splashFactory,
    hoverColor: Marca.roce,
    highlightColor: Marca.roce,
    splashColor: Marca.rocePulsado,
    focusColor: Marca.roce,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );

  final texto = GoogleFonts.manropeTextTheme(base.textTheme).apply(
    bodyColor: Marca.texto,
    displayColor: Marca.texto,
  );

  return base.copyWith(
    textTheme: texto,
    // La barra superior no compite con el título grande de la pantalla:
    // se queda del color del fondo y sin línea.
    appBarTheme: AppBarTheme(
      backgroundColor: Marca.fondo,
      surfaceTintColor: Colors.transparent,
      foregroundColor: Marca.texto,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.manrope(
        fontSize: 16.5,
        fontWeight: FontWeight.w600,
        color: Marca.texto,
        letterSpacing: -0.3,
      ),
      iconTheme: const IconThemeData(color: Marca.texto, size: 22),
    ),
    // Tarjetas: blanco sobre gris. Ni borde ni sombra; el contraste basta.
    cardTheme: CardThemeData(
      color: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        minimumSize: const Size(0, 52),
        elevation: 0,
        overlayColor: Marca.negro,
        textStyle: GoogleFonts.manrope(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    // El botón secundario es un relleno tenue, no un contorno: menos líneas
    // en pantalla y el mismo peso visual.
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Marca.texto,
        backgroundColor: Marca.tarjeta,
        minimumSize: const Size(0, 48),
        side: BorderSide.none,
        overlayColor: Marca.texto,
        textStyle: GoogleFonts.manrope(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Marca.texto,
        textStyle: GoogleFonts.manrope(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Marca.tarjeta,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: const BorderSide(color: Marca.dorado, width: 1.6),
      ),
      labelStyle: GoogleFonts.manrope(color: Marca.textoSuave, fontSize: 14),
      helperStyle: GoogleFonts.manrope(color: Marca.textoSuave, fontSize: 12),
      hintStyle: GoogleFonts.manrope(color: Marca.textoTenue, fontSize: 15),
    ),
    // Barra inferior sin pastilla de selección: el icono lleno y el texto
    // en negro bastan para saber dónde estás.
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Colors.transparent,
      overlayColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.pressed)
            ? Marca.rocePulsado
            : states.contains(WidgetState.hovered)
                ? Marca.roce
                : Colors.transparent,
      ),
      elevation: 0,
      height: 64,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected)
              ? Marca.texto
              : Marca.textoSuave,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => GoogleFonts.manrope(
          fontSize: 10.5,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          letterSpacing: -0.1,
          color: states.contains(WidgetState.selected)
              ? Marca.texto
              : Marca.textoSuave,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: Marca.borde,
      thickness: 0.7,
      space: 0.7,
    ),
    listTileTheme: const ListTileThemeData(
      iconColor: Marca.textoSuave,
      minVerticalPadding: 14,
      horizontalTitleGap: 14,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Marca.tarjeta,
      selectedColor: Marca.texto,
      side: BorderSide.none,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      labelStyle: GoogleFonts.manrope(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: Marca.textoSuave,
      ),
      secondaryLabelStyle: GoogleFonts.manrope(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: Colors.white,
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(Colors.white),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Marca.exito
            : const Color(0xFFDEDDD9),
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: Marca.dorado,
      foregroundColor: Marca.negro,
      elevation: 2,
      focusElevation: 2,
      hoverElevation: 2,
      highlightElevation: 2,
      extendedTextStyle: GoogleFonts.manrope(
        fontSize: 15.5,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
      ),
      shape: const StadiumBorder(),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      titleTextStyle: GoogleFonts.manrope(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: Marca.texto,
        letterSpacing: -0.4,
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Marca.fondo,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Marca.negro,
      contentTextStyle: GoogleFonts.manrope(
        color: Colors.white,
        fontSize: 14,
        letterSpacing: -0.2,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Marca.dorado,
      linearTrackColor: Marca.borde,
      circularTrackColor: Colors.transparent,
    ),
  );
}
