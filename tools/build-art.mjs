// Turns the AI-generated source art in assets/art-src (large PNGs, not committed) into the
// app-sized WebP files in assets/art, the app icon set in assets/images, and the typed
// require map in src/ui/art.ts. Run with `pnpm art`; never edit the outputs by hand.
//
// Ships are cropped to the union of their intact/sunk alpha bounds so both states register
// pixel for pixel, then scaled so the hull spans exactly N cells. Frames, buttons and panels
// are exported at @3x with cap insets (in points) for 9-slice stretching.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'art-src');
const OUT = join(ROOT, 'assets', 'art');
const ICONS = join(ROOT, 'assets', 'images');
const NIGHT = '#0a1418';
mkdirSync(OUT, { recursive: true });

const src = (f) => join(SRC, `${f}.png`);
const webp = (img, file, quality = 82) =>
  img.webp({ quality, alphaQuality: 90, effort: 6 }).toFile(join(OUT, file));

/** Alpha bounding box (alpha > 24) of an image, as a sharp `extract` region. */
async function alphaBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width,
    y0 = info.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const union = (a, b) => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
  };
};

/** Trim to content, then centre on a transparent square of `size` px with `pad` margin. */
async function squareSprite(name, size, pad = 0.04) {
  const box = await alphaBounds(src(name));
  const inner = Math.round(size * (1 - pad * 2));
  const trimmed = await sharp(src(name))
    .extract(box)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await webp(
    sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([{ input: trimmed, gravity: 'center' }]),
    `${name}.webp`,
  );
}

const lines = [];
const req = (file) => `require('../../assets/art/${file}')`;

// --- Full-bleed backgrounds and textures --------------------------------------------------
await webp(sharp(src('bg_home')).resize({ width: 1206 }), 'bg_home.webp', 78);
await webp(sharp(src('bg_battle')).resize({ width: 1206 }), 'bg_battle.webp', 78);
await webp(sharp(src('board_parchment')).resize(1080, 1080), 'board_parchment.webp', 80);
await webp(sharp(src('board_water')).resize(1080, 1080), 'board_water.webp', 80);
for (const n of [
  'avatar_captain_01',
  'avatar_captain_02',
  'avatar_captain_03',
  'avatar_captain_04',
]) {
  await webp(sharp(src(n)).resize(384, 384), `${n}.webp`, 80);
}

// --- Sprites on transparent squares -------------------------------------------------------
const SQUARES = {
  compass_rose: 720,
  logo_emblem: 900,
  result_win: 900,
  result_lose: 900,
  matchmaking_spyglass: 720,
  mark_hit: 300,
  mark_miss_chart: 240,
  mark_miss_water: 300,
  mark_smoke: 300,
  cannonball: 240,
  icon_quickplay: 240,
  icon_create: 240,
  icon_join: 240,
  icon_settings: 240,
  icon_surrender: 240,
  icon_rotate: 240,
  icon_random: 240,
  icon_undo: 240,
};
for (const [n, size] of Object.entries(SQUARES))
  await squareSprite(n, size, n.startsWith('mark_') ? 0 : 0.04);

// Wordmark keeps its aspect; the app sizes it by width.
{
  const box = await alphaBounds(src('logo_wordmark'));
  const out = sharp(src('logo_wordmark')).extract(box).resize({ width: 1200 });
  const meta = await out.clone().toBuffer({ resolveWithObject: true });
  await webp(out, 'logo_wordmark.webp');
  lines.push(`export const wordmarkAspect = ${(meta.info.height / meta.info.width).toFixed(4)};`);
}

// --- Ships: union crop per intact/sunk pair, hull length = N cells at 144 px per cell ------
const SHIPS = { ship_5: 5, ship_4: 4, ship_3a: 3, ship_3b: 3, ship_2: 2 };
const shipEntries = [];
for (const [n, cells] of Object.entries(SHIPS)) {
  const box = union(await alphaBounds(src(n)), await alphaBounds(src(`${n}_sunk`)));
  const width = cells * 144;
  const height = Math.round((box.height / box.width) * width);
  for (const variant of [n, `${n}_sunk`]) {
    await webp(
      sharp(src(variant)).extract(box).resize(width, height, { fit: 'fill' }),
      `${variant}.webp`,
      85,
    );
  }
  shipEntries.push(
    `  ${n}: { cells: ${cells}, aspect: ${(height / width).toFixed(4)}, intact: ${req(`${n}.webp`)}, sunk: ${req(`${n}_sunk.webp`)} },`,
  );
}

// --- 9-slice art at @3x. `caps` are source-pixel insets of the trimmed image ---------------
const SLICES = {
  btn_gold: { height: 56, caps: { top: 140, bottom: 140, left: 220, right: 220 } },
  btn_wood: { height: 52, caps: { top: 175, bottom: 175, left: 175, right: 175 } },
  panel_wood: { height: 120, caps: { top: 190, bottom: 190, left: 190, right: 190 } },
  banner_parchment: { height: 64, caps: { top: 260, bottom: 260, left: 350, right: 350 } },
  // Opening measured at 165/163/165/167 px from the trimmed edge: the frame sits fully outside.
  frame_board: { height: 96, caps: { top: 163, bottom: 167, left: 165, right: 165 } },
};
const sliceEntries = [];
for (const [n, cfg] of Object.entries(SLICES)) {
  const box = await alphaBounds(src(n));
  const scale = (cfg.height * 3) / box.height;
  const w = Math.round(box.width * scale);
  const h = Math.round(box.height * scale);
  await webp(sharp(src(n)).extract(box).resize(w, h, { fit: 'fill' }), `${n}@3x.webp`, 88);
  const pt = (v) => Math.round(((v * scale) / 3) * 10) / 10;
  const c = cfg.caps;
  sliceEntries.push(
    `  ${n}: { src: ${req(`${n}.webp`)}, width: ${Math.round(w / 3)}, height: ${Math.round(h / 3)}, caps: { top: ${pt(c.top)}, left: ${pt(c.left)}, bottom: ${pt(c.bottom)}, right: ${pt(c.right)} } },`,
  );
}

// --- App icon, splash and Android adaptive layers -----------------------------------------
await sharp(src('app_icon'))
  .resize(1024, 1024)
  .flatten({ background: NIGHT })
  .png()
  .toFile(join(ICONS, 'icon.png'));
await sharp(src('app_icon')).resize(48, 48).png().toFile(join(ICONS, 'favicon.png'));
{
  const box = await alphaBounds(src('logo_emblem'));
  const emblem = (size) =>
    sharp(src('logo_emblem'))
      .extract(box)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  const onCanvas = async (size, inner, background) =>
    sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: await emblem(inner), gravity: 'center' }])
      .png();
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  await (await onCanvas(1024, 900, clear)).toFile(join(ICONS, 'splash-icon.png'));
  // Android keeps the inner 66% of the foreground visible under every mask shape.
  await (await onCanvas(1024, 660, clear)).toFile(join(ICONS, 'android-icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: NIGHT } })
    .png()
    .toFile(join(ICONS, 'android-icon-background.png'));
  const alpha = await sharp(await (await onCanvas(1024, 660, clear)).toBuffer())
    .extractChannel('alpha')
    .toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toFile(join(ICONS, 'android-icon-monochrome.png'));
}

// --- Typed require map --------------------------------------------------------------------
const plain = [
  'bg_home',
  'bg_battle',
  'board_parchment',
  'board_water',
  'compass_rose',
  'logo_emblem',
  'logo_wordmark',
  'result_win',
  'result_lose',
  'matchmaking_spyglass',
  'mark_hit',
  'mark_miss_chart',
  'mark_miss_water',
  'mark_smoke',
  'cannonball',
  'avatar_captain_01',
  'avatar_captain_02',
  'avatar_captain_03',
  'avatar_captain_04',
];
const icons = ['quickplay', 'create', 'join', 'settings', 'surrender', 'rotate', 'random', 'undo'];
const ts = `// Generated by tools/build-art.mjs from assets/art-src. Do not edit; run \`pnpm art\`.
import type { ImageSourcePropType } from 'react-native';

export const art = {
${plain.map((n) => `  ${n}: ${req(`${n}.webp`)},`).join('\n')}
} satisfies Record<string, ImageSourcePropType>;

export const artIcons = {
${icons.map((n) => `  ${n}: ${req(`icon_${n}.webp`)},`).join('\n')}
  cannonball: ${req('cannonball.webp')},
} satisfies Record<string, ImageSourcePropType>;
export type ArtIconName = keyof typeof artIcons;

/** Ship sprites, bow to the right. \`aspect\` is height / width; width spans \`cells\` cells. */
export const shipArt = {
${shipEntries.join('\n')}
} as const;
export type ShipArtName = keyof typeof shipArt;

/** 9-slice art: natural size and cap insets in points, for <Image capInsets resizeMode="stretch">. */
export const sliceArt = {
${sliceEntries.join('\n')}
} as const;
export type SliceArtName = keyof typeof sliceArt;

${lines.join('\n')}
`;
writeFileSync(join(ROOT, 'src', 'ui', 'art.ts'), ts);
console.log('art: wrote assets/art, assets/images and src/ui/art.ts');
