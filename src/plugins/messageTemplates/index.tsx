// nin © 2026

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalCloseButton } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Forms, React, useState } from "@webpack/common";

interface Template {
    id: string;
    name: string;
    content: string;
}

const settings = definePluginSettings({
    templates: {
        type: OptionType.CUSTOM,
        default: [] as Template[],
    },
    editor: {
        type: OptionType.COMPONENT,
        description: "Manage your message templates",
        component: () => <TemplateEditor />,
    }
});

function TemplateEditor() {
    const [templates, setTemplates] = useState<Template[]>(settings.store.templates ?? []);
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [editing, setEditing] = useState<string | null>(null);

    function save() {
        if (!name.trim() || !content.trim()) return;
        const next = editing
            ? templates.map(t => t.id === editing ? { ...t, name: name.trim(), content } : t)
            : [...templates, { id: crypto.randomUUID(), name: name.trim(), content }];
        setTemplates(next);
        settings.store.templates = next;
        setName("");
        setContent("");
        setEditing(null);
    }

    function remove(id: string) {
        const next = templates.filter(t => t.id !== id);
        setTemplates(next);
        settings.store.templates = next;
    }

    function startEdit(t: Template) {
        setEditing(t.id);
        setName(t.name);
        setContent(t.content);
    }

    function cancel() {
        setEditing(null);
        setName("");
        setContent("");
    }

    const inputStyle: React.CSSProperties = {
        width: "100%",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "6px",
        color: "#fff",
        padding: "8px",
        fontSize: "14px",
        outline: "none",
        fontFamily: "inherit",
        boxSizing: "border-box",
        marginBottom: "8px",
    };

    return (
        <div>
            <Forms.FormText style={{ color: "rgba(255,255,255,0.5)", marginBottom: "12px" }}>
                Templates are inserted into the chat box when selected. Use the toolbar button to pick one.
            </Forms.FormText>

            {templates.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                    {templates.map(t => (
                        <div key={t.id} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "8px 10px", borderRadius: "6px",
                            background: "rgba(255,255,255,0.04)", marginBottom: "6px",
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{t.name}</div>
                                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.content}</div>
                            </div>
                            <button onClick={() => startEdit(t)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: "2px 6px" }}>edit</button>
                            <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "rgba(220,80,80,0.7)", cursor: "pointer", fontSize: "12px", padding: "2px 6px" }}>✕</button>
                        </div>
                    ))}
                </div>
            )}

            <Forms.FormText style={{ color: "rgba(255,255,255,0.6)", marginBottom: "8px", fontSize: "13px" }}>
                {editing ? "Editing template" : "New template"}
            </Forms.FormText>
            <input
                value={name}
                onChange={e => setName(e.currentTarget.value)}
                placeholder="Template name"
                style={inputStyle}
            />
            <textarea
                value={content}
                rows={4}
                onChange={e => setContent(e.currentTarget.value)}
                placeholder="Template content…"
                style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
                <button
                    onClick={save}
                    disabled={!name.trim() || !content.trim()}
                    style={{
                        background: "#5865f2", border: "none", borderRadius: "4px",
                        color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: "13px",
                        opacity: (!name.trim() || !content.trim()) ? 0.4 : 1,
                    }}
                >
                    {editing ? "Save changes" : "Add template"}
                </button>
                {editing && (
                    <button onClick={cancel} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "rgba(255,255,255,0.6)", padding: "6px 14px", cursor: "pointer", fontSize: "13px" }}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

function TemplatePicker({ onPick }: { onPick: (t: Template) => void; }) {
    const templates: Template[] = settings.store.templates ?? [];
    const [search, setSearch] = useState("");

    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                placeholder="Search templates…"
                style={{
                    width: "100%", background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px",
                    color: "#fff", padding: "8px", fontSize: "14px",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    marginBottom: "12px",
                }}
            />
            {filtered.length === 0 && (
                <Forms.FormText style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "16px 0" }}>
                    {templates.length === 0 ? "No templates yet. Add some in plugin settings." : "No matches."}
                </Forms.FormText>
            )}
            {filtered.map(t => (
                <div
                    key={t.id}
                    onClick={() => onPick(t)}
                    style={{
                        padding: "10px 12px", borderRadius: "6px", cursor: "pointer",
                        marginBottom: "4px", background: "rgba(255,255,255,0.04)",
                        transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(88,101,242,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                >
                    <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{t.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.content}</div>
                </div>
            ))}
        </div>
    );
}

const TemplatesIcon: React.FC<{ width?: number; height?: number; className?: string; }> = ({ width = 20, height = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="11" height="4" rx="1" />
        <rect x="3" y="17" width="7" height="4" rx="1" />
    </svg>
);

const TemplatesButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Message Templates"
            onClick={() => {
                openModal(modalProps => (
                    <ModalRoot {...modalProps}>
                        <ModalHeader>
                            <Forms.FormTitle tag="h2" style={{ color: "#fff", margin: 0 }}>Templates</Forms.FormTitle>
                            <ModalCloseButton onClick={modalProps.onClose} />
                        </ModalHeader>
                        <ModalContent style={{ padding: "16px" }}>
                            <TemplatePicker onPick={t => {
                                insertTextIntoChatInputBox(t.content);
                                modalProps.onClose();
                            }} />
                        </ModalContent>
                    </ModalRoot>
                ));
            }}
        >
            <TemplatesIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessageTemplates",
    description: "Save reusable message snippets and insert them into the chat box. Manage templates in plugin settings.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["ChatButtonsAPI"],

    chatBarButton: {
        icon: TemplatesIcon,
        render: TemplatesButton,
    }
});
