// nin © 2026

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRouter, ChannelStore, GuildMemberStore, RelationshipStore, SelectedChannelStore, UserStore } from "@webpack/common";

interface VoiceStateChange {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    sessionId: string;
}

const settings = definePluginSettings({
    notifyForFriends: {
        type: OptionType.BOOLEAN,
        description: "Notify when friends join a voice channel",
        default: true,
    },
    notifyOnMoves: {
        type: OptionType.BOOLEAN,
        description: "Also notify when someone moves between voice channels (not just fresh joins)",
        default: false,
    },
    onlyWhenIdle: {
        type: OptionType.BOOLEAN,
        description: "Only notify when you're not already in a voice channel yourself",
        default: false,
    },
    watchedUsers: {
        type: OptionType.STRING,
        description: "Always notify for these user IDs regardless of friend status (comma separated)",
        default: "",
    },
});

function getWatchedIds(): Set<string> {
    const raw = settings.store.watchedUsers.trim();
    if (!raw) return new Set();
    return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

function shouldNotify(userId: string): boolean {
    if (getWatchedIds().has(userId)) return true;
    if (settings.store.notifyForFriends && RelationshipStore.isFriend(userId)) return true;
    return false;
}

function avatarUrl(userId: string, hash: string | null | undefined): string {
    if (hash) return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=80`;
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 6n)}.png`;
}

export default definePlugin({
    name: "VoiceNotify",
    description: "Get notified when friends or specific users join a voice channel",
    tags: ["Voice", "Notifications", "Utility"],
    authors: [Devs.medisiner],

    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChange[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            if (settings.store.onlyWhenIdle && SelectedChannelStore.getVoiceChannelId()) return;

            for (const { userId, channelId, oldChannelId } of voiceStates) {
                if (userId === myId) continue;
                if (!channelId) continue;
                if (oldChannelId && !settings.store.notifyOnMoves) continue;

                if (!shouldNotify(userId)) continue;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) continue;

                const user = UserStore.getUser(userId);
                if (!user) continue;

                const guildId = channel.guild_id;
                const nick = guildId ? GuildMemberStore.getNick(guildId, userId) : null;
                const displayName = nick ?? (user as any).globalName ?? user.username;

                const moved = !!oldChannelId;

                showNotification({
                    title: `${displayName} ${moved ? "moved to" : "joined"} voice`,
                    body: `#${channel.name}`,
                    icon: avatarUrl(userId, user.avatar),
                    onClick: () => ChannelRouter.transitionToChannel(channelId),
                });
            }
        }
    }
});
