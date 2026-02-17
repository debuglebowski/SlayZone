# Clara Philosophy

Strategy for structuring codebases to be AI-comprehensible from top to bottom.

## The Problem

AI coding tools attempt to find relevant files to understand how a solution works. In complex setups, they fail to understand the whole picture because context windows are limited and retrieval is imperfect.

## Core Principles

### The Zoom Property

System must be understandable at every altitude:

| Altitude | Example |
|----------|---------|
| 10,000ft | "It's a payment processor that validates, routes, and settles transactions" |
| 1,000ft | "Validation uses a rule engine, routing is strategy-pattern based on card network, settlement is async with retry" |
| 100ft | The actual code |

Each level must be *complete* at that level. No zoom-in required to understand current level.

### Golden Path

System should have obvious main path that everything else hangs off. Clear entry point → core flow → exit point you can trace, with everything else being supporting detail.

## Discovery via CLAUDE.md

`CLAUDE.md` at repo root is the entry point for AI tools. Contains navigation instructions, maintenance rules, available skills.

## Nested Documentation

Documentation nested so each level contains only what's relevant at that altitude.

### The Context Stack

AI working on a feature loads docs from root to leaf:

```
ARCHITECTURE.md → DOMAIN.md
```

For app-level work (routing, layouts, composition):

```
ARCHITECTURE.md → APP.md
```

### Depth Guidance

- **ARCHITECTURE.md**: ~1 page. Whole system overview.
- **APP.md**: ~1 page. Composition and routing.
- **DOMAIN.md**: 1-2 pages max. Business rules, contracts.

Principle: if it's obvious from reading the code, don't document it.

## Package-Per-Domain Structure

Codebase organized into three categories:

| Category | Description | How to decide |
|----------|-------------|---------------|
| Apps | Entry points composing domains into runnable apps. Routing, middleware, providers, layouts. No business logic. | It wires up routes, providers, assembles domains. |
| Domains | Self-contained business capabilities. Own rules, contracts, client/server implementations. Organized around user journeys. | It enforces business rules or implements user capability. |
| Shared | Infrastructure across codebase. UI primitives, API client, utilities. | Purely technical, useful across multiple domains. |

### Why This Structure

- **Domain cohesion** — changes to domain touch one package, not two apps
- **Contracts automatic** — `shared/` in each domain is single source of truth
- **Dependencies explicit** — package.json enforces boundaries
- **Tooling works with you** — TypeScript project refs, turborepo/nx caching
- **Clear responsibilities** — apps compose, domains contain logic, shared provides plumbing

## Domain Structure

| Folder | Contains |
|--------|----------|
| shared/ | Types, validation schemas, contracts, constants — imported by both client and main |
| client/ | React components, hooks, state management — renderer process |
| main/ | Handlers, services, database access — main process (Electron) |

### Asymmetric Domains

Not every domain needs both client and main:

```
domains/
├── onboarding/     # Client-only
│   ├── DOMAIN.md
│   ├── shared/
│   └── client/
│
├── terminal/       # Full-stack
│   ├── DOMAIN.md
│   ├── shared/
│   ├── client/
│   └── main/
```

### Cross-Domain Features

When feature spans multiple domains:

- **Feature owned by one domain, uses others** → lives in that domain, documents dependencies
- **Feature is genuinely its own capability** → becomes its own package with dependencies

Test: would you explain this feature as part of an existing domain, or as its own thing?

## Routes vs Domains

| Routes | Domains |
|--------|---------|
| Navigation structure | Capability structure |
| What user sees | What developer reasons about |
| Entry points | Implementation |

Routes live in `packages/apps/app`. Domains live in `packages/domains/`.

## README.md vs ARCHITECTURE.md

| README.md | ARCHITECTURE.md |
|-----------|-----------------|
| External-facing | Internal-facing |
| How to run, install, contribute | How the system works |
| For new contributors and users | For developers working in codebase |

README.md should point to ARCHITECTURE.md:

```markdown
## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture and domain documentation.
```

## Shared Rules

- Domains and apps import from shared. Shared never imports from domains or apps.
- If adding business rules to shared, it should probably be a domain.

## State Management

State should be domain-scoped by default:

- Each domain owns its state in `client/`
- Cross-domain state lives in `packages/shared/` (feature flags, etc.)
- Server state (React Query, SWR) encouraged — scopes naturally to domains

Avoid single global store where all domains dump state.

## Domain Dependencies

Dependencies allowed but must be **directional**.

Acceptable:
```
checkout/ ──depends on──► catalog/
checkout/ ──depends on──► account/
```

Problematic:
```
checkout/ ◄──────────────► catalog/  (circular)
```

Dependencies enforced via package.json and documented in DOMAIN.md.

## Decision Logs

Every doc file includes decision log at bottom. Preserves history, prevents re-litigating past decisions.

Format:
```markdown
## Decision Log

**2024-01-15: Use React Query for server state**
Simplifies cache invalidation, reduces boilerplate.

**2024-02-03: Split payment into separate domain**
Was growing too large, different rate of change from checkout.
```

## Documentation Sync

Two-step sync process to keep docs current:

### /sync-domain [domain]

Reads domain code, generates proposed update:

1. Scan exports in shared/, client/, server/
2. Identify patterns in use
3. Check for new dependencies
4. Compare against existing docs
5. Generate diff of proposed changes

Output is proposal, not direct write.

### /verify-docs

Checks docs against code, flags drift:

1. Dependencies listed match package.json
2. Documented contracts match shared/ types
3. Documented patterns match actual code
4. No major exports undocumented

Output is report of discrepancies, not automatic fixes.
