// nin © 2026

import * as DataStore from "@api/DataStore";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu, Toasts, UserStore } from "@webpack/common";

const STORE_KEY = "nin_HiddenUsers";

let hiddenUsers = new Set<string>();

async function load() {
    const stored = await DataStore.get<string[]>(STORE_KEY) ?? [];
    hiddenUsers = new Set(stored);
}

async function save() {
    await DataStore.set(STORE_KEY, [...hiddenUsers]);
}

function hideUser(userId: string) {
    hiddenUsers.add(userId);
    save();
    Toasts.show({ message: "User's messages hidden", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
}

function unhideUser(userId: string) {
    hiddenUsers.delete(userId);
    save();
    Toasts.show({ message: "User's messages visible again", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
}

const msgCtxPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (!message) return;
    const authorId = message.author.id;
    if (authorId === UserStore.getCurrentUser().id) return;

    const group = findGroupChildrenByChildId("mark-unread", children) ?? children;
    const isHidden = hiddenUsers.has(authorId);

    group.push(
        <Menu.MenuItem
            id="nin-hide-user-messages"
            label={isHidden ? "Unhide User's Messages" : "Hide User's Messages"}
            action={() => isHidden ? unhideUser(authorId) : hideUser(authorId)}
        />
    );
};

const userCtxPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user || user.id === UserStore.getCurrentUser().id) return;
    const isHidden = hiddenUsers.has(user.id);

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="nin-hide-user-messages-profile"
                label={isHidden ? "Unhide Messages" : "Hide Messages"}
                action={() => isHidden ? unhideUser(user.id) : hideUser(user.id)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "MessageHider",
    description: "Hide messages from specific users locally without blocking them. Right-click a message or user to hide.",
    authors: [Devs.medisiner],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "message": msgCtxPatch,
        "user-context": userCtxPatch,
    },

    patches: [
        {
            find: "renderSingleMessage",
            replacement: {
                match: /(?<=(\i)\.renderSingleMessage\b[^}]+?\b(message)\b.{0,200}?key=)/,
                replace: "$self.shouldHide($2)?null:$&",
            }
        }
    ],

    async start() {
        await load();
    },

    shouldHide(message: any): boolean {
        return hiddenUsers.has(message?.author?.id);
    }
});
