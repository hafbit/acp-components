# Publishing the `@hafbit` packages

The `latest` branch is the only downstream release line. `main` remains
available for upstream synchronization. Both public packages always use the
same version:

- `@hafbit/acp-components-core`
- `@hafbit/acp-components-react`

## Release channels

| Git version tag | npm dist-tag | Example install |
|---|---|---|
| `v0.2.0-alpha.0` | `alpha` | `npm add @hafbit/acp-components-react@alpha` |
| `v0.2.0-beta.0` | `beta` | `npm add @hafbit/acp-components-react@beta` |
| `v0.2.0` | `latest` | `npm add @hafbit/acp-components-react` |

Only tags whose commits belong to `origin/latest` are accepted. Supported
versions are stable SemVer releases and numbered `alpha` or `beta`
prereleases. npm versions are immutable, so every channel transition requires
a new version.

## First publication

The packages must exist on npm before Trusted Publishing can be configured.
Perform the `0.1.0-alpha.0` bootstrap once from a clean `latest` checkout:

```bash
git switch latest
git pull --ff-only origin latest
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm --filter @acp-components/demo build
pnpm release:pack
npm login
npm whoami
```

Confirm that `npm whoami` prints `hafbit`, then publish Core before React:

```bash
npm publish release-artifacts/hafbit-acp-components-core-0.1.0-alpha.0.tgz --access public --tag alpha
npm publish release-artifacts/hafbit-acp-components-react-0.1.0-alpha.0.tgz --access public --tag alpha
```

For each package, open its npm package settings and add a GitHub Actions
Trusted Publisher with:

- owner: `hafbit`
- repository: `acp-components`
- workflow filename: `publish.yml`

Do not add an `NPM_TOKEN` GitHub secret. The workflow uses npm OIDC and
provenance with `id-token: write`. See the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Automated releases

Prepare and commit a synchronized version on `latest`, then tag that exact
commit:

```bash
git switch latest
git pull --ff-only origin latest
pnpm release:version 0.2.0-beta.0
git add packages/core/package.json packages/react/package.json
git commit -m "release v0.2.0-beta.0"
git push origin latest
git tag -a v0.2.0-beta.0 -m "v0.2.0-beta.0"
git push origin v0.2.0-beta.0
```

The tag workflow validates the source branch and version, runs lint/tests/build,
packs and inspects both tarballs, publishes Core then React, and smoke-tests the
registry artifacts. A rerun skips a package only when that exact version is
already published with the expected dist-tag.

After the bootstrap, publish `0.1.0-alpha.1` through this automated path to
verify the Trusted Publisher configuration before creating beta or stable
releases.

## Repository protection

Protect `latest` with required CI checks and disabled force-pushes. Add a tag
ruleset for `v*` that prevents tag updates and deletion. npm package versions
cannot be overwritten; if a release is wrong, fix it and publish a higher
version.
