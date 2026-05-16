/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { FluxDispatcher, MessageActions, React, useEffect, useState } from "@webpack/common";

const settings = definePluginSettings({
    timeout: {
        type: OptionType.SELECT,
        description: "How long before the message self-destructs",
        options: [
            { label: "10 seconds", value: 10 },
            { label: "30 seconds", value: 30, default: true },
            { label: "1 minute", value: 60 },
            { label: "5 minutes", value: 300 },
            { label: "10 minutes", value: 600 },
        ]
    },
    autoDisable: {
        type: OptionType.BOOLEAN,
        description: "Automatically disable after sending one self-destruct message",
        default: true
    }
});

const pendingChannels = new Set<string>();

const DestructIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className}>
        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-5h2v2h-2v-2Zm0-8h2v6h-2V7Z"/>
    </svg>
);

const DestructActiveIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className}>
        <path fill="var(--status-danger)" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-5h2v2h-2v-2Zm0-8h2v6h-2V7Z"/>
    </svg>
);

const SelfDestructButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const preSendListener = (_channelId: string) => {
            if (!enabled) return;
            if (settings.store.autoDisable) setEnabled(false);
            pendingChannels.add(_channelId);
        };

        addMessagePreSendListener(preSendListener);
        return () => { removeMessagePreSendListener(preSendListener); };
    }, [enabled]);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={enabled ? `Self-destruct ON (${settings.store.timeout}s)` : "Self-destruct OFF"}
            onClick={() => setEnabled(v => !v)}
        >
            {enabled ? <DestructActiveIcon /> : <DestructIcon />}
        </ChatBarButton>
    );
};

function onMessageCreate({ message, optimistic }: any) {
    if (optimistic) return;
    if (!pendingChannels.has(message.channel_id)) return;

    pendingChannels.delete(message.channel_id);

    const ms = settings.store.timeout * 1000;

    setTimeout(() => {
        MessageActions.deleteMessage(message.channel_id, message.id);
    }, ms);
}

export default definePlugin({
    name: "SelfDestructMessage",
    description: "Add a timer to your messages — they auto-delete after the set time. Like Telegram's self-destruct.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["MessageEventsAPI"],

    chatBarButton: {
        icon: DestructIcon,
        render: SelfDestructButton
    },

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        pendingChannels.clear();
    }
});
