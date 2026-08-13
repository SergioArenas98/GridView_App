// GridView media publication CLI.
//
//   node --experimental-strip-types scripts/media/cli.ts dry-run \
//     --base-url https://media.example.test --out .media-out
//
//   node --experimental-strip-types scripts/media/cli.ts publish \
//     --target staging --base-url https://... --bucket <name>
//
// `dry-run` needs no Cloudflare credential, no bucket and no network, and is what
// CI runs. `publish` is never invoked by ordinary pull-request CI.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publishMedia, type PublicationReport } from './publish.ts';
import type { MediaRightsRegister, SourceMasterProbe } from './rights.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const defaultRegisterPath = join(
  repoRoot,
  'content',
  'media',
  'media-rights.json',
);

interface Options {
  readonly command: string;
  readonly baseUrl: string;
  readonly registerPath: string;
  readonly outDir: string;
  readonly target: 'staging' | 'production';
  readonly territory: string;
}

function parseArgs(argv: readonly string[]): Options {
  const command = argv[0] ?? 'dry-run';
  const flag = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback;
  };
  const target = flag('target', 'staging');
  if (target !== 'staging' && target !== 'production') {
    throw new Error(
      `Unknown --target "${target}"; expected staging or production.`,
    );
  }
  return {
    command,
    baseUrl: flag('base-url', ''),
    registerPath: resolve(flag('register', defaultRegisterPath)),
    outDir: resolve(flag('out', join(repoRoot, '.media-out'))),
    target,
    territory: flag('territory', 'WORLDWIDE'),
  };
}

async function loadRegister(path: string): Promise<MediaRightsRegister> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Record<
    string,
    unknown
  >;
  delete raw.$schema;
  return raw as unknown as MediaRightsRegister;
}

const probe: SourceMasterProbe = async (sourceFile) => {
  try {
    const info = await stat(sourceFile);
    return { exists: info.isFile(), valid: info.isFile() && info.size > 0 };
  } catch {
    return { exists: false, valid: false };
  }
};

function report(result: PublicationReport): number {
  console.log(`target        : ${result.target}`);
  console.log(`outcome       : ${result.outcome}`);
  console.log(`uploaded      : ${result.uploaded}`);
  console.log(`assets        : ${result.assets.length}`);
  console.log(`objects       : ${result.objects.length}`);
  for (const object of result.objects) {
    console.log(
      `  ${object.objectKey}  ${object.contentHash.slice(0, 16)}  ${object.bytes}B`,
    );
  }
  for (const refusal of result.refusals) {
    console.error(
      `REFUSED ${refusal.assetId}: ${refusal.code} - ${refusal.detail}`,
    );
  }
  if (result.reason) console.error(result.reason);
  return result.outcome === 'dry-run' || result.outcome === 'uploaded' ? 0 : 1;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.command !== 'dry-run') {
    // Upload is intentionally not wired to a live R2 client here. No media
    // bucket is provisioned in any environment, so a working upload path would
    // be untestable code guarding an operation that cannot currently happen.
    // `publishMedia` already implements upload against an injected store; the
    // remaining step is supplying a real one, which belongs with the bucket.
    console.error(
      `Command "${options.command}" is not available: no media bucket is provisioned in any environment, so there is nothing to upload to. Run "dry-run" to validate rights, process masters and generate the manifest.`,
    );
    return 2;
  }
  if (!options.baseUrl) {
    console.error('--base-url is required (an absolute https URL).');
    return 2;
  }

  const register = await loadRegister(options.registerPath);
  const result = await publishMedia({
    register,
    use: {
      commercial: true,
      territory: options.territory,
      at: new Date(),
    },
    target: options.target,
    publicBaseUrl: options.baseUrl,
    readMaster: (sourceFile) => readFile(sourceFile),
    probeMaster: probe,
    upload: false,
  });

  await mkdir(options.outDir, { recursive: true });
  await writeFile(
    join(options.outDir, 'media-manifest.json'),
    `${JSON.stringify({ assets: result.assets }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(options.outDir, 'object-inventory.json'),
    `${JSON.stringify(result.objects, null, 2)}\n`,
    'utf8',
  );
  console.log(`written       : ${options.outDir}`);
  return report(result);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
