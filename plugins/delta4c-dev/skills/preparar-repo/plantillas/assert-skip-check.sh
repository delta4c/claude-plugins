#!/usr/bin/env bash
# Pre-commit (metodo/02 del kit, "Compuertas de CI"): rechaza un commit que en los tests en stage agrega un skip,
# un only, un fixme o un fail, comenta un test, baja la cantidad de asserts o cambia asserts por otros más débiles
# (research/front-testeable-y-operable-por-agentes.md, D8). Si es a propósito: PERMITIR_TESTS="motivo" git commit …
set -euo pipefail
[ -n "${PERMITIR_TESTS:-}" ] && { echo "assert-skip-check: permitido por PERMITIR_TESTS=$PERMITIR_TESTS"; exit 0; }
archivos=$(git diff --cached --name-only --diff-filter=AM | grep -E '\.(test|spec)\.(ts|tsx|js)$' || true)
[ -z "$archivos" ] && exit 0
fallas=0
for f in $archivos; do
  diff=$(git diff --cached -U0 -- "$f")
  modo='(\.(serial|parallel|concurrent|sequential))?'
  if echo "$diff" | grep -Eq "^\+.*\b(it|test|describe)$modo\.(skip|only|todo|fixme|skipIf|runIf)\(|^\+.*\b(xit|xdescribe|fit)\(|^\+.*\{\s*skip:\s*true"; then
    echo "assert-skip-check: $f agrega skip/only/fixme; esperado: ningún test salteado. Corregí el código o explicá con PERMITIR_TESTS=\"motivo\"." >&2; fallas=1
  fi
  # test.fail (Playwright) y test.fails (Vitest) invierten el resultado: pasan cuando el código falla
  if echo "$diff" | grep -Eq "^\+.*\b(it|test)$modo\.fails?\("; then
    echo "assert-skip-check: $f agrega test.fail; esperado: ningún test que pase cuando falla. Corregí el código o explicá con PERMITIR_TESTS=\"motivo\"." >&2; fallas=1
  fi
  # el healer de Playwright puede cambiar toHaveText('X') por toBeVisible(): misma cantidad de expect, menos verificación
  debiles='\.(toBeVisible|toBeTruthy|toBeDefined|toBeAttached)\('
  debiles_sacados=$(echo "$diff" | grep -Ec "^-.*$debiles" || true)
  debiles_puestos=$(echo "$diff" | grep -Ec "^\+.*$debiles" || true)
  fuertes_sacados=$(echo "$diff" | grep -E '^-.*\b(expect|assert)[.(]' | grep -Evc "$debiles" || true)
  if [ "$debiles_puestos" -gt "$debiles_sacados" ] && [ "$fuertes_sacados" -gt 0 ]; then
    echo "assert-skip-check: $f cambia asserts de valor por asserts de presencia ($fuertes_sacados sacados, $debiles_puestos de presencia puestos); esperado: verificar el valor. Si es a propósito, PERMITIR_TESTS=\"motivo\"." >&2; fallas=1
  fi
  if echo "$diff" | grep -Eq '^\+.*\.not\.to'; then
    echo "assert-skip-check: aviso, $f agrega asserts negados; pasan también cuando el locator no encuentra nada." >&2
  fi
  if echo "$diff" | grep -Eq '^\+\s*//\s*(it|test|describe)\('; then
    echo "assert-skip-check: $f comenta un test; esperado: borrarlo con motivo o arreglarlo." >&2; fallas=1
  fi
  sacados=$(echo "$diff" | grep -Ec '^-.*\b(expect|assert)[.(]' || true)
  puestos=$(echo "$diff" | grep -Ec '^\+.*\b(expect|assert)[.(]' || true)
  if [ "$sacados" -gt "$puestos" ]; then
    echo "assert-skip-check: $f baja los asserts ($sacados sacados, $puestos puestos); esperado: no menos. Si es a propósito, PERMITIR_TESTS=\"motivo\"." >&2; fallas=1
  fi
done
exit $fallas
