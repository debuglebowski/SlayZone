# Conflict Resolution Views — Overview

The existing merge flow has 2 phases:
  Phase 1: Uncommitted changes → commit before merge
  Phase 2: Conflict resolution → resolve each file

These views redesign Phase 2 (conflict resolution) with multiple
conceptual approaches. Each can be mixed/matched.

## Views

| # | View                    | Purpose                                    |
|---|-------------------------|--------------------------------------------|
| 1 | Dashboard               | Bird's eye of all conflicts + progress     |
| 2 | Three-Way Merge Editor  | Classic base/ours/theirs + result editor   |
| 3 | Inline Unified View     | Single-pane with inline conflict markers   |
| 4 | Side-by-Side Diff       | Two-pane ours↔theirs comparison            |
| 5 | AI Resolution Flow      | AI-first: suggest → approve/edit → apply   |
| 6 | Rebase Stepper          | Commit-by-commit conflict walkthrough      |
| 7 | Chunk Navigator         | Hunk-by-hunk navigation within a file      |
| 8 | Composite Layout        | How all views compose in the actual app     |
