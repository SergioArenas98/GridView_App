import 'package:gridview/core/legacy/legacy_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Seeds the platform preference store exactly as a device upgraded from the
/// legacy app holds it, and forgets any instance a previous test opened.
void seedPrefs(Map<String, Object> values) {
  SharedPreferences.resetStatic();
  SharedPreferences.setMockInitialValues(values);
}

/// An in-memory [LegacyMigrationStore] that records writes and can fail chosen
/// keys, for the failure paths the platform mock cannot produce.
class MemoryMigrationStore implements LegacyMigrationStore {
  MemoryMigrationStore(
    Map<String, Object> initial, {
    Set<String> failingWrites = const <String>{},
    Set<String> failingRemovals = const <String>{},
    Set<String> failingReads = const <String>{},
  }) : _values = <String, Object>{...initial},
       failingWrites = <String>{...failingWrites},
       failingRemovals = <String>{...failingRemovals},
       failingReads = <String>{...failingReads};

  final Map<String, Object> _values;
  final Set<String> failingWrites;
  final Set<String> failingRemovals;

  /// Keys whose read throws, as an unreadable platform value would. Clear the
  /// set to model the failure being transient.
  final Set<String> failingReads;
  final List<String> writes = <String>[];

  Map<String, Object> get values => Map<String, Object>.unmodifiable(_values);

  @override
  Object? readRaw(String key) {
    if (failingReads.contains(key)) throw StateError('read $key');
    return _values[key];
  }

  @override
  Future<void> writeString(String key, String value) async {
    if (failingWrites.contains(key)) throw StateError('write $key');
    writes.add(key);
    _values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    if (failingRemovals.contains(key)) throw StateError('remove $key');
    _values.remove(key);
  }
}

/// A store whose every operation throws, to prove callers stay total.
class ThrowingMigrationStore implements LegacyMigrationStore {
  @override
  Object? readRaw(String key) => throw StateError('read $key');

  @override
  Future<void> writeString(String key, String value) async =>
      throw StateError('write $key');

  @override
  Future<void> remove(String key) async => throw StateError('remove $key');
}
