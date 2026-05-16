#!/usr/bin/env node
/*
 * nin installer — terminal UI
 */

import { existsSync, writeFileSync, renameSync, rmSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DIST = join(ROOT, "dist");
const PATCHER = join(DIST, "patcher.js");

// ── asar ──────────────────────────────────────────────────────────────────────

function buildAsar(patcherPath) {
    const indexJs = `require(${JSON.stringify(patcherPath)})`;
    const pkgJson = `{\n\t"name": "discord",\n\t"main": "index.js"\n}`;
    const indexBuf = Buffer.from(indexJs);
    const pkgBuf = Buffer.from(pkgJson);
    const header = JSON.stringify({
        files: {
            "index.js": { size: indexBuf.length, offset: "0" },
            "package.json": { size: pkgBuf.length, offset: String(indexBuf.length) }
        }
    });
    const headerBuf = Buffer.from(header);
    const padded = Math.ceil(headerBuf.length / 4) * 4;
    const headerPadded = Buffer.alloc(padded);
    headerBuf.copy(headerPadded);
    const prefix = Buffer.alloc(16);
    prefix.writeUInt32LE(4, 0);
    prefix.writeUInt32LE(padded + 8, 4);
    prefix.writeUInt32LE(padded + 4, 8);
    prefix.writeUInt32LE(padded, 12);
    return Buffer.concat([prefix, headerPadded, indexBuf, pkgBuf]);
}

// ── Discord discovery ─────────────────────────────────────────────────────────

const home = homedir();

const DISCORD_PATHS = {
    darwin: [
        "/Applications/Discord.app",
        "/Applications/Discord PTB.app",
        "/Applications/Discord Canary.app",
        `${home}/Applications/Discord.app`,
    ],
    linux: [
        "/usr/share/discord",
        "/usr/lib/discord",
        `${home}/.local/share/discord`,
        "/opt/discord",
    ],
    win32: [
        `${process.env.LOCALAPPDATA}\\Discord`,
        `${process.env.LOCALAPPDATA}\\DiscordPTB`,
        `${process.env.LOCALAPPDATA}\\DiscordCanary`,
    ],
};

function getResources(base) {
    return platform() === "darwin"
        ? join(base, "Contents", "Resources")
        : join(base, "resources");
}

function findInstalls() {
    return (DISCORD_PATHS[platform()] ?? [])
        .filter(p => existsSync(p))
        .map(p => {
            const res = getResources(p);
            const asar = join(res, "app.asar");
            const backup = join(res, "_app.asar");
            return {
                path: p,
                name: p.split(/[/\\]/).pop().replace(".app", ""),
                res, asar, backup,
                patched: existsSync(backup),
                valid: existsSync(res),
            };
        })
        .filter(d => d.valid);
}

// ── patch ops ─────────────────────────────────────────────────────────────────

function fixPerms(p) {
    if (platform() !== "darwin") return;
    try { execSync(`sudo chown -R "${process.env.USER}:wheel" "${p}"`, { stdio: "pipe" }); } catch {}
    try { execSync(`sudo xattr -dr com.apple.quarantine "${p}"`, { stdio: "pipe" }); } catch {}
}

function doInstall(inst) {
    if (!existsSync(PATCHER)) throw new Error("nin dist missing — run pnpm build first");
    fixPerms(inst.path);
    if (inst.patched) rmSync(inst.asar, { force: true });
    else renameSync(inst.asar, inst.backup);
    writeFileSync(inst.asar, buildAsar(PATCHER));
    fixPerms(inst.path);
}

function doUninstall(inst) {
    if (!inst.patched) throw new Error("nin is not installed here");
    fixPerms(inst.path);
    rmSync(inst.asar, { force: true });
    renameSync(inst.backup, inst.asar);
    fixPerms(inst.path);
}

// ── terminal helpers ──────────────────────────────────────────────────────────

const out = process.stdout;
const W = Math.min(out.columns || 80, 76);

const nl  = (s = "") => out.write(s + "\n");
const b   = s => `\x1b[1m${s}\x1b[22m`;
const dim = s => `\x1b[2m${s}\x1b[22m`;

function strip(s) { return s.replace(/\x1b\[[^m]*m/g, ""); }
function rpad(s, n) { return s + " ".repeat(Math.max(0, n - strip(s).length)); }
function center(s) {
    const len = strip(s).length;
    return " ".repeat(Math.floor((W - len) / 2)) + s;
}

const RULE = dim("─".repeat(W - 4));

// ANSI shadow "NIN"
const LOGO = [
    "███╗   ██╗██╗███╗   ██╗",
    "████╗  ██║██║████╗  ██║",
    "██╔██╗ ██║██║██╔██╗ ██║",
    "██║╚██╗██║██║██║╚██╗██║",
    "██║ ╚████║██║██║ ╚████║",
    "╚═╝  ╚═══╝╚═╝╚═╝  ╚═══╝",
];

// ── state ─────────────────────────────────────────────────────────────────────

let view      = "main";   // "main" | "action"
let installs  = [];
let sel       = 0;
let actionSel = 0;
let flash     = "";
let flashOk   = true;

function actionsFor(inst) {
    return inst.patched
        ? [
            { id: "repair",    label: "repair",    desc: "re-inject nin" },
            { id: "uninstall", label: "uninstall", desc: "restore original Discord" },
            { id: "back",      label: "back",      desc: "" },
          ]
        : [
            { id: "install",   label: "install",   desc: "inject nin into Discord" },
            { id: "back",      label: "back",      desc: "" },
          ];
}

// ── draw ──────────────────────────────────────────────────────────────────────

function drawHeader() {
    out.write("\x1b[2J\x1b[H");
    nl();
    for (const row of LOGO) nl(center(b(row)));
    nl();
    nl(center(dim("installer  ·  v1.14.13  ·  lightweight discord mod")));
    nl();
    nl("  " + RULE);
    nl();
}

function drawMain() {
    drawHeader();

    if (!existsSync(PATCHER)) {
        nl(`  ${dim("!")} nin is not built — run ${b("pnpm build")} first`);
        nl();
    }

    nl(`  ${b("INSTALLATIONS")}`);
    nl();

    if (installs.length === 0) {
        nl(`  ${dim("  no Discord installations found")}`);
    } else {
        const nameW = Math.max(...installs.map(i => i.name.length)) + 2;
        for (let i = 0; i < installs.length; i++) {
            const inst  = installs[i];
            const on    = i === sel;
            const arrow = on ? b("❯") : " ";
            const name  = rpad(on ? b(inst.name) : inst.name, on ? nameW + 9 : nameW);
            const tag   = inst.patched ? b("[patched]") : dim("[clean]  ");
            const path  = dim(inst.path);
            nl(`  ${arrow}  ${name}  ${tag}  ${path}`);
        }
    }

    nl();
    nl("  " + RULE);
    nl();

    if (flash) {
        nl(`  ${flashOk ? b(flash) : dim(flash)}`);
        nl();
    }

    nl(`  ${dim("↑↓")} navigate   ${dim("↵")} select   ${dim("q")} quit`);
    nl();
}

function drawAction() {
    const inst = installs[sel];
    drawHeader();

    nl(`  ${b(inst.name)}  ${dim(inst.path)}`);
    nl();
    nl("  " + RULE);
    nl();

    const acts = actionsFor(inst);
    for (let i = 0; i < acts.length; i++) {
        const { label, desc } = acts[i];
        const on    = i === actionSel;
        const arrow = on ? b("❯") : " ";
        const lbl   = rpad(on ? b(label) : label, 14);
        nl(`  ${arrow}  ${lbl}  ${desc ? dim(desc) : ""}`);
    }

    nl();
    nl("  " + RULE);
    nl();
    nl(`  ${dim("↑↓")} navigate   ${dim("↵")} confirm   ${dim("esc")} back`);
    nl();
}

function draw() {
    if (view === "main") drawMain();
    else drawAction();
}

// ── spinner ───────────────────────────────────────────────────────────────────

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

function startSpinner(label) {
    let fi = 0;
    out.write(`\n  ${dim(label)}  `);
    return setInterval(() => {
        out.write(`\x1b[1D\x1b[2m${FRAMES[fi++ % FRAMES.length]}\x1b[22m`);
    }, 80);
}

function stopSpinner(id, ok) {
    clearInterval(id);
    out.write(`\x1b[1D${ok ? "✓" : "✗"}\n`);
}

// ── action runner ─────────────────────────────────────────────────────────────

async function runAction(inst, actionId) {
    const label = actionId === "repair" ? "repairing" : actionId === "install" ? "installing" : "uninstalling";
    const spinner = startSpinner(label);
    await new Promise(r => setTimeout(r, 60));

    try {
        if (actionId === "install" || actionId === "repair") doInstall(inst);
        else doUninstall(inst);

        stopSpinner(spinner, true);
        flash  = actionId === "uninstall" ? "removed — restart Discord" : "installed — restart Discord";
        flashOk = true;
    } catch (e) {
        stopSpinner(spinner, false);
        flash   = e.message;
        flashOk = false;
    }

    await new Promise(r => setTimeout(r, 300));
    installs = findInstalls();
    sel      = Math.min(sel, Math.max(0, installs.length - 1));
    view     = "main";
    draw();
}

// ── input ─────────────────────────────────────────────────────────────────────

if (!process.stdin.isTTY) {
    console.error("\nnin installer requires an interactive terminal.\nRun: node scripts/installer/index.mjs\n");
    process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
out.write("\x1b[?25l");

process.on("exit", () => {
    out.write("\x1b[?25h\x1b[0m\n");
    try { process.stdin.setRawMode(false); } catch {}
});

installs = findInstalls();
draw();

let running = false;

process.stdin.on("data", async key => {
    if (running) return;

    if (key === "\x03" || (key === "q" && view === "main")) process.exit(0);

    if (view === "main") {
        if (key === "\x1b[A" && installs.length > 0) {
            sel = (sel - 1 + installs.length) % installs.length;
            draw();
        } else if (key === "\x1b[B" && installs.length > 0) {
            sel = (sel + 1) % installs.length;
            draw();
        } else if ((key === "\r" || key === "\n") && installs.length > 0) {
            view = "action";
            actionSel = 0;
            flash = "";
            draw();
        }
        return;
    }

    if (view === "action") {
        const acts = actionsFor(installs[sel]);

        if (key === "\x1b[A") {
            actionSel = (actionSel - 1 + acts.length) % acts.length;
            draw();
        } else if (key === "\x1b[B") {
            actionSel = (actionSel + 1) % acts.length;
            draw();
        } else if (key === "\x1b" || key === "\x1b[D") {
            view = "main";
            draw();
        } else if (key === "\r" || key === "\n") {
            const chosen = acts[actionSel];
            if (chosen.id === "back") { view = "main"; draw(); return; }
            running = true;
            await runAction(installs[sel], chosen.id);
            running = false;
        }
    }
});
