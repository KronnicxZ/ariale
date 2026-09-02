import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Identidad de Arialé Studio, la misma que la web:
/// blanco y negro, el dorado del logo y pasteles para las categorías.
class Marca {
  const Marca._();

  static const dorado = Color(0xFFE9B21C);
  static const negro = Color(0xFF1A1A1A);
  static const fondo = Color(0xFFF9F8F6);
  static const tarjeta = Colors.white;
  static const texto = Color(0xFF1C1C1C);
  static const textoSuave = Color(0xFF7A7772);
  static const borde = Color(0xFFEAE8E4);

  static const exito = Color(0xFF3F8F5F);
  static const alerta = Color(0xFFD08A1E);
  static const error = Color(0xFFC0392B);

  /// Pasteles para distinguir categorías y series.
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

/// Serif fina, solo para títulos grandes.
TextStyle titulo(double tamano, {Color? color, FontWeight peso = FontWeight.w600}) =>
    GoogleFonts.cormorantGaramond(
      fontSize: tamano,
      fontWeight: peso,
      color: color ?? Marca.texto,
      height: 1.15,
    );

/// Cifras siempre en sans con espaciado tabular: el dinero se lee de un
/// vistazo, no se contempla.
TextStyle cifra(double tamano, {Color? color, FontWeight peso = FontWeight.w600}) =>
    GoogleFonts.inter(
      fontSize: tamano,
      fontWeight: peso,
      color: color ?? Marca.texto,
      letterSpacing: -0.4,
      fontFeatures: const [FontFeature.tabularFigures()],
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
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: Marca.texto,
      displayColor: Marca.texto,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      foregroundColor: Marca.texto,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      titleTextStyle: GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: Marca.texto,
      ),
    ),
    cardTheme: CardThemeData(
      color: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Marca.borde),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Marca.dorado,
        foregroundColor: Marca.negro,
        minimumSize: const Size(0, 52),
        textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Marca.texto,
        minimumSize: const Size(0, 48),
        side: const BorderSide(color: Marca.borde),
        textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Marca.texto,
        textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Marca.tarjeta,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Marca.borde),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Marca.borde),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Marca.dorado, width: 2),
      ),
      labelStyle: GoogleFonts.inter(color: Marca.textoSuave, fontSize: 14),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Marca.tarjeta,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Marca.dorado.withValues(alpha: 0.18),
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => GoogleFonts.inter(
          fontSize: 11.5,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? Marca.texto
              : Marca.textoSuave,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: Marca.borde, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Marca.negro,
      contentTextStyle: GoogleFonts.inter(color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
  );
}
