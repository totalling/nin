import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const API_URL = "https://nin.lol/api/v1/badges.json";

const NIN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M4 5.5V18.5H7V10.5L17 18.5V5.5H14V13.5L4 5.5Z'/%3E%3C/svg%3E";

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