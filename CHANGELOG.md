# Changelog


## v0.2.0

[compare changes](https://github.com/chrissgon/light-site-auditor/compare/v0.1.0...v0.2.0)

### 🚀 Enhancements

- **report:** The report in English too (--lang en-US), release 0.2.0 ([#9](https://github.com/chrissgon/light-site-auditor/pull/9))

### 🩹 Fixes

- **report:** Counts of one in the singular ([#6](https://github.com/chrissgon/light-site-auditor/pull/6))

### 📖 Documentation

- **readme:** Keep only the English README ([#7](https://github.com/chrissgon/light-site-auditor/pull/7))
- **readme:** The English README carries everything the Portuguese section held ([#8](https://github.com/chrissgon/light-site-auditor/pull/8))

## v0.1.0

[compare changes](https://github.com/chrissgon/light-site-auditor/compare/7a54856495c0569a8249f26f8f9a0f6ce1f7d33d...v0.1.0)

### 🚀 Enhancements

- **lighthouse:** Run Lighthouse 13.5.0 through the Node API with the cited mobileRegular3G profile; fixture site and server (T-aud-2) ([82a4d4a](https://github.com/chrissgon/light-site-auditor/commit/82a4d4a))
- **weight:** Bytes by file type from Lighthouse's network-requests, checked against the fixture files (T-aud-3) ([f4ef952](https://github.com/chrissgon/light-site-auditor/commit/f4ef952))
- **a11y:** WCAG 2.1 AA violations with @axe-core/playwright 4.13.0 on Lighthouse's phone screen (T-aud-4) ([f1a4b69](https://github.com/chrissgon/light-site-auditor/commit/f1a4b69))
- **explanations:** Plain-Portuguese catalog for axe rules, Lighthouse weight audits and report text, with a glossary (T-aud-5) ([8c6faba](https://github.com/chrissgon/light-site-auditor/commit/8c6faba))
- **report:** Auditor <url> writes a Portuguese report in Markdown and HTML beside the raw JSON; local hosts only (T-aud-6) ([7b67d8a](https://github.com/chrissgon/light-site-auditor/commit/7b67d8a))
- Consent gate for real sites and a publish-ready npm package (T-aud-7, T-aud-9, T-aud-10 prep) ([#4](https://github.com/chrissgon/light-site-auditor/pull/4))

### 📖 Documentation

- README in Portuguese and English with setup, use on the fixture and how numbers are checked ([2c0d71b](https://github.com/chrissgon/light-site-auditor/commit/2c0d71b))
- AGENTS.md records the public repository, its protected main, the pre-commit hook and no npm publish ([#2](https://github.com/chrissgon/light-site-auditor/pull/2))

### 🏡 Chore

- Repository baseline with a secret scan, checks workflow, Dependabot, CODEOWNERS, SECURITY.md and a pre-commit hook ([43e6664](https://github.com/chrissgon/light-site-auditor/commit/43e6664))

### 🤖 CI

- A tag for a version already on npm skips the publish ([#5](https://github.com/chrissgon/light-site-auditor/pull/5))

