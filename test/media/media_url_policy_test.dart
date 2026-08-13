import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/media/media_url_policy.dart';

void main() {
  const MediaUrlPolicy strict = MediaUrlPolicy.strict;
  const MediaUrlPolicy loopback = MediaUrlPolicy.developmentLoopback;

  group('staging and production accept only safe HTTPS', () {
    test('accepts an ordinary HTTPS URL', () {
      expect(
        strict.isAllowed('https://media.gridview.invalid/media/a/v1/card.webp'),
        isTrue,
      );
    });

    test('accepts an HTTPS URL with a port and a query', () {
      expect(
        strict.isAllowed('https://media.gridview.invalid:8443/a.webp?v=2'),
        isTrue,
      );
    });

    test('rejects plain HTTP', () {
      expect(
        strict.rejectionFor('http://media.gridview.invalid/a.webp'),
        MediaUrlRejection.insecureScheme,
      );
    });

    test(
      'rejects loopback HTTP too, without the explicit development policy',
      () {
        // There is no configuration that makes arbitrary http acceptable; the
        // loopback exception has to be injected deliberately.
        expect(
          strict.rejectionFor('http://localhost:8080/a.webp'),
          MediaUrlRejection.insecureScheme,
        );
      },
    );

    for (final String url in <String>[
      'file:///etc/passwd',
      'content://media/external/images/1',
      'data:image/png;base64,iVBORw0KGgo=',
      'javascript:alert(1)',
      'ftp://media.gridview.invalid/a.webp',
      'gopher://media.gridview.invalid/a',
    ]) {
      test('rejects the unsupported scheme in $url', () {
        expect(
          strict.rejectionFor(url),
          MediaUrlRejection.unsupportedScheme,
          reason: url,
        );
      });
    }

    test('rejects a relative URL', () {
      expect(
        strict.rejectionFor('/media/a/v1/card.webp'),
        MediaUrlRejection.notAbsolute,
      );
    });

    test('rejects a URL with no host', () {
      expect(
        strict.rejectionFor('https:///a.webp'),
        MediaUrlRejection.missingHost,
      );
    });

    test('rejects embedded credentials', () {
      expect(
        strict.rejectionFor(
          'https://user:secret@media.gridview.invalid/a.webp',
        ),
        MediaUrlRejection.embeddedCredentials,
      );
      expect(
        strict.rejectionFor('https://user@media.gridview.invalid/a.webp'),
        MediaUrlRejection.embeddedCredentials,
      );
    });

    test('rejects credentials smuggled into a fragment', () {
      // A fragment never reaches the server, so a token there is both useless
      // and a strong signal the URL is not what it claims to be.
      expect(
        strict.rejectionFor('https://media.gridview.invalid/a.webp#token=abc'),
        MediaUrlRejection.embeddedCredentials,
      );
    });

    test('rejects control characters and whitespace', () {
      // The shape a header- or log-injection attempt takes. A legitimate URL
      // arrives percent-encoded.
      expect(
        strict.rejectionFor('https://media.gridview.invalid/a b.webp'),
        MediaUrlRejection.controlCharacters,
      );
      expect(
        strict.rejectionFor('https://media.gridview.invalid/a.webp\n'),
        MediaUrlRejection.controlCharacters,
      );
      expect(
        strict.rejectionFor('https://media.gridview.invalid/\u0000.webp'),
        MediaUrlRejection.controlCharacters,
      );
    });

    test('rejects empty and null', () {
      expect(strict.rejectionFor(''), MediaUrlRejection.empty);
      expect(strict.rejectionFor('   '), MediaUrlRejection.empty);
      expect(strict.rejectionFor(null), MediaUrlRejection.empty);
    });
  });

  group('development loopback exception', () {
    test('accepts HTTP on loopback hosts only', () {
      expect(loopback.isAllowed('http://localhost:8080/a.webp'), isTrue);
      expect(loopback.isAllowed('http://127.0.0.1:8080/a.webp'), isTrue);
    });

    test('still rejects HTTP on any other host', () {
      // The exception is for a developer's own machine, not a way to make
      // arbitrary HTTP acceptable.
      expect(
        loopback.rejectionFor('http://media.gridview.invalid/a.webp'),
        MediaUrlRejection.insecureScheme,
      );
      expect(
        loopback.rejectionFor('http://192.168.1.10/a.webp'),
        MediaUrlRejection.insecureScheme,
      );
    });

    test('still rejects every unsupported scheme', () {
      expect(
        loopback.rejectionFor('file:///tmp/a.webp'),
        MediaUrlRejection.unsupportedScheme,
      );
    });
  });

  group('diagnostics never leak a URL', () {
    test('reduces a URL to scheme and host', () {
      // A media URL is the one place a signed-delivery token would appear, so a
      // failure has to be loggable without becoming a credential leak.
      expect(
        MediaUrlPolicy.describe(
          'https://media.gridview.invalid/media/drivers/x/v1/card.webp?sig=SECRET',
        ),
        'https://media.gridview.invalid/…',
      );
    });

    test('drops a query even when the path is empty', () {
      expect(
        MediaUrlPolicy.describe('https://media.gridview.invalid/?token=SECRET'),
        'https://media.gridview.invalid',
      );
    });

    test('describes unusable input without echoing it', () {
      expect(MediaUrlPolicy.describe(''), '(empty)');
      expect(MediaUrlPolicy.describe(null), '(empty)');
      expect(MediaUrlPolicy.describe('not a url'), '(unparseable)');
    });

    test('never contains the secret from a signed URL', () {
      const String signed =
          'https://media.gridview.invalid/a.webp?X-Amz-Signature=DEADBEEF';
      expect(MediaUrlPolicy.describe(signed), isNot(contains('DEADBEEF')));
      expect(MediaUrlPolicy.describe(signed), isNot(contains('Signature')));
    });
  });
}
