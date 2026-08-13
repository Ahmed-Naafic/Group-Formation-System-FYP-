import 'package:flutter/material.dart';

// ── Semantic color tokens ──────────────────────────────────────────────────────
// Access via BuildContext extension below (e.g. context.bgColor).
// Always call inside build() so the context carries the current ThemeData.

extension AppColorsX on BuildContext {
  bool get _dark => Theme.of(this).brightness == Brightness.dark;

  // Backgrounds
  Color get bgColor        => _dark ? const Color(0xFF111827) : const Color(0xFFF5F6F9);
  Color get cardColor      => _dark ? const Color(0xFF1E2640) : Colors.white;
  Color get inputFill      => _dark ? const Color(0xFF1A2035) : const Color(0xFFF5F6F9);
  Color get chatBgColor    => _dark ? const Color(0xFF1A2035) : const Color(0xFFF0F2F5);
  Color get inputBarBg     => _dark ? const Color(0xFF242B42) : Colors.white;
  Color get unreadBg       => _dark ? const Color(0xFF1A2235) : const Color(0xFFEFF4FF);
  Color get chatBubbleOther=> _dark ? const Color(0xFF2A3350) : Colors.white;
  // Distinguishes instructor-sent messages from ordinary "other" bubbles.
  Color get chatBubbleInstructor       => _dark ? const Color(0xFF4A3B1F) : const Color(0xFFFCEACB);
  Color get chatBubbleInstructorBorder => _dark ? const Color(0xFF6B5326) : const Color(0xFFEBC475);
  Color get instructorAccent           => _dark ? const Color(0xFFE8B84B) : const Color(0xFFB07D1A);

  // Text
  Color get textPrimary     => _dark ? const Color(0xFFF0F6FC) : const Color(0xFF0E1320);
  Color get textBody        => _dark ? const Color(0xFFC9D1D9) : const Color(0xFF1A1F2E);
  Color get textSecondary   => _dark ? const Color(0xFF8B949E) : const Color(0xFF596070);
  Color get textMuted       => _dark ? const Color(0xFF6E7681) : const Color(0xFF8A92A4);
  Color get textPlaceholder => _dark ? const Color(0xFF3D4455) : const Color(0xFFB0B8CC);

  // Borders / dividers
  Color get dividerColor => _dark ? const Color(0xFF2A3350) : const Color(0xFFECEEF2);
  Color get borderColor  => _dark ? const Color(0xFF354060) : const Color(0xFFCDD5E0);

  // Card decoration — shadow in light, border in dark
  BoxDecoration cardDecoration({double radius = 16}) => BoxDecoration(
    color: cardColor,
    borderRadius: BorderRadius.circular(radius),
    border: _dark ? Border.all(color: borderColor.withAlpha(80)) : null,
    boxShadow: _dark
        ? null
        : [
            BoxShadow(
              color: Colors.black.withAlpha(12),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
  );

  // Input field border helpers
  OutlineInputBorder inputBorderNone({double radius = 12}) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(radius),
    borderSide: BorderSide.none,
  );
  OutlineInputBorder inputBorderEnabled({double radius = 12}) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(radius),
    borderSide: BorderSide(color: dividerColor),
  );
  OutlineInputBorder get inputBorderFocused => const OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),
    borderSide: BorderSide(color: Color(0xFF1E3A8A), width: 1.5),
  );
}

// ── ThemeData definitions ──────────────────────────────────────────────────────

class AppTheme {
  static const _primary = Color(0xFF1E3A8A);

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primary,
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: const Color(0xFFF5F6F9),
    appBarTheme: const AppBarTheme(
      backgroundColor: _primary,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
  );

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primary,
      brightness: Brightness.dark,
    ),
    scaffoldBackgroundColor: const Color(0xFF111827),
    appBarTheme: const AppBarTheme(
      backgroundColor: _primary,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    dividerColor: const Color(0xFF2A3350),
  );
}
