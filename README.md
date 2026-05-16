# nin

A Discord client mod that actually respects you.

Built on [Vencord](https://github.com/Vendicated/Vencord), stripped of the fluff. nin focuses on privacy, utility, and features Discord should have shipped. Less tracking, less noise, more yours.

## Privacy

- **MetadataScrubber** — strips EXIF data from images before uploading
- **TrackingScrubber** — removes UTM and tracking params from links before sending
- **PartnershipConfirm** — confirmation prompt before sending @everyone or @here
- **DraftPersistence** — unsent drafts survive restarts, stored locally
- **SavedMessages** — bookmark messages locally, no cloud
- **SelfDestructMessage** — messages that auto-delete after a set time
- **AutoReply** — automated DM replies when you're away

Plus everything from Vencord's 160+ plugins.

## Install

**Requirements:** Node.js 18+, pnpm, Discord desktop

```sh
git clone https://github.com/totalling/nin
cd nin
pnpm install
pnpm build
pnpm installer
```

The installer is an interactive terminal UI — navigate with arrow keys, press Enter to install.

To inject directly:

```sh
pnpm inject
```

To remove:

```sh
pnpm uninject
```

## Development

```sh
pnpm watch
```

Fully restart Discord after each rebuild.

## License

[GPL-3.0-or-later](LICENSE)
