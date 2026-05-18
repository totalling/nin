// nin © 2026

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Button } from "@components/Button";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { openModal, ModalRoot, ModalContent, ModalHeader, ModalFooter, ModalCloseButton } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { MediaEngineStore, Menu, React, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

const settings = definePluginSettings({
    echoCancellation: {
        type: OptionType.BOOLEAN,
        description: "Echo cancellation (mic mode)",
        default: true,
    },
    noiseSuppression: {
        type: OptionType.BOOLEAN,
        description: "Noise suppression (mic mode)",
        default: true,
    },
});

type RecordMode = "mic" | "vc";

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

function pickMimeType() {
    for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
}

function startRecording(stream: MediaStream, onStop: (blob: Blob) => void) {
    chunks = [];
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => onStop(new Blob(chunks, { type: mimeType || "audio/webm" }));
    mediaRecorder.start(500);
}

function stopRecording() {
    mediaRecorder?.stop();
    mediaRecorder = null;
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function getMicStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: MediaEngineStore.getInputDeviceId(),
            echoCancellation: settings.store.echoCancellation,
            noiseSuppression: settings.store.noiseSuppression,
        },
    });
}

async function getVCStream(): Promise<MediaStream> {
    const display = await (navigator.mediaDevices as any).getDisplayMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 48000,
        },
        video: { width: 1, height: 1, frameRate: 1 },
    }) as MediaStream;

    display.getVideoTracks().forEach(t => t.stop());

    const audioTracks = display.getAudioTracks();
    if (!audioTracks.length) {
        display.getTracks().forEach(t => t.stop());
        throw new Error("No audio track captured. On macOS, enable Screen Recording in System Preferences. On Windows, make sure to check 'Share system audio' in the picker.");
    }

    return new MediaStream(audioTracks);
}

function RecorderModal({ modalProps }: { modalProps: any; }) {
    const [mode, setMode] = React.useState<RecordMode>("vc");
    const [phase, setPhase] = React.useState<"idle" | "recording" | "done">("idle");
    const [duration, setDuration] = React.useState(0);
    const [blob, setBlob] = React.useState<Blob | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const blobUrlRef = React.useRef<string | null>(null);

    function clearTimer() {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }

    function releaseBlob() {
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    }

    async function start() {
        setError(null);
        try {
            const stream = mode === "mic" ? await getMicStream() : await getVCStream();
            streamRef.current = stream;
            setDuration(0);
            setBlob(null);
            releaseBlob();
            setPhase("recording");
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            startRecording(stream, b => {
                setBlob(b);
                setPhase("done");
                clearTimer();
            });
        } catch (e: any) {
            setError(e?.message ?? "Failed to access audio");
        }
    }

    function stop() {
        stopRecording();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        clearTimer();
    }

    function save() {
        if (!blob) return;
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        downloadBlob(blob, `recording-${mode}-${ts}.webm`);
        Toasts.show({ message: "Recording saved", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    }

    React.useEffect(() => () => { stop(); releaseBlob(); }, []);

    const blobUrl = React.useMemo(() => {
        releaseBlob();
        if (!blob) return null;
        blobUrlRef.current = URL.createObjectURL(blob);
        return blobUrlRef.current;
    }, [blob]);

    const isRecording = phase === "recording";

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <HeadingSecondary style={{ margin: 0 }}>Voice Recorder</HeadingSecondary>
                <ModalCloseButton onClick={() => { stop(); modalProps.onClose(); }} />
            </ModalHeader>
            <ModalContent style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>

                {phase === "idle" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                            variant={mode === "vc" ? "primary" : "secondary"}
                            size="small"
                            onClick={() => setMode("vc")}
                        >
                            VC (All Voices)
                        </Button>
                        <Button
                            variant={mode === "mic" ? "primary" : "secondary"}
                            size="small"
                            onClick={() => setMode("mic")}
                        >
                            Mic Only
                        </Button>
                    </div>
                )}

                <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: isRecording ? "var(--status-danger)" : "var(--background-modifier-accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                    boxShadow: isRecording ? "0 0 20px var(--status-danger)" : "none",
                }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 16.93A8 8 0 0 1 4 10H2a10 10 0 0 0 9 9.93V22H9v2h6v-2h-2v-2.07A10 10 0 0 0 22 10h-2a8 8 0 0 1-7 7.93z" />
                    </svg>
                </div>

                <span style={{ fontSize: "28px", fontVariantNumeric: "tabular-nums", color: "var(--header-primary)", fontWeight: 600 }}>
                    {fmt(duration)}
                </span>

                {phase === "idle" && !error && (
                    <Paragraph style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 300, fontSize: "13px" }}>
                        {mode === "vc"
                            ? "Captures all VC audio via system loopback. You'll see an OS picker — selecting any screen is fine."
                            : "Records your microphone only."
                        }
                    </Paragraph>
                )}

                {error && (
                    <Paragraph style={{ color: "var(--status-danger)", textAlign: "center", maxWidth: 320, fontSize: "13px" }}>
                        {error}
                    </Paragraph>
                )}

                {phase === "done" && blobUrl && (
                    <audio controls src={blobUrl} style={{ width: "100%" }} />
                )}
            </ModalContent>
            <ModalFooter>
                {phase === "idle" && (
                    <Button variant="dangerPrimary" onClick={start}>Start Recording</Button>
                )}
                {phase === "recording" && (
                    <Button variant="secondary" onClick={stop}>Stop</Button>
                )}
                {phase === "done" && (
                    <>
                        <Button variant="primary" onClick={save}>Save</Button>
                        <Button variant="dangerPrimary" onClick={start} style={{ marginLeft: "8px" }}>Record Again</Button>
                    </>
                )}
            </ModalFooter>
        </ModalRoot>
    );
}

const vcCtxPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel?.id) return;
    const me = UserStore.getCurrentUser();
    if (!me) return;
    const voiceState = VoiceStateStore.getVoiceStateForUser(me.id);
    if (!voiceState?.channelId) return;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="nin-voice-recorder"
                label="Record VC"
                action={() => openModal(props => <RecorderModal modalProps={props} />)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "VoiceRecorder",
    description: "Record voice channels. VC mode captures all voices via system audio loopback. Mic mode records only your microphone.",
    authors: [Devs.medisiner],
    settings,
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "channel-context": vcCtxPatch,
    }
});
