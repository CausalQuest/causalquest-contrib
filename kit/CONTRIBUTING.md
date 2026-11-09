# Contributing to CausalQuest with CausalScribe

These are the rules for submitting a community feature or game mode, as decided on 9 Nov 2026. The game's server enforces them;
this kit's `cs-check` runs the same automatic checks so you can fix problems before you submit.

## Who can submit

Paid players aged 18 or over, signed in, whose contributor access is not blocked. You accept the contributor agreement
(`CausalQuest-CLA-1`) with each submission. The agreement's text is being prepared by counsel; submissions open once it is published here. Features are shown only to CausalQuest staff for now; your submission still goes into
the review queue.

## How often

**2 submissions per player in any rolling 7 days.** A new version of a feature you already submitted counts as a submission.
A bundle the automatic checks refuse is not stored and does not count. Over the limit, the server tells you when you can submit
again.

## Review steps

1. **Checked:** the automatic checks run at once (the same rules as `cs-check`, plus the moderation blocklist, feature-id ownership
   and a higher version than your last).
2. **Staff test:** people read every line and run it as staff.
3. **Labs:** opted-in players try it for at least 30 days.
4. **Live.**

Each step forward needs **two different reviewers' approvals**. A new version starts again at step 1.

## Trusted contributors

Until 10 features have shipped in total (reached live), everyone needs two approvals at each step. After that, a contributor with
**3 clean live features** (live, and never suspended or removed for security) becomes **trusted** and needs **one** approval per
step. Trusted status is recorded with an audit trail. Losing it (see below) is not undone automatically.

## Reward points

- **500 points** the first time a feature (or a CausalArtist theme) goes live;
- **200 points** when a later **major** version (for example 2.0.0 after 1.4.2) goes live;
- **nothing** for minor or patch versions.

Points are posted once per feature and major version. **Points have no cash value.**

**No KRF credit for code:** contributions earn no KRF (Knowledge Royalty Framework) credit until counsel advises otherwise.

## Security removals

A feature that turns out to be a security risk is **removed for security**, which is not the same as a suspension: every version
is taken down everywhere at once, the contributor **loses trusted status**, and the **points awarded for that feature are taken
back** (never below a zero balance). The reason is recorded. A removed feature can be restored only with two reviewers' approval,
and restoring it gives back neither the points nor trusted status.

Ordinary suspensions (a reviewer's, or automatic after several players report a feature) take one version down while it is
looked at, and can be lifted by a reviewer.

## What reviewers look for

Read the [review checklist](../docs/review-checklist.md) and, for modes, [`docs/mode-api.md`](../docs/mode-api.md). In short: no network, page, account or storage access, even indirectly; permissions you ask for
are used; honest name, summary and labels (nothing says "verified"; L2 to L4 tiers are marked simulated); AI assistance disclosed;
readable, unminified source.
