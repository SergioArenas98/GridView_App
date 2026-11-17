import type { IdentityStorage } from '../schema';
import type { CatalogSnapshot } from './model';
import { requireCatalog } from './model';
import { hashSeasonProjection } from './projection';

/** The corrected U3 helper is the sole effective-content algorithm. Labels
 * never feed hashes; evidence and decision provenance remain integrity inputs. */
export async function projectSeasons(snapshot: CatalogSnapshot): Promise<void> {
  for (const s of snapshot.seasonContent)
    s.seasonProjectionHash = await hashSeasonProjection(snapshot, s.season);
}
/** Must run in the proposal's synchronous SQL transaction after inserting its
 * revision reference. Reservations survive abandonment forever. */
export function reserveDatasetVersions(
  storage: IdentityStorage,
  snapshot: CatalogSnapshot,
  parent: CatalogSnapshot | null,
  revision: string,
  time: string,
): void {
  const rows = (q: string, ...a: (string | number | null)[]) =>
    storage.sql.exec(q, ...a).toArray();
  const date = time.slice(0, 10).replaceAll('-', '.');
  for (const s of snapshot.seasonContent) {
    const old = parent?.seasonContent.find((x) => x.season === s.season);
    if (old && old.seasonProjectionHash === s.seasonProjectionHash) {
      s.datasetVersion = old.datasetVersion;
      continue;
    }
    let label = s.datasetVersion,
      day = date,
      suffix: number;
    if (parent) {
      const last = rows(
        'SELECT date,suffix FROM identity_catalog_labels WHERE season=? ORDER BY date DESC,suffix DESC LIMIT 1',
        s.season,
      )[0];
      requireCatalog(
        !last || date >= String(last.date),
        'dataset-clock-regression',
      );
      suffix = last?.date === date ? Number(last.suffix) + 1 : 1;
      requireCatalog(Number.isSafeInteger(suffix), 'dataset-counter-capacity');
      label = date + '.' + suffix;
    } else {
      const match = /^(\d{4}\.\d{2}\.\d{2})\.([1-9]\d*)$/.exec(label);
      requireCatalog(match, 'seed-dataset-label');
      day = match[1]!;
      suffix = Number(match[2]);
      requireCatalog(Number.isSafeInteger(suffix), 'dataset-counter-capacity');
    }
    rows(
      'INSERT INTO identity_catalog_labels VALUES(?,?,?,?,?,?)',
      s.season,
      label,
      s.seasonProjectionHash,
      revision,
      day,
      suffix,
    );
    s.datasetVersion = label;
  }
}
