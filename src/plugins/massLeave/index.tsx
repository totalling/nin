// nin © 2026

import { Devs } from "@utils/constants";
import { findByPropsLazy } from "@webpack";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalFooter, ModalCloseButton } from "@utils/modal";
import definePlugin from "@utils/types";
import { Button, Forms, GuildStore, IconUtils, Menu, React, Toasts, UserStore, useState } from "@webpack/common";

const GuildActions = findByPropsLazy("leaveGuild");

function GuildRow({ guild, checked, onToggle }: { guild: any; checked: boolean; onToggle: () => void; }) {
    const iconUrl = guild.icon
        ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 })
        : null;

    return (
        <div
            onClick={onToggle}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                background: checked ? "rgba(88,101,242,0.15)" : "transparent",
                transition: "background 0.15s",
            }}
        >
            <div style={{
                width: "16px", height: "16px", borderRadius: "3px", flexShrink: 0,
                border: `2px solid ${checked ? "#5865f2" : "rgba(255,255,255,0.3)"}`,
                background: checked ? "#5865f2" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
            }}>
                {checked && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>}
            </div>
            {iconUrl
                ? <img src={iconUrl} style={{ width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0 }} alt="" />
                : <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                    {guild.name?.[0]?.toUpperCase()}
                </div>
            }
            <span style={{ color: "#fff", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{guild.name}</span>
        </div>
    );
}

function MassLeaveModal({ modalProps }: { modalProps: any; }) {
    const meId = UserStore.getCurrentUser().id;
    const allGuilds = Object.values(GuildStore.getGuilds()) as any[];
    const notOwned = allGuilds.filter(g => g.ownerId !== meId);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [leaving, setLeaving] = useState(false);
    const [done, setDone] = useState(false);

    function toggle(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleAll() {
        if (selected.size === notOwned.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(notOwned.map(g => g.id)));
        }
    }

    async function leave() {
        setLeaving(true);
        for (const id of selected) {
            try { await GuildActions.leaveGuild(id); } catch { }
            await new Promise(r => setTimeout(r, 500));
        }
        setLeaving(false);
        setDone(true);
        Toasts.show({ message: `Left ${selected.size} servers`, type: Toasts.Type.SUCCESS, id: Toasts.genId() });
        modalProps.onClose();
    }

    const sorted = [...notOwned].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <ModalRoot {...modalProps} size="MEDIUM">
            <ModalHeader>
                <Forms.FormTitle tag="h2" style={{ color: "#fff", margin: 0 }}>Mass Leave</Forms.FormTitle>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "8px 0", maxHeight: "420px", overflowY: "auto" }}>
                <div
                    onClick={toggleAll}
                    style={{ padding: "8px 12px", color: "rgba(255,255,255,0.45)", fontSize: "12px", cursor: "pointer", userSelect: "none" }}
                >
                    {selected.size === notOwned.length ? "Deselect all" : "Select all"} — {notOwned.length} servers (excluding owned)
                </div>
                {sorted.map(g => (
                    <GuildRow
                        key={g.id}
                        guild={g}
                        checked={selected.has(g.id)}
                        onToggle={() => toggle(g.id)}
                    />
                ))}
            </ModalContent>
            <ModalFooter>
                {selected.size > 0 && !leaving && (
                    <Button onClick={leave} color={Button.Colors.RED}>
                        Leave {selected.size} server{selected.size !== 1 ? "s" : ""}
                    </Button>
                )}
                {leaving && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.5)" }}>Leaving…</Forms.FormText>
                )}
                {selected.size === 0 && !leaving && (
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.3)" }}>Select servers to leave</Forms.FormText>
                )}
            </ModalFooter>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "MassLeave",
    description: "Leave multiple servers at once from a checklist. Servers you own are excluded.",
    authors: [Devs.medisiner],

    toolboxActions: {
        "Mass Leave Servers"() {
            openModal(props => <MassLeaveModal modalProps={props} />);
        }
    }
});
