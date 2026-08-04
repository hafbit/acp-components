import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const coreManifestPath = resolve(repoRoot, 'packages/core/package.json');
export const reactManifestPath = resolve(repoRoot, 'packages/react/package.json');

export const packageNames = {
  core: '@hafbit/acp-components-core',
  react: '@hafbit/acp-components-react',
};

const releasePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta)\.(0|[1-9]\d*))?$/;

export function parseReleaseVersion(input) {
  const version = input?.startsWith('v') ? input.slice(1) : input;
  const match = releasePattern.exec(version ?? '');

  if (!match) {
    throw new Error(
      `Invalid release version "${input ?? ''}". Expected X.Y.Z, X.Y.Z-alpha.N, or X.Y.Z-beta.N.`,
    );
  }

  return {
    version,
    distTag: match[4] ?? 'latest',
  };
}

export function readManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function assertReleaseManifests(expectedVersion) {
  const core = readManifest(coreManifestPath);
  const react = readManifest(reactManifestPath);

  if (core.name !== packageNames.core || react.name !== packageNames.react) {
    throw new Error('Published package names do not match the @hafbit release configuration.');
  }

  if (core.version !== react.version) {
    throw new Error(`Package versions differ: core=${core.version}, react=${react.version}.`);
  }

  if (expectedVersion && core.version !== expectedVersion) {
    throw new Error(`Manifest version ${core.version} does not match release version ${expectedVersion}.`);
  }

  if (react.dependencies?.[packageNames.core] !== 'workspace:*') {
    throw new Error(`React must depend on ${packageNames.core} using workspace:*.`);
  }

  for (const manifest of [core, react]) {
    if (
      manifest.publishConfig?.access !== 'public'
      || manifest.publishConfig?.registry !== 'https://registry.npmjs.org/'
    ) {
      throw new Error(`${manifest.name} must publish publicly to the npm registry.`);
    }
  }

  return { core, react };
}
