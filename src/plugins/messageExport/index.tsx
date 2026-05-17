// nin © 2026

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Menu, RestAPI, Toasts, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Export format",
        options: [
            { label: "Plain text (.txt)", value: "txt", default: true },
            { label: "JSON (.json)", value: "json" },
        ]
    },
    onlyOwn: {
        type: OptionType.BOOLEAN,
        description: "Only export your own messages",
        default: false,
    },
    limit: {
        type: OptionType.SELECT,
        description: "How many messages to export",
        options: [
            { label: "100", value: 100 },
            { label: "500", value: 500, default: true },
            { label: "1000", value: 1000 },
            { label: "All (slow)", value: 0 },
        ]
    }
});

async function fetchMessages(channelId: string, max: number): Promise<any[]> {
    const all: any[] = [];
    let before: string | undefined;

    while (true) {
        const url = before
            ? `/channels/${channelId}/messages?limit=100&before=${before}`
            : `/channels/${channelId}/messages?limit=100`;

        const res = await RestAPI.get({ url });
        const batch: any[] = res.body ?? [];
        if (!batch.length) break;

        all.push(...batch);
        before = batch[batch.length - 1].id;

        if (batch.length < 100) break;
        if (max > 0 && all.length >= max) break;
        await new Promise(r => setTimeout(r, 300));
    }

    return max > 0 ? all.slice(0, max) : all;
}

function toTxt(messages: any[]): string {
    return messages
        .slice()
        .reverse()
        .map(m => {
            const ts = new Date(m.timestamp).toLocaleString();
            const author = m.author?.global_name ?? m.author?.username ?? "Unknown";
            const content = m.content || (m.attachments?.length ? `[${m.attachments.length} attachment(s)]` : "[no content]");
            return `[${ts}] ${author}: ${content}`;
        })
        .join("\n");
}

function toJson(messages: any[]): string {
    return JSON.stringify(
        messages.slice().reverse().map(m => ({
            id: m.id,
            timestamp: m.timestamp,
            author: m.author?.global_name ?? m.author?.username,
            authorId: m.author?.id,
            content: m.content,
            attachments: m.attachments?.map((a: any) => a.url) ?? [],
            edited: m.edited_timestamp ?? null,
        })),
        null,
        2
    );
}

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function doExport(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    const name = channel?.name ?? channelId;
    const { format, onlyOwn, limit } = settings.store;
    const meId = UserStore.getCurrentUser().id;

    Toasts.show({ message: "Exporting messages…", type: Toasts.Type.MESSAGE, id: Toasts.genId() });

    let messages = await fetchMessages(channelId, limit);
    if (onlyOwn) messages = messages.filter(m => m.author?.id === meId);

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${name}-${ts}.${format}`;

    if (format === "json") {
        download(filename, toJson(messages), "application/json");
    } else {
        download(filename, toTxt(messages), "text/plain");
    }

    Toasts.show({ message: `Exported ${messages.length} messages`, type: Toasts.Type.SUCCESS, id: Toasts.genId() });
}

const channelCtxPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel?.id) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    const realItem = (group as any[]).find((c: any) => c?.props?.id === "mark-channel-read") as any;
    const ItemType = realItem?.type ?? Menu.MenuItem;

    group.push(
        <ItemType
            id="nin-message-export"
            label="Export Messages"
            action={() => doExport(channel.id)}
        />
    );
};

export default definePlugin({
    name: "MessageExport",
    description: "Export messages from any channel to a local .txt or .json file. Right-click a channel to use.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "channel-context": channelCtxPatch,
        "gdm-context": channelCtxPatch,
        "user-context": channelCtxPatch,
    }
});
