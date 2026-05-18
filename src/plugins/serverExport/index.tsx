// nin © 2026

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, GuildChannelStore, GuildMemberStore, GuildRoleStore, GuildStore, Menu, SelectedGuildStore } from "@webpack/common";

function download(filename: string, data: string) {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function fetchAllMembers(guildId: string): Promise<any[]> {
    return new Promise(resolve => {
        const chunks: any[] = [];

        const handler = ({ guildId: id, members, chunkIndex, chunkCount }: any) => {
            if (id !== guildId) return;
            chunks.push(...members);
            if (chunkIndex + 1 >= chunkCount) {
                FluxDispatcher.unsubscribe("GUILD_MEMBERS_CHUNK", handler);
                resolve(chunks);
            }
        };

        FluxDispatcher.subscribe("GUILD_MEMBERS_CHUNK", handler);
        FluxDispatcher.dispatch({
            type: "GUILD_MEMBERS_REQUEST",
            guildIds: [guildId],
            limit: 1000,
            query: "",
        });

        setTimeout(() => {
            FluxDispatcher.unsubscribe("GUILD_MEMBERS_CHUNK", handler);
            resolve(chunks);
        }, 10_000);
    });
}

async function exportGuild(guildId: string) {
    const guild = GuildStore.getGuild(guildId);
    if (!guild) return;

    const channelData = GuildChannelStore.getChannels(guildId);
    const channels = Object.values(channelData)
        .flat()
        .filter((c: any) => c?.channel?.id)
        .map((c: any) => ({
            id: c.channel.id,
            name: c.channel.name,
            type: c.channel.type,
            parentId: c.channel.parentId ?? null,
            position: c.channel.position,
        }));

    const roles = Object.values(GuildRoleStore.getRolesSnapshot(guildId)).map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.colorString ?? null,
        position: r.position,
        permissions: r.permissions?.toString() ?? "0",
    }));

    const rawMembers = await fetchAllMembers(guildId);
    const members = rawMembers.map((m: any) => ({
        id: m.userId ?? m.user?.id,
        username: m.username ?? m.user?.username,
        nick: m.nick ?? null,
        roles: m.roles ?? [],
        joinedAt: m.joinedAt ?? null,
    }));

    const payload = {
        exportedAt: new Date().toISOString(),
        guild: {
            id: guild.id,
            name: guild.name,
            ownerId: guild.ownerId,
        },
        channels,
        roles,
        members,
    };

    download(`${guild.name}-export.json`, JSON.stringify(payload, null, 2));
}

const guildCtxPatch: NavContextMenuPatchCallback = (children, { guild }) => {
    if (!guild) return;
    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="nin-server-export"
                label="Export Server Data"
                action={() => exportGuild(guild.id)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "ServerExport",
    description: "Export a server's members, channels, and roles to a JSON file. Right-click the server icon to use.",
    authors: [Devs.medisiner],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "guild-context": guildCtxPatch,
    }
});
