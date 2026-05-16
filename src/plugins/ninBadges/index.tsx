/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const API_URL = "https://nin.lol/api/v1/badges.json";

const NIN_USER_ICON = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#5865F2"/><text x="12" y="17" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="white" text-anchor="middle">N</text></svg>`);

const NIN_CONTRIB_ICON = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#23272A"/><text x="12" y="17" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="#5865F2" text-anchor="middle">N</text><circle cx="19" cy="5" r="5" fill="#3BA55C"/><path d="M16.5 5l1.5 1.5L21 3.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

type BadgeEntry = { id: string; tooltip: string; link?: string; };
type BadgesResponse = Record<string, BadgeEntry[]>;

let badgeCache: BadgesResponse = {};

async function fetchBadges() {
    try {
        const res = await fetch(API_URL);
        badgeCache = await res.json();
    } catch { }
}

const ninUserBadge: ProfileBadge = {
    id: "nin-user",
    description: "nin user",
    iconSrc: NIN_USER_ICON,
    position: BadgePosition.END,
    link: "https://nin.lol",
};

const ninContribBadge: ProfileBadge = {
    id: "nin-contributor",
    getBadges({ userId }) {
        const entries = badgeCache[userId];
        if (!entries) return [];
        return entries.map(entry => ({
            id: entry.id,
            description: entry.tooltip,
            iconSrc: NIN_CONTRIB_ICON,
            position: BadgePosition.START,
            link: entry.link,
        }));
    },
};

export default definePlugin({
    name: "NinBadges",
    description: "Adds a nin badge to all nin users, and contributor badges fetched from the nin API.",
    authors: [Devs.medisiner],
    dependencies: ["BadgeAPI"],

    async start() {
        await fetchBadges();
        addProfileBadge(ninUserBadge);
        addProfileBadge(ninContribBadge);
    },

    stop() {
        removeProfileBadge(ninUserBadge);
        removeProfileBadge(ninContribBadge);
    }
});
