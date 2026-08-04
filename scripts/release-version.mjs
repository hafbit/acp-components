import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import {
  assertReleaseManifests,
  coreManifestPath,
  parseReleaseVersion,
  reactManifestPath,
  repoRoot,
} from './release-lib.mjs';

const input = process.argv[2];

if (!input || process.argv.length !== 3) {
  console.error('Usage: pnpm release:version <X.Y.Z|X.Y.Z-alpha.N|X.Y.Z-beta.N>');
  process.exit(1);
}

try {
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  if (dirty) {
    throw new Error('The working tree must be clean before changing release versions.');
  }

  const { version } = parseReleaseVersion(input);
  const { core, react } = assertReleaseManifests();

  core.version = version;
  react.version = version;

  writeFileSync(coreManifestPath, `${JSON.stringify(core, null, 2)}\n`);
  writeFileSync(reactManifestPath, `${JSON.stringify(react, null, 2)}\n`);
  console.log(`Updated both published packages to ${version}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
