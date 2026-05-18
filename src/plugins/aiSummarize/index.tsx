// nin © 2026

import { definePluginSettings } from "@api/Settings";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ErrorCard } from "@components/ErrorCard";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalFooter, ModalCloseButton } from "@utils/modal";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Button } from "@components/Button";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ChannelStore, Menu, MessageStore, React } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AISummarize as PluginNative<typeof import("./native")>;

const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "Groq API key (free at console.groq.com)",
        placeholder: "gsk_...",
        default: "",
    },
    model: {
        type: OptionType.SELECT,
        description: "Model to use",
        options: [
            { label: "Llama 3.1 8B (fastest)", value: "llama-3.1-8b-instant", default: true },
            { label: "Llama 3.3 70B (smarter)", value: "llama-3.3-70b-versatile" },
            { label: "Mixtral 8x7B", value: "mixtral-8x7b-32768" },
        ],
    },
    messageCount: {
        type: OptionType.SLIDER,
        description: "Number of messages to summarize",
        markers: [10, 25, 50, 100],
        default: 25,
        stickToMarkers: true,
    },
});

async function summarize(messages: string): Promise<string> {
    const key = settings.store.apiKey?.trim();
    if (!key) throw new Error("No Groq API key set. Get one free at console.groq.com");

    const body = JSON.stringify({
        model: settings.store.model ?? "llama-3.1-8b-instant",
        messages: [
            {
                role: "system",
                content: "You are a concise chat summarizer. Summarize the conversation in 3-5 bullet points. Be brief and factual. No preamble.",
            },
            {
                role: "user",
                content: `Summarize this Discord conversation:\n\n${messages}`,
            },
        ],
        max_tokens: 512,
        temperature: 0.4,
    });

    const { status, data } = await Native.callGroq(key, settings.store.model ?? "llama-3.1-8b-instant", body);

    if (status !== 200) {
        const err = JSON.parse(data).catch?.(() => ({}));
        throw new Error(err?.error?.message ?? `Groq API error ${status}: ${data}`);
    }

    return JSON.parse(data).choices[0].message.content.trim();
}

function SummaryModal({ channelId, modalProps }: { channelId: string; modalProps: any; }) {
    const [phase, setPhase] = React.useState<"idle" | "loading" | "done" | "error">("idle");
    const [summary, setSummary] = React.useState("");
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        run();
    }, []);

    async function run() {
        setPhase("loading");
        try {
            const msgs: any[] = MessageStore.getMessages(channelId)?.toArray?.() ?? [];
            const recent = msgs.slice(-Math.min(msgs.length, settings.store.messageCount ?? 25));

            if (recent.length === 0) {
                throw new Error("No messages loaded in this channel yet. Scroll up to load some.");
            }

            const formatted = recent
                .filter(m => m.content?.trim())
                .map(m => `${m.author.username}: ${m.content}`)
                .join("\n");

            const result = await summarize(formatted);
            setSummary(result);
            setPhase("done");
        } catch (e: any) {
            setError(e.message ?? String(e));
            setPhase("error");
        }
    }

    const channel = ChannelStore.getChannel(channelId);

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <HeadingSecondary style={{ margin: 0 }}>
                    Summary — #{channel?.name ?? channelId}
                </HeadingSecondary>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "16px" }}>
                {phase === "loading" && (
                    <Paragraph style={{ color: "var(--text-muted)" }}>Summarizing...</Paragraph>
                )}
                {phase === "error" && (
                    <ErrorCard className={Margins.bottom8}>
                        <Paragraph>{error}</Paragraph>
                    </ErrorCard>
                )}
                {phase === "done" && (
                    <Paragraph style={{ whiteSpace: "pre-wrap", color: "var(--text-normal)", lineHeight: 1.6 }}>
                        {summary}
                    </Paragraph>
                )}
            </ModalContent>
            {(phase === "error" || phase === "done") && (
                <ModalFooter>
                    <Button variant="primary" onClick={run}>Summarize Again</Button>
                </ModalFooter>
            )}
        </ModalRoot>
    );
}

const channelCtxPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel?.id) return;
    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;

    group.push(
        <Menu.MenuItem
            id="nin-ai-summarize"
            label="Summarize with AI"
            action={() => openModal(props => <SummaryModal channelId={channel.id} modalProps={props} />)}
        />
    );
};

export default definePlugin({
    name: "AISummarize",
    description: "Summarize recent messages in a channel using Groq (free). Right-click any channel to use. Get a free API key at console.groq.com.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["ContextMenuAPI"],

    settingsAboutComponent: () => (
        <ErrorCard className={Margins.bottom8} style={{ padding: "10px 14px" }}>
            <b style={{ fontSize: "13px" }}>Setup</b>
            <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                1. Go to <strong>console.groq.com</strong> and create a free account<br />
                2. Create an API key<br />
                3. Paste it in the field above
            </p>
        </ErrorCard>
    ),

    contextMenus: {
        "channel-context": channelCtxPatch,
        "gdm-context": channelCtxPatch,
    }
});
