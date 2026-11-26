// Tests de los hooks: se ejecutan como los ejecuta Claude Code (JSON por stdin) sobre un repo git temporal.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");

function repo(config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "d4c-"));
  execFileSync("git", ["init", "-q", "-b", "main", dir]);
  execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "inicio"]);
  if (config) {
    mkdirSync(path.join(dir, ".claude"), { recursive: true });
    writeFileSync(path.join(dir, ".claude", "delta4c.json"), JSON.stringify(config));
  }
  return dir;
}

function correr(script, entrada, args = [], env = {}) {
  const datos = mkdtempSync(path.join(os.tmpdir(), "d4c-datos-"));
  const r = spawnSync("node", [path.join(scripts, script), ...args], {
    input: JSON.stringify(entrada),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_DATA: env.CLAUDE_PLUGIN_DATA || datos, ...env },
  });
  let json = null;
  try {
    json = r.stdout.trim() ? JSON.parse(r.stdout) : null;
  } catch {}
  return { codigo: r.status, json, stderr: r.stderr };
}

const decision = (r) => r.json?.hookSpecificOutput?.permissionDecision ?? "ninguna";

// ---------- proteger ----------

test("proteger: niega editar .env y permite .env.example", () => {
  const dir = repo();
  const env = correr("proteger.mjs", { cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, ".env") } });
  assert.equal(decision(env), "deny");
  const ejemplo = correr("proteger.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, ".env.example") } });
  assert.equal(decision(ejemplo), "ninguna");
  const local = correr("proteger.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: "apps/web/.env.local" } });
  assert.equal(decision(local), "deny");
});

test("proteger: respeta los globs de protegidos", () => {
  const dir = repo({ protegidos: ["prisma/migrations/**", "src/*.generated.ts"] });
  const mig = correr("proteger.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, "prisma/migrations/2026_x/migration.sql") } });
  assert.equal(decision(mig), "deny");
  const gen = correr("proteger.mjs", { cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, "src/api.generated.ts") } });
  assert.equal(decision(gen), "deny");
  const anidado = correr("proteger.mjs", { cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, "src/sub/api.generated.ts") } });
  assert.equal(decision(anidado), "ninguna", "* no cruza /");
  const normal = correr("proteger.mjs", { cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, "src/app.ts") } });
  assert.equal(decision(normal), "ninguna");
});

test("proteger: comandos peligrosos se niegan", () => {
  const dir = repo();
  const negados = [
    "git push --force origin main",
    "git push -f",
    "git push -uf origin rama",
    "git push origin +main",
    "git commit -m x --no-verify",
    "LEFTHOOK=0 git commit -m x",
    "HUSKY=0 git push",
    'PERMITIR_TESTS="porque si" git commit -m x',
    "rm -rf /",
    "rm -rf ~",
    "cd x && rm -fr $HOME",
    "cat .env",
    "tail -n 5 apps/api/.env.production",
  ];
  for (const command of negados) {
    const r = correr("proteger.mjs", { cwd: dir, tool_name: "Bash", tool_input: { command } });
    assert.equal(decision(r), "deny", command);
  }
});

test("proteger: comandos normales pasan", () => {
  const dir = repo();
  const permitidos = [
    "git push --force-with-lease origin rama",
    "git push -u origin rama",
    "git push --follow-tags",
    "git commit -m 'arregla el flujo --no-verify no'",
    "rm -rf node_modules",
    "rm -rf ./dist/",
    "cat .env.example",
    "pnpm test",
    "grep -r ENV_VAR src/",
  ];
  for (const command of permitidos) {
    const r = correr("proteger.mjs", { cwd: dir, tool_name: "Bash", tool_input: { command } });
    assert.equal(decision(r), "ninguna", command);
  }
});

// ---------- acotar-tests ----------

test("acotar-tests: apagado por defecto", () => {
  const dir = repo();
  const r = correr("acotar-tests.mjs", { cwd: dir, tool_name: "Bash", tool_input: { command: "pnpm test" } });
  assert.equal(r.json, null);
});

test("acotar-tests: reescribe solo comandos de test simples y conserva el exit code", () => {
  const dir = repo({ acotarSalidaTests: 50 });
  const r = correr("acotar-tests.mjs", { cwd: dir, tool_name: "Bash", tool_input: { command: "pnpm test", description: "x" } });
  const nuevo = r.json.hookSpecificOutput.updatedInput;
  assert.equal(nuevo.command, "set -o pipefail; pnpm test 2>&1 | tail -n 50");
  assert.equal(nuevo.description, "x");
  for (const command of ["pnpm test && rm x", "npm run build", "echo $(pnpm test)", "pnpm test > out.txt"]) {
    const s = correr("acotar-tests.mjs", { cwd: dir, tool_name: "Bash", tool_input: { command } });
    assert.equal(s.json, null, command);
  }
  const falla = spawnSync("bash", ["-c", "set -o pipefail; (echo fallo; exit 3) 2>&1 | tail -n 50"]);
  assert.equal(falla.status, 3);
});

// ---------- post-edicion ----------

test("post-edicion: avisa a Claude cuando el chequeo del archivo falla", () => {
  const dir = repo({
    chequeoRapido: [{ extensiones: ["ts"], comando: "grep -q 'any' {archivo} && echo 'no uses any' && exit 1 || exit 0" }],
  });
  writeFileSync(path.join(dir, "malo.ts"), "let x: any = 1;\n");
  writeFileSync(path.join(dir, "bueno.ts"), "let x = 1;\n");
  writeFileSync(path.join(dir, "notas.md"), "any\n");
  const malo = correr("post-edicion.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, "malo.ts") } });
  assert.equal(malo.codigo, 2);
  assert.match(malo.stderr, /no uses any/);
  const bueno = correr("post-edicion.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, "bueno.ts") } });
  assert.equal(bueno.codigo, 0);
  const md = correr("post-edicion.mjs", { cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, "notas.md") } });
  assert.equal(md.codigo, 0, "extensión no configurada");
});

test("post-edicion: rutas con espacios y comillas llegan como un solo argumento", () => {
  const dir = repo({ chequeoRapido: [{ extensiones: ["ts"], comando: "test -f {archivo}" }] });
  const nombre = "carpeta con espacio/it's.ts";
  mkdirSync(path.join(dir, "carpeta con espacio"));
  writeFileSync(path.join(dir, nombre), "ok\n");
  const r = correr("post-edicion.mjs", { cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, nombre) } });
  assert.equal(r.codigo, 0, r.stderr);
});

// ---------- compuerta ----------

test("compuerta: sin cambios no verifica; con cambios bloquea hasta que pasa", () => {
  const dir = repo({ verificar: ["test ! -f roto.txt"] });
  const datos = mkdtempSync(path.join(os.tmpdir(), "d4c-datos-"));
  const env = { CLAUDE_PLUGIN_DATA: datos };
  const base = { cwd: dir, session_id: "s1" };

  assert.equal(correr("compuerta.mjs", base, ["inicio"], env).codigo, 0);
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "sin cambios");

  writeFileSync(path.join(dir, "roto.txt"), "x");
  const bloqueo = correr("compuerta.mjs", base, ["fin"], env);
  assert.equal(bloqueo.codigo, 2);
  assert.match(bloqueo.stderr, /Compuerta \(verificación\)/);

  writeFileSync(path.join(dir, "docs.md"), "solo docs");
  execFileSync("rm", [path.join(dir, "roto.txt")]);
  writeFileSync(path.join(dir, "arreglo.ts"), "ok");
  assert.equal(correr("compuerta.mjs", { ...base, stop_hook_active: true }, ["fin"], env).codigo, 0, "pasa");
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "ya verificado");
});

test("compuerta: cambios solo en docs no la disparan", () => {
  const dir = repo({ verificar: ["exit 1"] });
  const datos = mkdtempSync(path.join(os.tmpdir(), "d4c-datos-"));
  const env = { CLAUDE_PLUGIN_DATA: datos };
  const base = { cwd: dir, session_id: "s2" };
  correr("compuerta.mjs", base, ["inicio"], env);
  mkdirSync(path.join(dir, "docs"));
  writeFileSync(path.join(dir, "docs", "plan.md"), "x");
  writeFileSync(path.join(dir, "README.md"), "x");
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0);
});

test("compuerta: suelta con aviso tras los reintentos y no pisa la base al compactar", () => {
  const dir = repo({ verificar: ["exit 1"], reintentosCompuerta: 2 });
  const datos = mkdtempSync(path.join(os.tmpdir(), "d4c-datos-"));
  const env = { CLAUDE_PLUGIN_DATA: datos };
  const base = { cwd: dir, session_id: "s3" };
  correr("compuerta.mjs", base, ["inicio"], env);
  writeFileSync(path.join(dir, "a.ts"), "x");
  correr("compuerta.mjs", base, ["inicio"], env); // SessionStart tras /compact: no debe adoptar el cambio como base
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 2);
  assert.equal(correr("compuerta.mjs", { ...base, stop_hook_active: true }, ["fin"], env).codigo, 2);
  const suelta = correr("compuerta.mjs", { ...base, stop_hook_active: true }, ["fin"], env);
  assert.equal(suelta.codigo, 0);
  assert.match(suelta.json.systemMessage, /NO está verificado/);
});

test("compuerta: apagada sin configuración o con DELTA4C_SIN_COMPUERTA", () => {
  const sinConfig = repo();
  writeFileSync(path.join(sinConfig, "a.ts"), "x");
  assert.equal(correr("compuerta.mjs", { cwd: sinConfig, session_id: "s4" }, ["fin"]).codigo, 0);
  const conConfig = repo({ verificar: ["exit 1"] });
  writeFileSync(path.join(conConfig, "a.ts"), "x");
  assert.equal(correr("compuerta.mjs", { cwd: conConfig, session_id: "s5" }, ["fin"], { DELTA4C_SIN_COMPUERTA: "1" }).codigo, 0);
});

// ---------- v0.2: e2e y revisión obligatoria ----------

function sesion(config, id) {
  const dir = repo(config);
  const datos = mkdtempSync(path.join(os.tmpdir(), "d4c-datos-"));
  const env = { CLAUDE_PLUGIN_DATA: datos };
  const base = { cwd: dir, session_id: id };
  correr("compuerta.mjs", base, ["inicio"], env);
  return { dir, env, base };
}

test("compuerta e2e: corre solo cuando los cambios tocan un disparador", () => {
  const { dir, env, base } = sesion({ verificar: ["true"], verificarE2E: ["exit 7"], disparadoresE2E: ["src/ui/**"] }, "e1");
  mkdirSync(path.join(dir, "src", "ui"), { recursive: true });
  writeFileSync(path.join(dir, "src", "logica.ts"), "x");
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "no toca UI");
  writeFileSync(path.join(dir, "src", "ui", "Boton.tsx"), "x");
  const r = correr("compuerta.mjs", base, ["fin"], env);
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /Compuerta \(e2e\)/);
});

test("compuerta e2e: detecta cambios ya commiteados en la sesión", () => {
  const { dir, env, base } = sesion({ verificarE2E: ["exit 1"], disparadoresE2E: ["**/*.tsx"] }, "e2");
  writeFileSync(path.join(dir, "Pantalla.tsx"), "x");
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "pantalla"]);
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 2);
});

test("revisión obligatoria: exige revisión en cambios grandes y la acepta una vez registrada", () => {
  const { dir, env, base } = sesion({ verificar: ["true"], revisionObligatoria: { minLineas: 10 } }, "r1");
  writeFileSync(path.join(dir, "chico.ts"), "a\nb\n");
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "cambio chico no exige revisión");

  writeFileSync(path.join(dir, "grande.ts"), Array.from({ length: 30 }, (_, i) => `linea ${i}`).join("\n"));
  const r = correr("compuerta.mjs", base, ["fin"], env);
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /delta4c-dev:revision/);
  assert.match(r.stderr, /marcar-revision\.mjs/);

  const marca = spawnSync("node", [path.join(scripts, "marcar-revision.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(marca.status, 0, marca.stderr);
  assert.match(marca.stdout, /revisión registrada/);
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "revisada");

  writeFileSync(path.join(dir, "grande.ts"), Array.from({ length: 30 }, (_, i) => `linea ${i}`).join("\n") + "\nfix\n");
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 0, "un arreglo chico después de revisar no exige otra revisión");

  writeFileSync(path.join(dir, "otro.ts"), Array.from({ length: 20 }, (_, i) => `nuevo ${i}`).join("\n"));
  assert.equal(correr("compuerta.mjs", base, ["fin"], env).codigo, 2, "otro cambio grande vuelve a exigirla");
});

test("revisión obligatoria: funciona sin `verificar` y la verificación fallida tiene prioridad", () => {
  const solo = sesion({ revisionObligatoria: true }, "r2");
  writeFileSync(path.join(solo.dir, "a.ts"), Array.from({ length: 50 }, () => "x").join("\n"));
  assert.match(correr("compuerta.mjs", solo.base, ["fin"], solo.env).stderr, /revisión/);

  const ambas = sesion({ verificar: ["exit 1"], revisionObligatoria: true }, "r3");
  writeFileSync(path.join(ambas.dir, "a.ts"), Array.from({ length: 50 }, () => "x").join("\n"));
  assert.match(correr("compuerta.mjs", ambas.base, ["fin"], ambas.env).stderr, /Compuerta \(verificación\)/);
});

// ---------- status line ----------

test("statusline: muestra modelo, contexto, costo y avisa cerca del límite", () => {
  const r = spawnSync("node", [path.join(scripts, "statusline.mjs")], {
    input: JSON.stringify({ model: { display_name: "Sonnet" }, context_window: { used_percentage: 75.4 }, cost: { total_cost_usd: 1.234 }, cwd: os.tmpdir() }),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[Sonnet\]/);
  assert.match(r.stdout, /75%/);
  assert.match(r.stdout, /\/clear o \/compact/);
  assert.match(r.stdout, /US\$1\.23/);
  const vacio = spawnSync("node", [path.join(scripts, "statusline.mjs")], { input: "", encoding: "utf8" });
  assert.equal(vacio.status, 0, "no rompe sin datos");
});
