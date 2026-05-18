/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Based on the Equicord implementation by Drag and neoarz:
 * https://github.com/Equicord/Equicord/blob/main/src/equicordplugins/platformSpoofer/index.tsx
 */

import { definePluginSettings } from "@api/Settings";
import { ErrorCard } from "@components/ErrorCard";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { AuthenticationStore, PresenceStore, UserStore } from "@webpack/common";

type Platform = "desktop" | "web" | "android" | "ios" | "xbox" | "playstation" | "vr";
type GetClientStatus = typeof PresenceStore.getClientStatus;

const platformBrowserMap: Record<Platform, string> = {
    desktop: "Discord Client",
    web: "Discord Web",
    ios: "Discord iOS",
    android: "Discord Android",
    xbox: "Discord Embedded",
    playstation: "Discord Embedded",
    vr: "Discord VR",
};

const platformClientStatusMap: Record<Platform, string> = {
    desktop: "desktop",
    web: "web",
    android: "mobile",
    ios: "mobile",
    xbox: "embedded",
    playstation: "embedded",
    vr: "vr",
};

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: "What platform to appear as to other users",
        restartNeeded: true,
        options: [
            { label: "Desktop", value: "desktop" as Platform, default: true },
            { label: "Web", value: "web" as Platform },
            { label: "Android", value: "android" as Platform },
            { label: "iOS", value: "ios" as Platform },
            { label: "Xbox", value: "xbox" as Platform },
            { label: "PlayStation", value: "playstation" as Platform },
            { label: "VR", value: "vr" as Platform },
        ]
    }
});

let originalGetClientStatus: GetClientStatus | null = null;

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof what platform or device you appear on to other users",
    tags: ["Utility"],
    authors: [Devs.medisiner],
    settings,

    settingsAboutComponent: () => (
        <ErrorCard style={{ padding: "8px 12px", marginBottom: "8px" }}>
            <b style={{ fontSize: "13px" }}>Warning</b>
            <p style={{ margin: "2px 0 0", fontSize: "12px" }}>
                We can't guarantee this won't get you warned or banned. Use at your own risk.
                <br />Updated by medisiner (971064130704400405)
            </p>
        </ErrorCard>
    ),

    patches: [
        {
            find: "_doIdentify(){",
            replacement: [
                {
                    match: /window._ws=null,null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
                    replace: "{...$1,...$self.getPlatform(true)}"
                },
            ]
        },
    ],

    start() {
        originalGetClientStatus = PresenceStore.getClientStatus.bind(PresenceStore);
        PresenceStore.getClientStatus = ((userId: string) => {
            const currentUser = UserStore.getCurrentUser();
            if (currentUser && userId === (currentUser.id ?? AuthenticationStore.getId())) {
                const platform = (settings.store.platform ?? "desktop") as Platform;
                const clientStatus = platformClientStatusMap[platform];
                const real = originalGetClientStatus!(userId);
                const statusValue = Object.values(real)[0] ?? "online";
                return { [clientStatus]: statusValue };
            }
            return originalGetClientStatus!(userId);
        }) as GetClientStatus;
    },

    stop() {
        if (originalGetClientStatus) {
            PresenceStore.getClientStatus = originalGetClientStatus;
            originalGetClientStatus = null;
        }
    },

    getPlatform(bypass: boolean, userId?: string): { browser: string; } | null {
        const currentUser = UserStore.getCurrentUser();
        if (!bypass && (!currentUser || userId !== currentUser.id)) return null;

        const platform = (settings.store.platform ?? "desktop") as Platform;
        const browser = platformBrowserMap[platform];

        return browser ? { browser } : null;
    }
});
