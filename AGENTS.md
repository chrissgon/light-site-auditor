# light-site-auditor

A local CLI, `auditor <url>`, that measures a page's weight by file type, its load time on a 3G profile and its accessibility problems (WCAG 2.1 AA), and writes a report in plain Portuguese with the raw JSON beside it. The plan lives outside this repository, in the portfolio backlog (project `T-aud`).

## Commands

| Task | Command |
|------|---------|
| Install | `npm install` (exact versions, `package-lock.json`) |
| Test | `npm test` (vitest; starts Chromium and a local fixture server on 127.0.0.1, no internet) |
| Type-check | `npm run typecheck` (source, scripts and tests) |
| Build | `npm run build` (writes `dist/`) |
| Run | `npm run auditor -- <url> [--consent <file>] [--out <dir>]` |
| Check a written report | `npm run check-report -- <dir>` |
| Fixture server | `npm run fixture -- [--port 4173]` |

## Rules

- Audit only with the site owner's consent. The CLI refuses any host other than `localhost`, `127.0.0.1` and `[::1]` unless `--consent <file>` points to a record with `status: aceito` for the exact address (`src/consent.ts`; request text and record format in `docs/field/consentimento.md`). Never add a flag or code path that skips the check. Field reports live in `docs/field/<site>/`, git-ignored: a report belongs to the site owner. Tests only use the fixture in `tests/fixtures/site/`.
- Every number in a report comes from the raw JSON saved beside it (`lighthouse.json`, `axe.json`); `tests/report.test.ts` checks this. Never write a number into the report that the JSON does not hold or that is not a sum of its values.
- Plain-language text comes only from `src/explanations.pt.json`, a catalog written in advance (human review pending, see its `review` field): sentences of at most 25 words, no digits, every technical term listed in the entry and defined in the glossary. Nothing is generated at run time. `tests/explanations.test.ts` enforces this.
- The 3G profile is Lighthouse's `mobileRegular3G` (source and access date in `docs/spikes/3g.md`); `tests/profile.test.ts` fails if the installed Lighthouse changes it.
- Chromium comes from Playwright: `npx playwright install --no-shell chromium` (Lighthouse and axe both use the full Chromium); users run `auditor --instalar-navegador`.
- Code, comments and commits in English; the README in English only; the report and the catalog in Portuguese. Conventional Commits, signed.
- Public repository `chrissgon/light-site-auditor`. `main` is protected: every change goes through a branch and a pull request, merged by squash only when the required checks `secrets` and `build` are green, with signed commits. No force push, no rule changes, no bypass.
- Published on npm as `@chrissgon/light-site-auditor` (decision in `docs/decisions.md`) only by `.github/workflows/publish.yml` on a `v*` tag, through npm trusted publishing with provenance. Never run `npm publish` by hand, never store an npm token, and never push a tag before the owner approves the exact payload (name, version, `npm pack --dry-run` list).
- Enable the pre-commit hook once per clone: `git config core.hooksPath .githooks`. It runs the secret scan, types, tests and the build, the same checks as CI. Never skip it.
- Credentials never enter the repository; `.env` and `.env.*` are git-ignored. Report vulnerabilities as described in `SECURITY.md`.
