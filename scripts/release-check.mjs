import { appendFileSync } from 'node:fs';
import { assertReleaseManifests, parseReleaseVersion } from './release-lib.mjs';

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

try {
  if (!tag?.startsWith('v')) {
    throw new Error('A release tag beginning with v is required.');
  }

  const release = parseReleaseVersion(tag);
  assertReleaseManifests(release.version);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${release.version}\ndist_tag=${release.distTag}\n`,
    );
  }

  console.log(`Release ${tag} is valid and will publish with npm dist-tag ${release.distTag}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
