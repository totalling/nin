// nin © 2026

import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Forms, React, useState } from "@webpack/common";

const settings = definePluginSettings({
    words: {
        type: OptionType.CUSTOM,
        default: "",
    },
    wordsInput: {
        type: OptionType.COMPONENT,
        description: "Words or phrases to veil, one per line",
        component: () => {
            const [val, setVal] = useState<string>(settings.store.words ?? "");
            return (
                <div>
                    <Forms.FormText style={{ color: "rgba(255,255,255,0.5)", marginBottom: "8px" }}>
                        One word or phrase per line. Messages containing any of these will be blurred.
                    </Forms.FormText>
                    <textarea
                        value={val}
                        rows={6}
                        onChange={e => {
                            setVal(e.currentTarget.value);
                            settings.store.words = e.currentTarget.value;
                        }}
                        style={{
                            width: "100%",
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "6px",
                            color: "#fff",
                            padding: "8px",
                            fontSize: "14px",
                            resize: "vertical",
                            outline: "none",
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                        }}
                        placeholder={"slur\nbad phrase\nanother word"}
                        spellCheck={false}
                    />
                </div>
            );
        }
    }
});

function getWords(): string[] {
    return (settings.store.words ?? "")
        .split("\n")
        .map((w: string) => w.trim().toLowerCase())
        .filter(Boolean);
}

function matchedWord(content: string): string | null {
    const lower = content.toLowerCase();
    for (const word of getWords()) {
        if (lower.includes(word)) return word;
    }
    return null;
}

const CSS = `
.nin-veiled [class*="markup"] {
    filter: blur(6px);
    user-select: none;
    transition: filter 0.2s ease;
    cursor: pointer;
}
.nin-veiled:hover [class*="markup"] {
    filter: none;
    user-select: text;
}
`;

let styleEl: HTMLStyleElement | null = null;

function VeilLabel({ word }: { word: string; }) {
    return (
        <div style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.35)",
            marginTop: "2px",
            fontStyle: "italic",
            userSelect: "none",
        }}>
            veiled · matched: <span style={{ color: "rgba(255,255,255,0.55)" }}>{word}</span>
        </div>
    );
}

export default definePlugin({
    name: "WordVeil",
    description: "Blurs messages containing words you define. Hover to reveal. Shows which word triggered it below.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["MessageAccessoriesAPI"],

    patches: [
        {
            find: "Message must not be a thread starter message",
            replacement: {
                match: /\)\("li",\{(.+?),className:(\i)/,
                replace: ")(\"li\",{$1,className:($self.getClass(arguments[0]?.message)+\" \")+$2"
            }
        }
    ],

    getClass(message: any): string {
        if (!message?.content) return "";
        return matchedWord(message.content) ? "nin-veiled" : "";
    },

    start() {
        styleEl = document.createElement("style");
        styleEl.textContent = CSS;
        document.head.appendChild(styleEl);
        addMessageAccessory("nin-veil-label", props => {
            const word = matchedWord(props.message?.content ?? "");
            if (!word) return null;
            return <VeilLabel word={word} />;
        });
    },

    stop() {
        styleEl?.remove();
        styleEl = null;
        removeMessageAccessory("nin-veil-label");
    }
});
