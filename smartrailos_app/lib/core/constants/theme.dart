import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // SmartRail OS Obsidian Palette (from smartrailos_web)
  static const Color surfaceDark = Color(0xFF000000); // obsidian-950 / background / sidebar
  static const Color surfaceCard = Color(0xFF080A0F); // obsidian-900 / card / popover
  static const Color surfaceMuted = Color(0xFF050608); // obsidian-800 / secondary / muted
  static const Color surfaceElevated = Color(0xFF121620); // obsidian-700 / elevated
  static const Color surfaceGlass = Color(0xCC080A0F); // glass-card surface
  static const Color surfaceGlassBorder = Color(0x14FFFFFF); // 8% white border (--border)
  static const Color inputBorder = Color(0x1AFFFFFF); // 10% white border (--input)
  
  // Accents
  static const Color accentCyan = Color(0xFF2DD4BF); // primary accent (--color-accent-cyan / --primary)
  static const Color accentCyanGlow = Color(0x662DD4BF); // 40% cyan glow
  static const Color accentBlue = Color(0xFF2563EB); // --color-accent-blue
  static const Color accentBlue2 = Color(0xFF3B82F6); // --color-accent-blue-2
  static const Color accentBlueGlow = Color(0x663B82F6); // 40% blue glow
  
  // Corridor Lines
  static const Color blueLine = Color(0xFF2563EB); // --color-line-blue
  static const Color blueLineGlow = Color(0x402563EB);
  static const Color redLine = Color(0xFFEF4444); // --color-line-red
  static const Color redLineGlow = Color(0x40EF4444);
  
  // Signals & Status
  static const Color signalGreen = Color(0xFF10B981); // --color-success
  static const Color signalAmber = Color(0xFFF59E0B); // --color-warning / --color-alert-amber
  static const Color signalRed = Color(0xFFEF4444); // --color-danger / --color-alert-red
  static const Color alertRed = Color(0xFFF43F5E); // --color-alert-red / --destructive
  static const Color ladiesTint = Color(0xFFF472B6); // Ladies coach pink tint
  
  // Typography
  static const Color textPrimary = Color(0xFFE2E8F0); // --foreground (slate-200)
  static const Color textSecondary = Color(0xFF94A3B8); // --muted-foreground (slate-400)
  static const Color textMuted = Color(0xFF64748B); // slate-500

  static const double borderRadius = 16.0;

  static TextStyle get tabularNumberStyle => TextStyle(
    fontFeatures: const [FontFeature.tabularFigures()],
    fontFamily: GoogleFonts.spaceGrotesk().fontFamily,
  );

  static Color coachColor(double percent) {
    if (percent < 0.4) return signalGreen;
    if (percent < 0.7) return signalAmber;
    return signalRed;
  }

  static BoxDecoration glassBoxDecoration({
    Color? color,
    double radius = borderRadius,
    Color borderColor = surfaceGlassBorder,
    double borderWidth = 1.0,
    List<BoxShadow>? shadows,
  }) {
    return BoxDecoration(
      color: color ?? surfaceCard,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor, width: borderWidth),
      boxShadow: shadows ?? [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.35),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: surfaceDark,
      colorScheme: const ColorScheme.dark(
        primary: accentCyan,
        onPrimary: surfaceDark,
        secondary: accentBlue,
        surface: surfaceCard,
        onSurface: textPrimary,
        error: signalRed,
      ),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.dark().textTheme.apply(
          bodyColor: textPrimary,
          displayColor: textPrimary,
        ),
      ).copyWith(
        displayLarge: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
        displayMedium: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
        displaySmall: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
        headlineLarge: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
        headlineMedium: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
        headlineSmall: GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.bold),
      ),
      cardTheme: CardThemeData(
        color: surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(borderRadius),
          side: const BorderSide(color: surfaceGlassBorder),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: textPrimary),
        titleTextStyle: GoogleFonts.spaceGrotesk(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          backgroundColor: accentCyan,
          foregroundColor: surfaceDark,
          textStyle: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold, fontSize: 15, letterSpacing: 0.5),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.transparent,
        elevation: 0,
        selectedItemColor: accentCyan,
        unselectedItemColor: textMuted,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: accentCyan, width: 2),
        ),
        labelStyle: const TextStyle(color: textMuted, fontSize: 13),
        hintStyle: const TextStyle(color: textMuted, fontSize: 14),
        prefixIconColor: textMuted,
      ),
    );
  }
}
