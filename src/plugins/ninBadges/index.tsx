/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const API_URL = "https://nin.lol/api/v1/badges.json";

const NIN_ICON = "https://lovelybio.media/uploads/2a88d302-e8ca-4969-866a-8759ba1c217a/hgYGcSXzYu.png";

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
    iconSrc: NIN_ICON,
    position: BadgePosition.END,
    link: "https://nin-umber.vercel.app/",
};

const ninContribBadge: ProfileBadge = {
    id: "nin-contributor",
    getBadges({ userId }) {
        const entries = badgeCache[userId];
        if (!entries) return [];
        return entries.map(entry => ({
            id: entry.id,
            description: entry.tooltip,
            iconSrc: NIN_ICON,
            position: BadgePosition.START,
            link: entry.link,
        }));
    },
};

export default definePlugin({
    name: "NinBadges",
    description: "Adds a nin badge to all nin users.",
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