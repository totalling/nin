/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { DraftStore, DraftType, FluxDispatcher } from "@webpack/common";

const STORE_KEY = "nin_Drafts";

let drafts: Record<string, string> = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        DataStore.set(STORE_KEY, drafts);
        saveTimer = null;
    }, 500);
}

function onDraftSave({ channelId, draft, draftType }: any) {
    if (draftType !== DraftType.ChannelMessage) return;
    if (draft) {
        drafts[channelId] = draft;
    } else {
        delete drafts[channelId];
    }
    scheduleSave();
}

export default definePlugin({
    name: "DraftPersistence",
    description: "Saves unsent message drafts across Discord restarts.",
    authors: [Devs.medisiner],

    async start() {
        drafts = await DataStore.get(STORE_KEY) ?? {};
        for (const [channelId, draft] of Object.entries(drafts)) {
            if (!draft) continue;
            const current = DraftStore.getDraft(channelId, DraftType.ChannelMessage);
            if (!current) {
                FluxDispatcher.dispatch({
                    type: "DRAFT_SAVE",
                    channelId,
                    draft,
                    draftType: DraftType.ChannelMessage,
                    timestamp: new Date(),
                });
            }
        }
        FluxDispatcher.subscribe("DRAFT_SAVE", onDraftSave);
    },

    stop() {
        FluxDispatcher.unsubscribe("DRAFT_SAVE", onDraftSave);
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
    }
});
