# Decisions

## D1. The public form is a CLI on npm (T-aud-9)

- **Date:** 2026-09-30
- **Decided by:** Christopher Gonçalves (owner), in chat.
- **Decision:** the auditor is published as a command-line tool on npm, `@chrissgon/light-site-auditor`, run with `npx @chrissgon/light-site-auditor <url>` or installed with `npm install -g`. The command stays `auditor`. There is no hosted page and no service.
- **Options not taken:** a page that runs the audit on demand, and a hosted service. Both would run a browser on a server the owner pays for and keeps up, and would audit sites on behalf of strangers, which breaks the consent rule unless the service checks ownership.

### Costs

None beyond the user's own machine:

| Item | Cost | Source (accessed 2026-09-30) |
|------|------|------------------------------|
| Publishing a public package on npm | none: a free npm account can publish public packages; only private packages need "a paid user or organization account" | https://docs.npmjs.com/about-private-packages ; https://docs.npmjs.com/creating-and-publishing-scoped-public-packages |
| The publish workflow (`.github/workflows/publish.yml`) | none: "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners" | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| Running an audit | the user's machine and connection: the package and its dependencies, one download of Playwright's Chromium, and two loads of the audited page (sizes in the README, "Install and use") | measured on 2026-09-30, see the README |

### Consequences

- Real sites are audited only with an accepted consent record (`--consent <file>`, `src/consent.ts`, `docs/field/consentimento.md`). The gate is part of the published CLI; there is no flag to skip it.
- Publication goes through `.github/workflows/publish.yml` on a `v*` tag, with npm trusted publishing (OIDC) and provenance; no npm token is stored anywhere. The owner approves the exact payload before pushing the tag.
