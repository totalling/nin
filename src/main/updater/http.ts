/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { ipcMain } from "electron";
import { writeFileSync } from "original-fs";
import { join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { serializeErrors, VENCORD_FILES } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
const HEADERS = {
    Accept: "application/vnd.github+json",
    "User-Agent": VENCORD_USER_AGENT
};

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, { headers: HEADERS });
}

async function calculateGitChanges() {
    const latest = await githubGet("/commits/main");
    if (latest.sha.startsWith(gitHash)) return [];

    const commits: any[] = await githubGet(`/commits?sha=main&per_page=20`);
    const idx = commits.findIndex((c: any) => c.sha.startsWith(gitHash));
    const newCommits = idx === -1 ? commits.slice(0, 10) : commits.slice(0, idx);

    return newCommits.map((c: any) => ({
        hash: c.sha.slice(0, gitHash.length),
        author: c.author?.login ?? c.commit.author.name,
        message: c.commit.message.split("\n")[0]
    }));
}

async function update() {
    const release = await githubGet("/releases/latest");
    const assets: Array<{ name: string; browser_download_url: string; }> = release.assets ?? [];

    for (const file of VENCORD_FILES) {
        const asset = assets.find(a => a.name === file);
        if (!asset) throw new Error(`Release is missing ${file} — make sure the GitHub Actions workflow publishes all built files.`);

        const data = await fetchBuffer(asset.browser_download_url, { headers: { "User-Agent": VENCORD_USER_AGENT } });
        writeFileSync(join(__dirname, file), data);
    }

    return true;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => `https://github.com/${gitRemote}`));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(update));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(() => true));
