// nin © 2026

import * as DataStore from "@api/DataStore";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalCloseButton } from "@utils/modal";
import definePlugin from "@utils/types";
import { FluxDispatcher, Forms, GuildMemberStore, IconUtils, Menu, React, UserStore } from "@webpack/common";

const STORE_KEY = "nin_AvatarHistory";

interface AvatarEntry {
    url: string;
    timestamp: number;
}

type AvatarStore = Record<string, AvatarEntry[]>;

let cache: AvatarStore = {};

async function load() {
    cache = await DataStore.get<AvatarStore>(STORE_KEY) ?? {};
}

async function save() {
    await DataStore.set(STORE_KEY, cache);
}

function recordAvatar(userId: string, url: string) {
    if (!url) return;
    const history = cache[userId] ?? [];
    if (history[0]?.url === url) return;
    history.unshift({ url, timestamp: Date.now() });
    if (history.length > 24) history.length = 24;
    cache[userId] = history;
    save();
}

function onUserUpdate({ user }: any) {
    if (!user?.id) return;
    const url = IconUtils.getUserAvatarURL(user, true, 256);
    recordAvatar(user.id, url);
}

function AvatarHistoryModal({ userId, modalProps }: { userId: string; modalProps: any; }) {
    const history = cache[userId] ?? [];
    const user = UserStore.getUser(userId);

    return (
        <ModalRoot {...modalProps} size="large">
            <ModalHeader>
                <Forms.FormTitle tag="h2" style={{ margin: 0 }}>
                    Avatar History — {user?.username ?? userId}
                </Forms.FormTitle>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "16px" }}>
                {history.length === 0 ? (
                    <Forms.FormText style={{ color: "var(--text-muted)" }}>
                        No avatar history recorded yet. History is captured as avatars change while nin is running.
                    </Forms.FormText>
                ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {history.map((entry, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                <a href={entry.url} target="_blank" rel="noreferrer">
                                    <img
                                        src={entry.url}
                                        alt="avatar"
                                        style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
                                    />
                                </a>
                                <Forms.FormText style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                </Forms.FormText>
                            </div>
                        ))}
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

const userCtxPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user) return;
    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="nin-avatar-history"
                label="Avatar History"
                action={() => openModal(props => <AvatarHistoryModal userId={user.id} modalProps={props} />)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "AvatarHistory",
    description: "Records avatar changes for users and lets you view their history. Right-click a user to view.",
    authors: [Devs.medisiner],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "user-context": userCtxPatch,
    },

    async start() {
        await load();

        const me = UserStore.getCurrentUser();
        if (me) recordAvatar(me.id, IconUtils.getUserAvatarURL(me, true, 256));

        FluxDispatcher.subscribe("USER_UPDATE", onUserUpdate);
    },

    stop() {
        FluxDispatcher.unsubscribe("USER_UPDATE", onUserUpdate);
    }
});
