import 'package:intl/intl.dart';

/// Locale-aware, loss-free formatting for classification values.
///
/// Every helper returns `null` for a missing value so a caller can simply omit
/// the field: a missing time, gap or score is never rendered as a zero.
class ResultFormatter {
  const ResultFormatter(this.locale);

  final String locale;

  /// Formats a points value, preserving fractions and dropping meaningless
  /// trailing zeros (`25.0` → `25`, `0.5` → `0,5` in `es`).
  String? points(double? value) {
    if (value == null) return null;
    return NumberFormat.decimalPattern(locale).format(value);
  }

  /// Formats an elapsed race time as `h:mm:ss.mmm` (hours dropped when zero).
  String? elapsed(Duration? value) {
    if (value == null) return null;
    final int hours = value.inHours;
    final int minutes = value.inMinutes.remainder(60);
    final int seconds = value.inSeconds.remainder(60);
    final int millis = value.inMilliseconds.remainder(1000);
    final String tail = '${_pad(seconds)}.${millis.toString().padLeft(3, '0')}';
    if (hours > 0) return '$hours:${_pad(minutes)}:$tail';
    return '$minutes:$tail';
  }

  /// Formats a gap to the leader as `+s.mmm` or `+m:ss.mmm`.
  String? gap(Duration? value) {
    if (value == null) return null;
    final int minutes = value.inMinutes;
    final int seconds = value.inSeconds.remainder(60);
    final int millis = value.inMilliseconds.remainder(1000);
    final String fraction = millis.toString().padLeft(3, '0');
    if (minutes > 0) return '+$minutes:${_pad(seconds)}.$fraction';
    return '+$seconds.$fraction';
  }

  String _pad(int value) => value.toString().padLeft(2, '0');
}
