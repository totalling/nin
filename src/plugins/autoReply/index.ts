/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Auto-reply is active",
        default: false
    },
    message: {
        type: OptionType.STRING,
        description: "Message to send when someone DMs you",
        default: "Hey! I'm away right now, I'll get back to you soon.",
        placeholder: "Your auto-reply message..."
    },
    cooldown: {
        type: OptionType.SELECT,
        description: "How long before the same person gets another auto-reply",
        options: [
            { label: "Once per session", value: 0, default: true },
            { label: "Every 30 minutes", value: 30 },
            { label: "Every hour", value: 60 },
            { label: "Every message", value: -1 },
        ]
    },
    dmOnly: {
        type: OptionType.BOOLEAN,
        description: "Only reply to direct messages (not group DMs)",
        default: true
    }
});

const replied = new Map<string, number>();

function shouldReply(userId: string): boolean {
    const cooldown = settings.store.cooldown;

    if (!replied.has(userId)) return true;
    if (cooldown === -1) return true;
    if (cooldown === 0) return false;

    const last = replied.get(userId)!;
    return Date.now() - last > cooldown * 60 * 1000;
}

function onMessage({ message, optimistic }: any) {
    if (optimistic) return;
    if (!settings.store.enabled) return;

    const me = UserStore.getCurrentUser();
    if (!me || message.author.id === me.id) return;

    if (message.author.bot || message.type !== 0) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return;

    const isDM = channel.type === 1;
    const isGroupDM = channel.type === 3;

    if (isDM && !shouldReply(message.author.id)) return;
    if (isGroupDM && (settings.store.dmOnly || !shouldReply(message.author.id))) return;
    if (!isDM && !isGroupDM) return;

    replied.set(message.author.id, Date.now());

    sendMessage(message.channel_id, { content: settings.store.message });
}

export default definePlugin({
    name: "AutoReply",
    description: "Automatically replies to DMs with a custom message — like Telegram's away message",
    authors: [Devs.medisiner],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
        replied.clear();
    }
});
