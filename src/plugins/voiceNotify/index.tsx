// nin © 2026

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRouter, ChannelStore, GuildMemberStore, GuildStore, RelationshipStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

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

const knownChannels = new Map<string, string | null>();

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

    start() {
        knownChannels.clear();
        for (const guildId of Object.keys(GuildStore.getGuilds())) {
            const states = VoiceStateStore.getVoiceStates(guildId) as Record<string, { channelId?: string; }>;
            for (const [userId, state] of Object.entries(states)) {
                knownChannels.set(userId, state.channelId ?? null);
            }
        }
    },

    stop() {
        knownChannels.clear();
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChange[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            if (settings.store.onlyWhenIdle && SelectedChannelStore.getVoiceChannelId()) return;

            for (const { userId, channelId } of voiceStates) {
                if (userId === myId) continue;

                const previousChannel = knownChannels.get(userId);

                knownChannels.set(userId, channelId ?? null);

                if (previousChannel === undefined) continue;

                if (!channelId) continue;

                const sameChannel = previousChannel === channelId;
                if (sameChannel) continue;

                const isMove = !!previousChannel && !sameChannel;
                if (isMove && !settings.store.notifyOnMoves) continue;

                if (!shouldNotify(userId)) continue;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) continue;

                const user = UserStore.getUser(userId);
                if (!user) continue;

                const guildId = channel.guild_id;
                const guild = guildId ? GuildStore.getGuild(guildId) : null;
                const nick = guildId ? GuildMemberStore.getNick(guildId, userId) : null;
                const displayName = nick ?? (user as any).globalName ?? user.username;

                const action = isMove ? "moved to" : "joined";
                const location = guild
                    ? `${guild.name}  ›  #${channel.name}`
                    : `#${channel.name}`;

                showNotification({
                    title: `${displayName} ${action} voice`,
                    body: location,
                    icon: avatarUrl(userId, user.avatar),
                    onClick: () => ChannelRouter.transitionToChannel(channelId),
                });
            }
        }
    }
});
