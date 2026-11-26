// Status line de Delta 4C: modelo · % de contexto (con aviso) · costo de la sesión · rama.
// La instala /delta4c-dev:configurar-maquina en ~/.claude/settings.json (copia este archivo a ~/.claude/).
import { execFileSync } from "node:child_process";

let texto = "";
for await (const trozo of process.stdin) texto += trozo;
let d = {};
try {
  d = JSON.parse(texto || "{}");
} catch {}

const color = process.env.NO_COLOR ? () => (s) => s : (c) => (s) => `\x1b[${c}m${s}\x1b[0m`;
const verde = color(32);
const amarillo = color(33);
const rojo = color(31);
const tenue = color(2);

const modelo = d.model?.display_name || "?";
const pct = Math.round(Number(d.context_window?.used_percentage) || 0);
const barra = "▓".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
let contexto = `${barra} ${pct}%`;
if (pct >= 70) contexto = rojo(`${contexto} · /clear o /compact`);
else if (pct >= 50) contexto = amarillo(contexto);
else contexto = verde(contexto);

const costo = Number(d.cost?.total_cost_usd);
const textoCosto = Number.isFinite(costo) ? `US$${costo.toFixed(2)}` : "";

let rama = "";
try {
  rama = execFileSync("git", ["-C", d.workspace?.current_dir || d.cwd || ".", "branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 1000,
  }).trim();
} catch {}

process.stdout.write([`[${modelo}]`, contexto, textoCosto, rama && tenue(`⎇ ${rama}`)].filter(Boolean).join("  "));
