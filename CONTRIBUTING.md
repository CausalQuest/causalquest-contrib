# Contributing

Thank you for building on CausalQuest. There are two ways to contribute.

## 1. Community features and game modes (CausalScribe)

These are submitted **through the game**, not as pull requests to this repository. The full rules are in
[`kit/CONTRIBUTING.md`](kit/CONTRIBUTING.md). In short:

- **Who:** paid players aged 18 or over, signed in, who accept the [contributor agreement](CLA.md) (CausalQuest-CLA-1) with each submission.
- **How often:** up to **2 submissions in any rolling 7 days**. A new version counts as a submission.
- **Review:** automatic checks, then staff test, then at least 30 days in Labs, then live. Each step needs **two** reviewers'
  approvals, or one for a trusted contributor once 10 features have shipped (3 clean live features make you trusted).
- **Points:** 500 the first time a feature or theme goes live, 200 for a later major version. Points have no cash value, and
  there is no KRF credit for code.
- **Security removals:** a feature removed for security comes down everywhere at once, its points are taken back, and its
  contributor loses trusted status.

Check your work with `node kit/cs-check.mjs <folder>` and against the [review checklist](docs/review-checklist.md) before you
submit.

## 2. Improvements to this repository

Pull requests that improve the kit, the docs, the samples or the agent examples are welcome. For anything large, open an issue
first so we can discuss it.

- **Accept the agreement once.** The contributor agreement check asks you to post "I have read and accept CausalQuest-CLA-1" on
  your first pull request. Contributing for a company? Email contact@causalhub.ai first, so the company can sign a corporate
  agreement.
- **Licences:** code you contribute is published under Apache-2.0 and documentation under CC BY 4.0, as the rest of this
  repository is.

- **Keep each one small,** with a clear description of what it changes and why.
- **Keep the kit's core identical to the game.** `kit/core/` and `kit/rules.json` must stay byte-identical to the game's copies,
  so changes there are made by CausalQuest staff and synced into this repository.
- **Pass the checks.** `node kit/cs-check.mjs` must pass on every example and sample; the workflow in `.github/workflows` runs it on
  each pull request.
- **Disclose AI help.** If an AI tool helped you, say so in the pull request, as manifests do with `ai_assistance`.

## Code of conduct

Be kind, assume good faith, and keep discussion about the work. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
