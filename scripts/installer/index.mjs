#!/usr/bin/env node

import { existsSync, writeFileSync, renameSync, rmSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DIST = join(ROOT, "dist");
const PATCHER = join(DIST, "patcher.js");

const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    clear: "\x1b[2J\x1b[H",
    hideCursor: "\x1b[?25l",
    showCursor: "\x1b[?25h"
};

const b = s => `${c.bold}${s}${c.reset}`;
const dim = s => `${c.dim}${s}${c.reset}`;
const strip = s => s.replace(/\x1b\[[^m]*m/g, "");
const rpad = (s, n) => s + " ".repeat(Math.max(0, n - strip(s).length));

const out = process.stdout;
const W = Math.min(out.columns || 80, 76);
const nl = (s = "") => out.write(s + "\n");
const center = s => " ".repeat(Math.floor((W - strip(s).length) / 2)) + s;

const RULE = dim("─".repeat(W - 4));

const LOGO = [
    `${c.cyan}███╗   ██╗██╗███╗   ██╗${c.reset}`,
    `${c.cyan}████╗  ██║██║████╗  ██║${c.reset}`,
    `${c.cyan}██╔██╗ ██║██║██╔██╗ ██║${c.reset}`,
    `${c.cyan}██║╚██╗██║██║██║╚██╗██║${c.reset}`,
    `${c.cyan}██║ ╚████║██║██║ ╚████║${c.reset}`,
    `${c.cyan}╚═╝  ╚═══╝╚═╝╚═╝  ╚═══╝${c.reset}`
];

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

function fixPerms(p) {
    if (platform() !== "darwin") return;
    try { execSync(`sudo chown -R "${process.env.USER}:wheel" "${p}"`, { stdio: "pipe" }); } catch {}
    try { execSync(`sudo xattr -dr com.apple.quarantine "${p}"`, { stdio: "pipe" }); } catch {}
}

function doInstall(inst) {
    if (!existsSync(PATCHER)) throw new Error("nin build footprint missing — run `pnpm build` first");
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

let view      = "main";
let installs  = [];
let sel       = 0;
let actionSel = 0;
let flash     = "";
let flashOk   = true;

function actionsFor(inst) {
    return inst.patched
        ? [
            { id: "repair",    label: "Repair",    desc: "Re-inject framework modifications" },
            { id: "uninstall", label: "Uninstall", desc: "Restore original pristine Discord binaries" },
            { id: "back",      label: "← Back",    desc: "Return to environment list" },
          ]
        : [
            { id: "install",   label: "Install",   desc: "Inject client modifications into app container" },
            { id: "back",      label: "← Back",    desc: "Return to environment list" },
          ];
}

function drawHeader() {
    out.write(c.clear);
    nl();
    for (const row of LOGO) nl(center(row));
    nl();
    nl(center(`${c.dim}installer  ·  ${c.cyan}v1.14.13${c.reset}${c.dim}  ·  lightweight client architecture${c.reset}`));
    nl();
    nl("  " + RULE);
    nl();
}

function drawMain() {
    drawHeader();

    if (!existsSync(PATCHER)) {
        nl(`  ${c.yellow}⚠️  Warning:${c.reset} Distribution payload missing. Run ${c.cyan}${b("pnpm build")}${c.reset} first.`);
        nl();
    }

    nl(`  ${b("AVAILABLE TARGET ENVIRONMENTS")}`);
    nl();

    if (installs.length === 0) {
        nl(`  ${c.red}  No valid Discord platform configurations discovered.${c.reset}`);
    } else {
        const nameW = Math.max(...installs.map(i => i.name.length)) + 2;
        for (let i = 0; i < installs.length; i++) {
            const inst  = installs[i];
            const on    = i === sel;
            
            const arrow = on ? `${c.cyan}❯${c.reset}` : " ";
            const name  = on ? `${c.cyan}${b(inst.name)}${c.reset}` : inst.name;
            const tag   = inst.patched 
                ? `${c.green}[patched]${c.reset}` 
                : `${c.dim}[clean]  ${c.reset}`;
            const path  = dim(inst.path);

            nl(`  ${arrow}  ${rpad(name, on ? nameW + 9 : nameW)}  ${tag}  ${path}`);
        }
    }

    nl();
    nl("  " + RULE);
    nl();

    if (flash) {
        nl(`  ${flashOk ? `${c.green}✔ ${b(flash)}` : `${c.red}✘ ${flash}`}${c.reset}`);
        nl();
    }

    nl(`  ${dim("↑↓")} Navigate   ${dim("↵")} Confirm Target   ${dim("Q / Ctrl+C")} Exit Window`);
    nl();
}

function drawAction() {
    const inst = installs[sel];
    drawHeader();

    nl(`  ${b("Target Environment:")} ${c.cyan}${inst.name}${c.reset}  ${dim(`(${inst.path})`)}`);
    nl();
    nl("  " + RULE);
    nl();

    const acts = actionsFor(inst);
    for (let i = 0; i < acts.length; i++) {
        const { label, desc } = acts[i];
        const on    = i === actionSel;
        
        const arrow = on ? `${c.cyan}❯${c.reset}` : " ";
        const lbl   = on ? `${c.cyan}${b(label)}${c.reset}` : label;
        nl(`  ${arrow}  ${rpad(lbl, on ? 23 : 14)}  ${desc ? dim(desc) : ""}`);
    }

    nl();
    nl("  " + RULE);
    nl();
    nl(`  ${dim("↑↓")} Select Task   ${dim("↵")} Execute Activity   ${dim("Esc / ←")} Go Back`);
    nl();
}

function draw() {
    if (view === "main") drawMain();
    else drawAction();
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(label) {
    let fi = 0;
    out.write(`\n  ${c.cyan}${FRAMES[0]}${c.reset} ${dim(label)}...`);
    return setInterval(() => {
        out.write(`\x1b[${strip(label).length + 7}D${c.cyan}${FRAMES[fi++ % FRAMES.length]}${c.reset} ${dim(label)}...`);
    }, 80);
}

function stopSpinner(id, ok) {
    clearInterval(id);
    out.write("\r\x1b[K");
}

async function runAction(inst, actionId) {
    const label = actionId === "repair" ? "Re-injecting code payload" : actionId === "install" ? "Deploying workspace hooks" : "Restoring production state";
    const spinner = startSpinner(label);
    await new Promise(r => setTimeout(r, 400));

    try {
        if (actionId === "install" || actionId === "repair") doInstall(inst);
        else doUninstall(inst);

        stopSpinner(spinner, true);
        flash  = actionId === "uninstall" ? "Module unhooked successfully. Restart Discord." : "Modifications active. Restart Discord instance.";
        flashOk = true;
    } catch (e) {
        stopSpinner(spinner, false);
        flash   = e.message;
        flashOk = false;
    }

    installs = findInstalls();
    sel      = Math.min(sel, Math.max(0, installs.length - 1));
    view     = "main";
    draw();
}

if (!process.stdin.isTTY) {
    console.error(`\n${c.red}Error:${c.reset} Interactive TTY environment context required.\nRun: node scripts/installer/index.mjs\n`);
    process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
out.write(c.hideCursor);

process.on("exit", () => {
    out.write(`${c.showCursor}${c.reset}\n`);
    try { process.stdin.setRawMode(false); } catch {}
});

installs = findInstalls();
draw();

let running = false;

process.stdin.on("data", async key => {
    if (running) return;

    if (key === "\x03" || (key.toLowerCase() === "q" && view === "main")) {
        process.exit(0);
    }

    if (view === "main") {
        if ((key === "\x1b[A" || key === "k") && installs.length > 0) {
            sel = (sel - 1 + installs.length) % installs.length;
            draw();
        } else if ((key === "\x1b[B" || key === "j") && installs.length > 0) {
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

        if (key === "\x1b[A" || key === "k") {
            actionSel = (actionSel - 1 + acts.length) % acts.length;
            draw();
        } else if (key === "\x1b[B" || key === "j") {
            actionSel = (actionSel + 1) % acts.length;
            draw();
        } else if (key === "\x1b" || key === "\x1b[D" || key === "h") {
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