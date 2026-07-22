/// Scalar validation for values written to the local database.
///
/// SQL `CHECK` constraints on the v2 tables enforce numeric ranges (season,
/// round, non-negative order/timing/laps, positive media dimensions) at the
/// storage layer. Rules that SQLite cannot express safely — kebab-case
/// identifiers and uppercase ISO country codes — plus range checks for the v1
/// `grand_prix` spine (which cannot carry new CHECK constraints post-migration)
/// are enforced here, transactionally, at the DAO write boundary.
library;

/// Thrown when a value written to the local database violates a scalar rule.
/// The enclosing transaction is rolled back and no rows change.
class InvalidEntityException implements Exception {
  const InvalidEntityException(this.message);

  final String message;

  @override
  String toString() => 'InvalidEntityException: $message';
}

/// Kebab-case identifier: lowercase alphanumerics separated by single hyphens,
/// no leading/trailing/double hyphens. Covers both atomic slugs (max 64) and
/// composite GridView ids (max 96); the length cap here is the generous 96.
final RegExp _kebab = RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$');

/// ISO 3166-1 alpha-2, uppercase (exactly two A–Z letters).
final RegExp _countryCode = RegExp(r'^[A-Z]{2}$');

void validateSlug(String value, {required String field}) {
  if (value.isEmpty || value.length > 96 || !_kebab.hasMatch(value)) {
    throw InvalidEntityException(
      '$field "$value" is not a valid kebab-case identifier.',
    );
  }
}

void validateCountryCode(String? value, {required String field}) {
  if (value != null && !_countryCode.hasMatch(value)) {
    throw InvalidEntityException(
      '$field "$value" must be an ISO 3166-1 alpha-2 uppercase code.',
    );
  }
}

void validateSeason(int year, {String field = 'season'}) {
  if (year < 1950 || year > 2100) {
    throw InvalidEntityException('$field $year is outside 1950..2100.');
  }
}

void validateRound(int? round, {String field = 'round'}) {
  if (round != null && (round < 1 || round > 30)) {
    throw InvalidEntityException('$field $round is outside 1..30.');
  }
}
