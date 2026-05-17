// nin © 2026

import * as DataStore from "@api/DataStore";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import { openModal, ModalRoot, ModalContent, ModalFooter, ModalCloseButton } from "@utils/modal";
import definePlugin from "@utils/types";
import { ChannelStore, Forms, GuildStore, Menu, NavigationRouter, React, Timestamp, useEffect, useState } from "@webpack/common";

const STORE_KEY = "nin_SavedMessages";

interface SavedMessage {
    id: string;
    channelId: string;
    guildId: string | null;
    authorName: string;
    authorId: string;
    authorAvatar?: string;
    content: string;
    savedAt: number;
}

function buildAvatarUrl(userId: string, avatarHash: string | null | undefined): string {
    if (avatarHash) return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=80`;
    const idx = Number(BigInt(userId) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

async function getSaved(): Promise<SavedMessage[]> {
    return await DataStore.get(STORE_KEY) ?? [];
}

async function saveMessage(msg: SavedMessage) {
    const saved = await getSaved();
    if (saved.find(m => m.id === msg.id)) return;
    await DataStore.set(STORE_KEY, [msg, ...saved]);
}

async function unsaveMessage(id: string) {
    const saved = await getSaved();
    await DataStore.set(STORE_KEY, saved.filter(m => m.id !== id));
}

async function isSaved(id: string): Promise<boolean> {
    const saved = await getSaved();
    return saved.some(m => m.id === id);
}

function BookmarkIcon({ height = 16, width = 16, filled = false, ...rest }: { height?: number | string; width?: number | string; className?: string; filled?: boolean; [k: string]: any; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function getLocation(msg: SavedMessage) {
    const channel = ChannelStore?.getChannel(msg.channelId);
    const guild = msg.guildId ? GuildStore?.getGuild(msg.guildId) : null;
    if (guild && channel) return `${guild.name} · #${(channel as any).name}`;
    if ((channel as any)?.name) return `#${(channel as any).name}`;
    return "Direct Message";
}

function SavedMessagesModal({ modalProps }: { modalProps: any; }) {
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [query, setQuery] = useState("");
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => { getSaved().then(setMessages); }, []);

    async function remove(id: string) {
        await unsaveMessage(id);
        setMessages(prev => prev.filter(m => m.id !== id));
    }

    function copy(content: string, id: string) {
        navigator.clipboard.writeText(content);
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
    }

    const filtered = query.trim()
        ? messages.filter(m =>
            m.content.toLowerCase().includes(query.toLowerCase()) ||
            m.authorName.toLowerCase().includes(query.toLowerCase())
        )
        : messages;

    return (
        <ModalRoot {...modalProps} size="large">
            <div style={{
                padding: "20px 20px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: "40px", height: "40px", borderRadius: "12px",
                        background: "linear-gradient(135deg, #5865f2, #7983f5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <BookmarkIcon filled width={20} height={20} style={{ color: "#fff" }} />
                    </div>
                    <div>
                        <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                            Saved Messages
                        </div>
                        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
                            {messages.length} saved · right-click any message to add
                        </div>
                    </div>
                </div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </div>

            <div style={{ padding: "12px 16px 0" }}>
                <input
                    type="text"
                    placeholder="Search by content or author…"
                    value={query}
                    onChange={e => setQuery((e.target as HTMLInputElement).value)}
                    style={{
                        width: "100%",
                        padding: "9px 14px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        color: "#dcddde",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                    } as any}
                />
            </div>

            <ModalContent>
                <div style={{ padding: "8px 0 16px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                            <div style={{
                                width: "56px", height: "56px", borderRadius: "16px",
                                background: "rgba(88,101,242,0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <BookmarkIcon width={28} height={28} style={{ color: "rgba(88,101,242,0.6)" }} />
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>
                                    {query ? "No results" : "Nothing saved yet"}
                                </div>
                                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                                    {query ? "Try a different search term." : "Right-click any message and choose Save Message."}
                                </div>
                            </div>
                        </div>
                    ) : filtered.map(msg => (
                        <div key={msg.id} style={{
                            display: "flex",
                            gap: "14px",
                            padding: "12px 16px",
                            marginBottom: "1px",
                            borderRadius: "4px",
                            borderLeft: "3px solid transparent",
                            transition: "background 0.08s, border-color 0.08s",
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                e.currentTarget.style.borderLeftColor = "#5865f2";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderLeftColor = "transparent";
                            }}
                        >
                            <div style={{
                                flexShrink: 0,
                                width: "40px",
                                height: "40px",
                                minWidth: "40px",
                                minHeight: "40px",
                                borderRadius: "50%",
                                backgroundImage: `url("${msg.authorAvatar ?? buildAvatarUrl(msg.authorId, null)}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundColor: "rgba(255,255,255,0.15)",
                            }} />

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "3px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                                        {msg.authorName}
                                    </span>
                                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                                        <Timestamp timestamp={new Date(msg.savedAt)} />
                                    </span>
                                    <span style={{
                                        fontSize: "11px",
                                        color: "rgba(88,101,242,0.9)",
                                        background: "rgba(88,101,242,0.12)",
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        lineHeight: "1.5",
                                    }}>
                                        {getLocation(msg)}
                                    </span>
                                </div>

                                <div style={{
                                    fontSize: "14px",
                                    lineHeight: "1.4",
                                    color: "rgba(255,255,255,0.78)",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}>
                                    {msg.content || <em style={{ color: "rgba(255,255,255,0.3)" }}>No text content</em>}
                                </div>

                                <div style={{ display: "flex", gap: "14px", marginTop: "7px", alignItems: "center" }}>
                                    {msg.content && (
                                        <span
                                            role="button"
                                            style={{ fontSize: "12px", color: copied === msg.id ? "#3ba55c" : "rgba(255,255,255,0.4)", cursor: "pointer" } as any}
                                            onClick={() => copy(msg.content, msg.id)}
                                        >
                                            {copied === msg.id ? "✓ Copied" : "Copy"}
                                        </span>
                                    )}
                                    <span
                                        role="button"
                                        style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", cursor: "pointer" } as any}
                                        onClick={() => {
                                            modalProps.onClose();
                                            NavigationRouter.transitionTo(`/channels/${msg.guildId ?? "@me"}/${msg.channelId}/${msg.id}`);
                                        }}
                                    >
                                        Jump to message
                                    </span>
                                    <span
                                        role="button"
                                        style={{ fontSize: "12px", color: "rgba(237,66,69,0.7)", cursor: "pointer", marginLeft: "auto" } as any}
                                        onClick={() => remove(msg.id)}
                                    >
                                        Remove
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ModalContent>

            <ModalFooter>
                <Forms.FormText style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
                    {filtered.length}{query ? ` of ${messages.length}` : ""} saved message{filtered.length !== 1 ? "s" : ""}
                </Forms.FormText>
            </ModalFooter>
        </ModalRoot>
    );
}

export function openSavedMessagesModal() {
    openModal(props => <SavedMessagesModal modalProps={props} />);
}

const contextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const message = props?.message;
    if (!message) return;

    const group = findGroupChildrenByChildId("copy-text", children) ?? children;
    const realItem = (group as any[]).find((c: any) => c?.props?.id === "copy-text") as any;
    const ItemType = realItem?.type ?? Menu.MenuItem;

    let label = "Save Message";
    getSaved().then(saved => {
        label = saved.some(m => m.id === message.id) ? "Unsave Message" : "Save Message";
    });

    group.push(
        React.createElement(ItemType, {
            id: "nin-save-message",
            key: "nin-save-message",
            label,
            action: async () => {
                const saved = await isSaved(message.id);
                if (saved) {
                    await unsaveMessage(message.id);
                } else {
                    await saveMessage({
                        id: message.id,
                        channelId: message.channel_id,
                        guildId: message.guild_id ?? null,
                        authorName: message.author.global_name || message.author.username,
                        authorId: message.author.id,
                        authorAvatar: buildAvatarUrl(message.author.id, message.author.avatar),
                        content: message.content,
                        savedAt: Date.now()
                    });
                }
            }
        })
    );
};

export default definePlugin({
    name: "SavedMessages",
    description: "Save any message for later — like Telegram's Saved Messages. Hover or right-click any message to save it.",
    authors: [Devs.medisiner],

    contextMenus: {
        "message": contextMenuPatch
    },

    messagePopoverButton: {
        icon: BookmarkIcon,
        render: (msg: any) => ({
            label: "Save Message",
            icon: BookmarkIcon,
            message: msg,
            channel: ChannelStore?.getChannel(msg.channel_id),
            onClick: async () => {
                const saved = await isSaved(msg.id);
                if (saved) {
                    await unsaveMessage(msg.id);
                } else {
                    await saveMessage({
                        id: msg.id,
                        channelId: msg.channel_id,
                        guildId: msg.guild_id ?? null,
                        authorName: msg.author.global_name || msg.author.username,
                        authorId: msg.author.id,
                        authorAvatar: buildAvatarUrl(msg.author.id, msg.author.avatar),
                        content: msg.content,
                        savedAt: Date.now()
                    });
                }
            }
        })
    }
});
