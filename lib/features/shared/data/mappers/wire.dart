// Shared wire-value converters used by the DTO -> domain mappers.

/// UTC instant from an ISO-8601 wire string; null-preserving.
DateTime? instantFromWire(String? value) =>
    value == null ? null : DateTime.parse(value).toUtc();

/// Duration from integer milliseconds; null-preserving.
Duration? durationFromMillis(int? millis) =>
    millis == null ? null : Duration(milliseconds: millis);
