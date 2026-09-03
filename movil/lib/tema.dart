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

/// Dos cortes de la misma familia, como hace el sistema de Apple con SF Pro
/// Display y SF Pro Text: el contraste sale del corte, del peso y del
/// interletrado, no de mezclar dos tipografías que se pelean.
///
/// Cuanto más grande el texto, más apretado: es lo que hace que un título
/// se lea como una pieza y no como palabras sueltas.
double _apretado(double tamano) {
  if (tamano >= 30) return -1.4;
  if (tamano >= 24) return -1;
  if (tamano >= 19) return -0.6;
  return -0.3;
}

/// Títulos, en Inter Tight: más estrecha y con más carácter que la de texto.
/// A partir de 24 va en extranegrita, que es de donde viene el contraste.
TextStyle titulo(double tamano, {Color? color, FontWeight? peso}) =>
    GoogleFonts.interTight(
      fontSize: tamano,
      fontWeight: peso ?? (tamano >= 24 ? FontWeight.w800 : FontWeight.w700),
      color: color ?? Marca.texto,
      height: 1.08,
      letterSpacing: _apretado(tamano),
    );

/// Rótulo diminuto en versales para encabezar una sección o una columna.
/// Es el escalón que faltaba entre el título y el texto gris.
TextStyle micro({Color? color}) => GoogleFonts.inter(
      fontSize: 10.5,
      fontWeight: FontWeight.w700,
      color: color ?? Marca.textoTenue,
      letterSpacing: 0.8,
    );

/// Cifras con espaciado tabular: el dinero se lee de un vistazo y las
/// columnas de números no bailan al cambiar de valor.
TextStyle cifra(double tamano, {Color? color, FontWeight peso = FontWeight.w600}) =>
    GoogleFonts.inter(
      fontSize: tamano,
      fontWeight: peso,
      color: color ?? Marca.texto,
      letterSpacing: _apretado(tamano),
      fontFeatures: const [FontFeature.tabularFigures()],
    );

/// Rótulo pequeño y gris para lo secundario. Se llama `sutil` y no `apoyo`
/// porque varios widgets ya tienen un campo con ese nombre.
TextStyle sutil(double tamano, {Color? color, FontWeight peso = FontWeight.w400}) =>
    GoogleFonts.inter(
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
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );

  final texto = GoogleFonts.interTextTheme(base.textTheme).apply(
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
      titleTextStyle: GoogleFonts.inter(
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
        textStyle: GoogleFonts.inter(
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
        textStyle: GoogleFonts.inter(
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
        textStyle: GoogleFonts.inter(
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
      labelStyle: GoogleFonts.inter(color: Marca.textoSuave, fontSize: 14),
      helperStyle: GoogleFonts.inter(color: Marca.textoSuave, fontSize: 12),
      hintStyle: GoogleFonts.inter(color: Marca.textoTenue, fontSize: 15),
    ),
    // Barra inferior sin pastilla de selección: el icono lleno y el texto
    // en negro bastan para saber dónde estás.
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Colors.transparent,
      overlayColor: WidgetStatePropertyAll(Colors.transparent),
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
        (states) => GoogleFonts.inter(
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
      minVerticalPadding: 12,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Marca.tarjeta,
      selectedColor: Marca.texto,
      side: BorderSide.none,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      labelStyle: GoogleFonts.inter(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: Marca.textoSuave,
      ),
      secondaryLabelStyle: GoogleFonts.inter(
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
      extendedTextStyle: GoogleFonts.inter(
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
      titleTextStyle: GoogleFonts.inter(
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
      contentTextStyle: GoogleFonts.inter(
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
