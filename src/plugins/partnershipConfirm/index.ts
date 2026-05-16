/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Alerts } from "@webpack/common";

const listener: MessageSendListener = (_channelId, message) => {
    const hasEveryone = message.content.includes("@everyone");
    const hasHere = message.content.includes("@here");
    if (!hasEveryone && !hasHere) return;

    const ping = hasEveryone ? "@everyone" : "@here";

    return new Promise<{ cancel: boolean }>(resolve => {
        Alerts.show({
            title: "Partnership Ping",
            body: `This message contains ${ping}. Send it?`,
            confirmText: "Send",
            cancelText: "Cancel",
            onConfirm: () => resolve({ cancel: false }),
            onCancel: () => resolve({ cancel: true }),
            onCloseCallback: () => resolve({ cancel: true }),
        });
    });
};

export default definePlugin({
    name: "PartnershipConfirm",
    description: "Asks for confirmation before sending any message that pings @everyone or @here.",
    authors: [Devs.medisiner],
    dependencies: ["MessageEventsAPI"],

    start() {
        addMessagePreSendListener(listener);
    },

    stop() {
        removeMessagePreSendListener(listener);
    }
});
