/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const TRACKING_PARAMS = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "gclid", "gclsrc", "dclid",
    "_ga", "_gl", "_gid",
    "igshid", "igsh",
    "twclid",
    "si",
    "mc_cid", "mc_eid",
    "mkt_tok",
    "_hsenc", "_hsmi",
    "ref", "referer", "referrer",
    "source", "src",
    "srsltid",
]);

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

function scrubUrl(raw: string): string {
    try {
        const url = new URL(raw);
        let changed = false;
        for (const key of [...url.searchParams.keys()]) {
            if (TRACKING_PARAMS.has(key.toLowerCase())) {
                url.searchParams.delete(key);
                changed = true;
            }
        }
        if (!changed) return raw;
        const result = url.toString();
        return result.endsWith("?") ? result.slice(0, -1) : result;
    } catch {
        return raw;
    }
}

const listener: MessageSendListener = (_channelId, message) => {
    if (!message.content) return;
    const scrubbed = message.content.replace(URL_PATTERN, scrubUrl);
    if (scrubbed !== message.content) message.content = scrubbed;
};

export default definePlugin({
    name: "TrackingScrubber",
    description: "Automatically strips tracking parameters (UTM, fbclid, gclid, etc.) from links before you send them.",
    authors: [Devs.medisiner],
    dependencies: ["MessageEventsAPI"],

    start() {
        addMessagePreSendListener(listener);
    },

    stop() {
        removeMessagePreSendListener(listener);
    }
});
