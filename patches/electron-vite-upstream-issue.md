# Upstream issue draft: electron-vite

File at: <https://github.com/alex8088/electron-vite/issues/new>

---

## Title

`esmShimPlugin` regex matches `import` inside string literals → corrupted main bundle

## Body

### Problem

`esmShimPlugin` (in `dist/chunks/lib-q6ns0vZr.js` of v5.0.0, also in `src/plugins/esm-shim.ts` upstream) uses a regex to find the position of the last static ESM import in a rendered chunk:

```js
const ESMStaticImportRe = /(?<=\s|^|;)import\s*([\s"']*(?<imports>[\p{L}\p{M}\w\t\n\r $*,/{}@.]+)from\s*)?["']\s*(?<specifier>...)\s*["'][\s;]*/gmu;
```

The lookbehind `(?<=\s|^|;)` matches whitespace anywhere — including inside string literals. Source code like:

```ts
const x = dryRun ? 'dry-run import' : 'committing'
```

is bundled to (rolled up) output that contains the string verbatim:

```js
emit(uploadId, "committing", 0, dryRun ? "dry-run import" : "committing");
```

The regex matches on the ` import` substring inside the string. The match's end position lands mid-string (after the optional `from`-clause matching skips, the regex hits `["']` and consumes the closing `'` of the original string, then keeps going looking for the specifier). `lastESMImport.end` is therefore mid-string, and `appendRight(end, CJSShim)` injects the shim INSIDE the string literal:

```js
emit(uploadId, "committing", 0, dryRun ? "dry-run import" : "
// -- CommonJS Shims --
import __cjs_mod__ from 'node:module';
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require = __cjs_mod__.createRequire(import.meta.url);
committing");
```

`vite:esbuild-transpile` then errors with `Unterminated string literal` on a line that looks fine in source.

### Reproducer

Any ESM main-process bundle whose source contains a string literal like `'foo import bar'` or `'failed to import file'` — i.e. lowercase `import` preceded by whitespace inside a string. We hit it with the literal `'dry-run import'` in a progress event label.

### Suggested fix

Tighten the lookbehind from `\s` to `\n`. Real ESM import statements are always at the start of a line (or after `^`/`;`); they're never preceded by a plain space. Strings, however, commonly contain spaces:

```diff
-const ESMStaticImportRe = /(?<=\s|^|;)import\s*(...)/gmu;
+const ESMStaticImportRe = /(?<=\n|^|;)import\s*(...)/gmu;
```

This is a one-character change that:
- Still matches all real ESM imports (always after newline / start / semicolon)
- Excludes string literals containing ` import ` (single-line strings can't have `\n` before `import` without escaping)
- Doesn't require parsing JS / building an AST

A more thorough fix would tokenize JS to skip string + comment context, but the regex tightening covers the practical case.

### Verification

Locally patched via `pnpm patch electron-vite@5.0.0` with the above one-line diff. Main-process bundle now builds correctly and `'dry-run import'` survives bundling intact.

### Environment

- electron-vite 5.0.0
- vite 7.3.1
- esbuild 0.27.2 (vite-bundled)
- macOS / darwin
- Node 24
