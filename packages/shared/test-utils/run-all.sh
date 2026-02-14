#!/bin/bash
# Run all IPC handler contract tests
# Usage: bash packages/shared/test-utils/run-all.sh

set -e
LOADER="--loader ./packages/shared/test-utils/loader.ts"
TSX="npx tsx"
PASS=0
FAIL=0

run_test() {
  echo ""
  echo "=== $1 ==="
  if $TSX $LOADER "$1" 2>&1 | grep -v 'npm warn\|Migration\|ExperimentalWarning\|--trace-warnings\|--import'; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

run_test packages/domains/settings/src/main/handlers.test.ts
run_test packages/domains/tags/src/main/handlers.test.ts
run_test packages/domains/projects/src/main/handlers.test.ts
run_test packages/domains/task-terminals/src/main/handlers.test.ts
run_test packages/domains/task/src/main/handlers.test.ts
run_test packages/domains/ai-config/src/main/handlers.items.test.ts
run_test packages/domains/ai-config/src/main/handlers.selections.test.ts
run_test packages/domains/ai-config/src/main/handlers.context.test.ts
run_test packages/domains/file-editor/src/main/handlers.test.ts
run_test packages/domains/diagnostics/src/main/service.test.ts
run_test packages/domains/integrations/src/main/handlers.db.test.ts
run_test packages/domains/worktrees/src/main/handlers.test.ts
run_test packages/domains/integrations/src/main/handlers.api.test.ts
run_test packages/domains/integrations/src/main/handlers.analyze.test.ts

echo ""
echo "=== Summary ==="
echo "Suites: $PASS passed, $FAIL failed"
