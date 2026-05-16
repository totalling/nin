/*
 * nin, a Discord client mod
 * Copyright (c) 2025 nin contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const SUPPORTED = /^image\/(jpeg|png|webp|gif)$/;

async function scrubFile(file: File): Promise<File> {
    if (!SUPPORTED.test(file.type)) return file;
    if (file.type === "image/gif") return file;

    try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();

        return await new Promise<File>((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) { resolve(file); return; }
                resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
            }, file.type, 0.95);
        });
    } catch {
        return file;
    }
}

const listener: MessageSendListener = async (_channelId, _message, options) => {
    if (!options.uploads?.length) return;
    await Promise.all(
        options.uploads.map(async upload => {
            if (upload.item?.file) {
                (upload.item as any).file = await scrubFile(upload.item.file);
            }
        })
    );
};

export default definePlugin({
    name: "MetadataScrubber",
    description: "Strips EXIF and metadata from images before uploading. Protects location, device info, and timestamps embedded in photos.",
    authors: [Devs.medisiner],
    dependencies: ["MessageEventsAPI"],

    start() {
        addMessagePreSendListener(listener);
    },

    stop() {
        removeMessagePreSendListener(listener);
    }
});
