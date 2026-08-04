import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  assertReleaseManifests,
  packageNames,
  repoRoot,
} from './release-lib.mjs';

const artifactDir = resolve(repoRoot, 'release-artifacts');

function run(command, args) {
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
}

function readPackedManifest(tarball) {
  return JSON.parse(
    execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
  );
}

function assertPackedFiles(tarball, requiredFiles) {
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n');
  for (const requiredFile of requiredFiles) {
    if (!files.includes(`package/${requiredFile}`)) {
      throw new Error(`${basename(tarball)} is missing ${requiredFile}.`);
    }
  }
}

try {
  const { core, react } = assertReleaseManifests();

  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });

  run('pnpm', ['build']);
  run('pnpm', ['--filter', packageNames.core, 'pack', '--pack-destination', artifactDir]);
  run('pnpm', ['--filter', packageNames.react, 'pack', '--pack-destination', artifactDir]);

  const tarballs = readdirSync(artifactDir)
    .filter((file) => file.endsWith('.tgz'))
    .map((file) => resolve(artifactDir, file));

  if (tarballs.length !== 2) {
    throw new Error(`Expected two release tarballs, found ${tarballs.length}.`);
  }

  const manifests = tarballs.map((tarball) => ({
    tarball,
    manifest: readPackedManifest(tarball),
  }));
  const packedCore = manifests.find(({ manifest }) => manifest.name === packageNames.core);
  const packedReact = manifests.find(({ manifest }) => manifest.name === packageNames.react);

  if (!packedCore || !packedReact) {
    throw new Error('Packed tarballs do not contain the expected @hafbit packages.');
  }

  if (packedCore.manifest.version !== core.version || packedReact.manifest.version !== react.version) {
    throw new Error('Packed package versions do not match their source manifests.');
  }

  if (packedReact.manifest.dependencies?.[packageNames.core] !== core.version) {
    throw new Error('Packed React package must depend on the exact packed Core version.');
  }

  assertPackedFiles(packedCore.tarball, ['dist/index.cjs', 'dist/index.mjs', 'dist/index.d.ts']);
  assertPackedFiles(packedReact.tarball, [
    'dist/index.cjs',
    'dist/index.mjs',
    'dist/index.d.ts',
    'dist/react.css',
  ]);

  const artifactManifest = {
    version: core.version,
    core: `release-artifacts/${basename(packedCore.tarball)}`,
    react: `release-artifacts/${basename(packedReact.tarball)}`,
  };
  writeFileSync(
    resolve(artifactDir, 'manifest.json'),
    `${JSON.stringify(artifactManifest, null, 2)}\n`,
  );
  console.log(`Validated release artifacts for ${core.version}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
