---
name: kenney-assets-finder
description: "Find, download, and prepare Kenney assets for Phaser projects when the user wants to select or add a pack from Kenney's gallery."
---

# Kenney Asset Workflow

Use this skill when a user wants to find, compare, download, or prepare assets from Kenney's preview gallery for a Phaser project.

## Source

Browse the live gallery: <https://kenney.nl/data/itch/preview/>. Its filters include All, 2D, 3D, UI, Icons, Audio, and Other, plus a text filter. The gallery and its contents may change, so search the live page instead of relying on a remembered inventory.

## Find and download a pack

1. Translate the user's need into a few English search terms and useful synonyms, since pack names are in English. Use the gallery's category filters and text filter to narrow the list.
2. Inspect candidate pack names and open their linked preview images. Compare the visible style and subject with the user's request.
3. Before downloading, verify the pack on its official Kenney asset page or Kenney's itch.io page. Confirm the download source, price or free status, and license from that page or the included license file. Prefer a free pack when the user says to choose any pack. If the page offers an optional donation for a free download, use its free/no-donation option. Do not enter payment or contact information, make a purchase, or accept a binding agreement without the user's specific authorization.
4. Download only from Kenney's official site or Kenney's itch.io account. Keep the original archive and extract it into `public/assets/packs/kenney/<pack-slug>/`, preserving the archive's internal folders and filenames. Keep included license, attribution, readme, and tilemap files with the pack. Avoid scattering or duplicating files into the categorized asset folders unless the user asks for that organization.
5. Inspect the archive before extraction. Check that it opens cleanly and that its entries do not contain absolute paths, parent-directory traversal, or symlinks. After extraction, confirm that representative files exist and are readable. Report the source, license status, destination, and any verification result.
6. Return the exact English pack name, a Traditional Chinese translation when useful, a short description, and links to the official pack page and preview. Keep the recommendation focused; use a small shortlist when many packs match.

## Project helper scripts

Use the project commands after confirming the official product page and free-download option:

- Download a direct ZIP URL copied from an official Kenney page:

      npm run kenney:download -- --url <direct-zip-url> --source-page <official-pack-page> --slug <pack-slug>

- If the download page requires browser interaction, download the ZIP manually from Kenney and use the preparation command instead.
- Verify and extract an archive, preserving it and recording a manifest:

      npm run kenney:prepare -- <archive-path> --slug <pack-slug> --name "<English pack name>" --source-page <official-pack-page>

- Rebuild the Phaser-facing inventory after adding or updating packs:

      npm run kenney:catalog

The downloader accepts only HTTPS URLs from Kenney, Kenney's itch.io account, or itch.io's download CDN, checks ZIP integrity, and refuses to overwrite an archive. The preparation script rejects unsafe ZIP paths and symlinks, checks CRCs, preserves existing files, and writes pack-manifest.json with hashes, file types, image dimensions when readable, source page, and license-file presence. License-file presence is not a license interpretation; inspect the included license and official page separately. The catalog records runtime URLs rooted at /assets/packs/kenney/.

## Use the pack with Phaser

- When the user asks to load the downloaded content in-game or to verify the full asset-to-game workflow, read the project's `loading-assets` skill first, then read the skill matching the files being used:
  - Image, sprite, or tilesheet: `sprites-and-images`
  - Sprite animation or atlas: `animations`
  - Tiled maps or tile layers: `tilemaps`
  - Music or sound effects: `audio-and-sound`
  - Bitmap or web fonts: `text-and-bitmaptext`
  - Particle effects: `particles`; post-processing or shaders: `filters-and-postfx`
  - Game bootstrap or configuration: `game-setup-and-config`; scene lifecycle or transitions: `scenes`
- Use only the relevant Phaser skills for the selected files. A download-only task does not need game-code changes. For an end-to-end verification request, add or update a minimal game scene that loads and displays or plays a representative asset, then verify it in the running game.
- Resolve runtime URLs from the public asset root. For example, a file at `public/assets/packs/kenney/<pack-slug>/...` is served from `/assets/packs/kenney/<pack-slug>/...` by a compatible dev server.

## Accuracy

- Treat the gallery as a catalog of pack names and previews. A preview image may not show every asset included in its pack.
- Do not infer exact asset counts, file formats, license terms, prices, or download availability from a name or preview. Verify details on an official source, or say they are unknown.
- If a download or game load cannot be verified, report the exact stage that completed and what remains unverified.
