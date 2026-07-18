import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/api/errors/error_dto.dart';

import '../support/fixtures.dart';

ApiFailure _failureFrom(String file) =>
    ApiFailure.fromError(ErrorEnvelopeDto.fromJson(loadFixture(file)).error);

void main() {
  test('maps upstream failure to a retryable server-unavailable category', () {
    final failure = _failureFrom('errors/upstream-unavailable.json');
    expect(failure.kind, ApiFailureKind.serverUnavailable);
    expect(failure.retryable, isTrue);
  });

  test('maps season-not-found to a not-found category', () {
    expect(
      _failureFrom('errors/season-not-found.json').kind,
      ApiFailureKind.notFound,
    );
  });

  test('maps invalid parameter to an invalid-request category', () {
    expect(
      _failureFrom('errors/invalid-parameter.json').kind,
      ApiFailureKind.invalidRequest,
    );
  });
}
