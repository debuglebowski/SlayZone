---
name: competitor-research
description: ""
trigger: auto
---

Create or refresh one competitor record in the comparison canon.

Use this skill when the task is to research, validate, migrate, or update a specific competitor.

## Load First

- Read [`comparison/COMPETITOR_GUIDE.md`](/Users/Kalle/dev/projects/slayzone/comparison/COMPETITOR_GUIDE.md).
- Read [`comparison/TRACKING.md`](/Users/Kalle/dev/projects/slayzone/comparison/TRACKING.md).
- Read [`comparison/_template/index.md`](/Users/Kalle/dev/projects/slayzone/comparison/_template/index.md).

Then inspect any existing material for the target competitor:

- canonical folder in `comparison/<slug>/`
- legacy file in `comparison/_legacy/`

## Core Rule

An existing competitor record is a baseline, not truth.

When updating or migrating a competitor:

- read the stored record first
- treat all stored claims as provisional
- re-check high-impact claims against current primary sources
- update structured data before prose

## Research Workflow

1. Identify the current state:
   - missing
   - legacy-flat
   - canon-draft
   - canon-reviewed
   - stale
2. Gather current primary sources first.
3. Revalidate the highest-impact claims:
   - identity and links
   - pricing
   - deployment and provider model
   - core comparison axes
4. Update or create the canonical folder-based record.
5. Fill structured frontmatter first:
   - facts
   - comparison axes
   - sources
   - tags and relevance
6. Write or revise the markdown body second.
7. Update the tracker status if the record moved forward.

## Writing Rules

- keep facts, evaluations, and editorial opinion separate
- use `yes`, `partial`, `no`, or `unknown` for axis verdicts
- lower confidence or use `unknown` when evidence is weak
- do not quietly preserve stale conclusions from the legacy record
- only refresh `last_checked` after revalidation is complete

## Screenshot Rules

Every `publish-ready` record needs at least one product screenshot.

- prefer the product screenshot from the competitor's official homepage or docs — most sites include one prominently
- capture the product UI element directly, not the surrounding marketing page
- use Chrome DevTools to navigate to the page, identify the product image element in the snapshot, and screenshot that element by uid
- if the image is hosted on a CDN that blocks direct download, screenshot the element from the rendered page instead
- one clean product screenshot is sufficient for `publish-ready` status
- save to `comparison/<slug>/assets/` and document in the `assets:` frontmatter block with caption, proves, source_url, and captured_on

## Migration Rules

When migrating from `comparison/_legacy/`:

- keep the legacy file as input until the canonical record is complete
- avoid creating split truth between the new folder and the old file
- if schema pressure appears, update the guide/template before mass migration

