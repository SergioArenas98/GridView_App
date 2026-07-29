import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// English is the source locale, so it is complete by definition; Spanish must
/// match it exactly. A missing key would silently fall back to English at
/// runtime, which reads as a half-translated screen rather than as a failure —
/// hence a test rather than a manual review.
void main() {
  late Map<String, Object?> en;
  late Map<String, Object?> es;

  setUpAll(() {
    en = _readArb('lib/l10n/app_en.arb');
    es = _readArb('lib/l10n/app_es.arb');
  });

  Iterable<String> messages(Map<String, Object?> arb) =>
      arb.keys.where((String k) => !k.startsWith('@'));

  test('every English message exists in Spanish, and vice versa', () {
    final Set<String> enKeys = messages(en).toSet();
    final Set<String> esKeys = messages(es).toSet();

    expect(
      enKeys.difference(esKeys),
      isEmpty,
      reason: 'missing Spanish translations',
    );
    expect(
      esKeys.difference(enKeys),
      isEmpty,
      reason: 'Spanish keys with no English source',
    );
  });

  test('no message is left empty in either locale', () {
    for (final Map<String, Object?> arb in <Map<String, Object?>>[en, es]) {
      for (final String key in messages(arb)) {
        expect(arb[key], isA<String>(), reason: key);
        expect((arb[key]! as String).trim(), isNotEmpty, reason: key);
      }
    }
  });

  test('placeholders match one for one between locales', () {
    for (final String key in messages(en)) {
      expect(
        _placeholders(es[key]! as String),
        _placeholders(en[key]! as String),
        reason: 'placeholder mismatch in "$key"',
      );
    }
  });

  test('plural and select cases match between locales', () {
    for (final String key in messages(en)) {
      final String source = en[key]! as String;
      if (!source.contains('plural') && !source.contains('select')) continue;
      expect(
        _icuKinds(es[key]! as String),
        _icuKinds(source),
        reason: 'ICU form mismatch in "$key"',
      );
    }
  });

  test('every English message declares metadata in the template', () {
    for (final String key in messages(en)) {
      expect(en.containsKey('@$key'), isTrue, reason: 'missing @$key');
    }
  });

  test('the product name is never translated', () {
    for (final String key in messages(en)) {
      final String source = en[key]! as String;
      if (!source.contains('GridView')) continue;
      expect(
        es[key]! as String,
        contains('GridView'),
        reason: '"$key" must keep the product name',
      );
    }
  });
}

Map<String, Object?> _readArb(String path) {
  final File file = File(path);
  expect(file.existsSync(), isTrue, reason: 'missing $path');
  return jsonDecode(file.readAsStringSync()) as Map<String, Object?>;
}

/// The `{placeholder}` names in an ICU message.
///
/// A placeholder is a `{` followed by an identifier and then `}` or `,`, which
/// matches both a plain `{name}` and a plural head `{count, plural, ...}`. The
/// trailing delimiter is what distinguishes a placeholder from the body of a
/// plural branch such as `other{Starts in {count} minutes}` — translated prose
/// inside a branch is not a placeholder and must not be compared as one.
Set<String> _placeholders(String message) => RegExp(
  r'\{(\w+)\s*[},]',
).allMatches(message).map((RegExpMatch m) => m.group(1)!).toSet();

/// Which ICU constructs a message uses, so a plural cannot become a plain
/// string in one locale.
Set<String> _icuKinds(String message) => <String>{
  if (message.contains(', plural,')) 'plural',
  if (message.contains(', select,')) 'select',
};
