// nin © 2026

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalFooter, ModalCloseButton } from "@utils/modal";
import definePlugin from "@utils/types";
import { Button, Constants, Forms, Menu, React, RestAPI, Toasts, UserStore, useState } from "@webpack/common";

async function fetchOwnMessages(channelId: string, onProgress: (found: number, total: number) => void): Promise<string[]> {
    const me = UserStore.getCurrentUser().id;
    const ids: string[] = [];
    let before: string | undefined;
    let total = 0;

    while (true) {
        const url = before
            ? `/channels/${channelId}/messages?limit=100&before=${before}`
            : `/channels/${channelId}/messages?limit=100`;

        const res = await RestAPI.get({ url });
        const batch: any[] = res.body;
        if (!batch?.length) break;

        for (const msg of batch) {
            if (msg.author.id === me) ids.push(msg.id);
        }

        total += batch.length;
        onProgress(ids.length, total);
        before = batch[batch.length - 1].id;

        if (batch.length < 100) break;
        await new Promise(r => setTimeout(r, 300));
    }

    return ids;
}

async function deleteMessages(channelId: string, ids: string[], onProgress: (done: number, total: number) => void) {
    for (let i = 0; i < ids.length; i++) {
        try {
            await RestAPI.del({ url: `/channels/${channelId}/messages/${ids[i]}` });
        } catch { }
        onProgress(i + 1, ids.length);
        await new Promise(r => setTimeout(r, 1100));
    }
}

function BulkDeleteModal({ channelId, modalProps }: { channelId: string; modalProps: any; }) {
    const [phase, setPhase] = useState<"idle" | "scanning" | "confirm" | "deleting" | "done">("idle");
    const [ids, setIds] = useState<string[]>([]);
    const [scanned, setScanned] = useState(0);
    const [progress, setProgress] = useState(0);

    async function scan() {
        setPhase("scanning");
        setScanned(0);
        const found = await fetchOwnMessages(channelId, (found, total) => {
            setIds(prev => [...prev]);
            setScanned(total);
        });
        setIds(found);
        setPhase("confirm");
    }

    async function run() {
        setPhase("deleting");
        await deleteMessages(channelId, ids, (done, total) => setProgress(done / total * 100));
        setPhase("done");
        Toasts.show({ message: `Deleted ${ids.length} messages`, type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    }

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <Forms.FormTitle tag="h2" style={{ color: "#fff", margin: 0 }}>Bulk Delete</Forms.FormTitle>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "16px" }}>
                {phase === "idle" && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.7)" }}>
                        This will scan the channel and delete all messages you sent. This cannot be undone.
                    </Forms.FormText>
                )}
                {phase === "scanning" && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.7)" }}>
                        Scanning... {scanned} messages checked
                    </Forms.FormText>
                )}
                {phase === "confirm" && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.7)" }}>
                        Found {ids.length} of your messages. Delete all of them?
                    </Forms.FormText>
                )}
                {phase === "deleting" && (
                    <div>
                        <Forms.FormText style={{ color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
                            Deleting... {Math.round(progress)}%
                        </Forms.FormText>
                        <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${progress}%`, background: "#5865f2", borderRadius: "2px", transition: "width 0.3s" }} />
                        </div>
                    </div>
                )}
                {phase === "done" && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.7)" }}>
                        Done. {ids.length} messages deleted.
                    </Forms.FormText>
                )}
            </ModalContent>
            <ModalFooter>
                {phase === "idle" && (
                    <Button onClick={scan} color={Button.Colors.BRAND}>Scan channel</Button>
                )}
                {phase === "confirm" && ids.length > 0 && (
                    <Button onClick={run} color={Button.Colors.RED}>Delete {ids.length} messages</Button>
                )}
                {phase === "confirm" && ids.length === 0 && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.5)" }}>No messages found.</Forms.FormText>
                )}
            </ModalFooter>
        </ModalRoot>
    );
}

const channelCtxPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel?.id) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    const realItem = (group as any[]).find((c: any) => c?.props?.id === "mark-channel-read") as any;
    const ItemType = realItem?.type ?? Menu.MenuItem;

    group.push(
        <ItemType
            id="nin-bulk-delete"
            label="Bulk Delete My Messages"
            action={() => openModal(props => <BulkDeleteModal channelId={channel.id} modalProps={props} />)}
        />
    );
};

export default definePlugin({
    name: "BulkDelete",
    description: "Delete all your messages in a channel at once. Right-click any channel to use.",
    authors: [Devs.medisiner],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "channel-context": channelCtxPatch,
        "gdm-context": channelCtxPatch,
        "user-context": channelCtxPatch,
    }
});
