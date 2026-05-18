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
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

type Platform = "desktop" | "web" | "android" | "ios" | "xbox" | "playstation" | "vr";

const platformBrowserMap: Record<Platform, string> = {
    desktop: "Discord Client",
    web: "Discord Web",
    ios: "Discord iOS",
    android: "Discord Android",
    xbox: "Discord Embedded",
    playstation: "Discord Embedded",
    vr: "Discord VR",
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

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof what platform or device you appear on to other users",
    tags: ["Utility"],
    authors: [Devs.nin0dev],
    settings,

    settingsAboutComponent: () => (
        <ErrorCard className={Margins.bottom8}>
            <HeadingSecondary>Warning</HeadingSecondary>
            <Paragraph>
                We can't guarantee this plugin won't get you warned or banned. Use at your own risk.
            </Paragraph>
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

    getPlatform(bypass: boolean, userId?: string): { browser: string; } | null {
        const currentUser = UserStore.getCurrentUser();
        if (!bypass && (!currentUser || userId !== currentUser.id)) return null;

        const platform = (settings.store.platform ?? "desktop") as Platform;
        const browser = platformBrowserMap[platform];

        return browser ? { browser } : null;
    }
});
