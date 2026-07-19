import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:path/path.dart' as p;

import '../support/domain_fixtures.dart';

void main() {
  test(
    'cached Grand Prix data survives closing and reopening the database',
    () async {
      final Directory dir = Directory.systemTemp.createTempSync('gridview_db');
      final File file = File(p.join(dir.path, 'persistence_test.sqlite'));
      addTearDown(() {
        if (dir.existsSync()) dir.deleteSync(recursive: true);
      });

      // First session: write a detail snapshot, then close the database.
      final GridViewDatabase first = GridViewDatabase.forTesting(
        NativeDatabase(file),
      );
      await first.verticalSliceDao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: DateTime.utc(2026, 7, 18, 12)),
      );
      await first.close();

      // Second session: reopen the same file and read the cached data offline.
      final GridViewDatabase second = GridViewDatabase.forTesting(
        NativeDatabase(file),
      );
      addTearDown(() => second.close());

      final GrandPrixDetailView? view = await second.verticalSliceDao
          .watchGrandPrix(2026, 13)
          .first;

      expect(view, isNotNull);
      expect(view!.grandPrix.id, '2026-belgian-grand-prix');
      expect(view.grandPrix.sessions.length, 5);
      expect(view.grandPrix.timezone, 'Europe/Brussels');
    },
  );
}
