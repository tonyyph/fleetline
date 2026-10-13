# Fleetline — Prompt tạo asset bằng AI

Phong cách: cướp biển vùng Caribbean, biển đêm có trăng, gỗ tàu cũ, hải đồ giấy da, vàng nguyền rủa.
Prompt viết bằng tiếng Anh vì hầu hết model ảnh hiểu tiếng Anh tốt nhất.

> **Bản quyền:** đừng đưa vào prompt các chữ "Pirates of the Caribbean", "Jack Sparrow", "Black Pearl",
> "Flying Dutchman", "Disney" hay tên diễn viên. Ảnh tạo ra có thể bị Apple từ chối hoặc bị khiếu nại bản quyền.
> Các prompt dưới đây chỉ tả không khí, không nhắc đến phim.

## Cách dùng để các asset đồng bộ

1. Tạo **#1 (ảnh nền trang chủ)** trước. Chọn bản ưng nhất rồi dùng nó làm ảnh tham chiếu phong cách cho
   mọi asset còn lại: Midjourney thêm `--sref <url ảnh>`, ChatGPT/GPT-image thì đính kèm ảnh và viết
   "match the style of the attached image", Higgsfield/Flux thì dùng chế độ style/image reference.
2. Luôn dán **STYLE** (bên dưới) vào cuối prompt.
3. **Asset cần nền trong suốt** (tàu, ký hiệu, icon, khung):
   - GPT-image: chọn *transparent background*.
   - Model không hỗ trợ nền trong suốt: tạo trên nền xanh lá thuần `#00FF00` (prompt đã ghi sẵn), rồi xoá nền
     bằng remove.bg, Photoshop hoặc công cụ remove background của Higgsfield.
4. Xuất file **PNG**, đặt đúng tên ở cột "File" rồi gửi lại cho mình. Mình sẽ cắt, nén, tạo bản @2x/@3x và
   gắn vào app.
5. **Model:** chữ (logo có chữ) nên dùng GPT-image hoặc Ideogram vì vẽ chữ chuẩn hơn. Ảnh minh hoạ và nền
   dùng Midjourney v7 hoặc Flux sẽ đẹp nhất.

### STYLE — dán vào cuối mọi prompt

```
hand-painted fantasy game art, semi-realistic, rich painterly detail, moody moonlit Caribbean night,
deep teal-black sea, cold moonlight from the upper right, warm amber lantern glow, weathered dark oak,
tarnished brass and aged gold accents, cinematic lighting, high detail, clean readable silhouette,
premium mobile game asset
```

### NEGATIVE — dán vào ô negative prompt (hoặc `--no` trong Midjourney)

```
text, letters, watermark, signature, logo, UI elements, frame border, blurry, lowres, jpeg artifacts,
cartoonish, chibi, anime, modern ships, photorealistic people, gore, extra limbs
```

---

## A. Nhận diện thương hiệu

### 1. Ảnh nền trang chủ (tạo đầu tiên, làm chuẩn phong cách)
- **File:** `bg_home.png` · **Tỉ lệ:** 9:19.5 dọc · **Kích thước:** ≥ 1290×2796 · **Nền:** đầy đủ
- **Lưu ý:** nửa dưới phải tối và ít chi tiết, vì nút bấm sẽ nằm đè lên đó.
```
Vertical mobile game title-screen background. A vast calm Caribbean sea at night under a huge pale full
moon in the upper right, thin clouds drifting across it. On the horizon in the upper-middle third, the
silhouette of a three-masted pirate galleon with tattered black sails, lanterns glowing amber on deck.
Moonlight path shimmering on the water. Gentle mist over the waves. The bottom half fades into dark,
calm, almost empty water with subtle wave texture, leaving clean space for buttons. No text.
--ar 9:19.5
```

### 2. Emblem logo (không chữ)
- **File:** `logo_emblem.png` · **1:1** · **2048×2048** · **Nền:** trong suốt
- **Dùng:** phía trên chữ "FLEETLINE" ở trang chủ, splash, màn tìm trận.
```
Pirate crest emblem for a naval battle game: an ivory skull with a weathered tricorn hat, two crossed
bronze cannons behind it, a coiled rope ring and a small ship's wheel framing the composition, tarnished
gold filigree, subtle glowing ember in the eye sockets. Centered, symmetrical, isolated on a pure flat
#00FF00 green background, crisp edges, no text. --ar 1:1
```

### 3. Logo chữ "FLEETLINE"
- **File:** `logo_wordmark.png` · **4:1** · **2400×600** · **Nền:** trong suốt
- **Dùng GPT-image hoặc Ideogram.** Nếu chữ ra sai chính tả, mình sẽ dựng logo chữ bằng font và chỉ dùng emblem #2.
```
Game logo wordmark reading exactly "FLEETLINE" in all capitals. Ornate weathered pirate lettering,
carved aged-gold metal with dark bronze bevels, small rivets, faint scratches and patina, a thin rope
underline with a small anchor in the center. Front view, centered, isolated on a pure flat #00FF00
green background. Correct spelling, no other text. --ar 4:1
```

### 4. Icon app iOS
- **File:** `app_icon.png` · **1:1** · **1024×1024** · **Nền:** đầy đủ, KHÔNG trong suốt, không bo góc (iOS tự bo)
```
iOS app icon, square, full-bleed. A glowing ivory pirate skull with crossed bronze cannons, centered and
large, set against a deep teal night sea with a big pale moon behind it, warm amber rim light, tarnished
gold ring around the emblem. Bold simple silhouette that reads at small size, high contrast, no text,
no rounded corners, no border. --ar 1:1
```

### 5. Splash
- Dùng lại emblem #2 trên nền màu `#0a1418`. Không cần tạo thêm.

---

## B. Bàn cờ

### 6. Hải đồ giấy da (bàn đối thủ)
- **File:** `board_parchment.png` · **1:1** · **2048×2048** · **Nền:** đầy đủ · **Phải seamless (lặp liền mạch)**
- **Lưu ý:** không vẽ lưới; mình vẽ lưới 10×10 bằng code để ô bấm chính xác.
```
Seamless tileable texture of an aged nautical sea chart on parchment, top-down flat lay, warm cream and
tan paper with subtle stains, faint sepia ink wave hatching, tiny faded compass lines and depth
soundings, slightly darker vignette-free even lighting, no grid, no text, no large symbols, evenly
detailed so it tiles cleanly. --ar 1:1 --tile
```

### 7. Mặt biển đêm (bàn của bạn)
- **File:** `board_water.png` · **1:1** · **2048×2048** · **Nền:** đầy đủ · **seamless**
```
Seamless tileable top-down texture of dark night ocean water, deep teal-black with soft moonlit ripples
and faint specular glints, calm, evenly lit, no foam lines, no objects, no horizon. --ar 1:1 --tile
```

### 8. La bàn trang trí (góc hải đồ)
- **File:** `compass_rose.png` · **1:1** · **1024×1024** · **Nền:** trong suốt
- **Dùng:** in mờ ở góc hải đồ; xoay chậm ở màn tìm trận.
```
Antique compass rose drawn in sepia ink on transparent background, 16 points, fine engraving lines,
ornate north fleur-de-lis, slightly faded hand-inked look, centered, isolated on a pure flat #00FF00
green background, no text. --ar 1:1
```

---

## C. Tàu (nhìn từ trên xuống, nằm ngang, mũi tàu quay sang PHẢI)

Đây là phần quan trọng nhất. Mỗi tàu phủ đúng N ô liên tiếp, nên **tỉ lệ khung phải đúng N:1**. Tàu phải
nằm gọn trong khung, cách mép khoảng 4%. Khi đặt dọc, mình xoay ảnh bằng code.

Phần chung, dán vào đầu mỗi prompt tàu:
```
Top-down orthographic view (bird's-eye, straight down) of a wooden sailing warship, hull pointing to the
right, centered and filling the frame lengthwise with a small margin, sails furled and rigging visible
from above, dark weathered oak deck planks, brass fittings, isolated on a pure flat #00FF00 green
background, crisp edges, no water, no shadow on background, no text.
```

| # | File | Tên trong game | Ô | Tỉ lệ | Kích thước | Phần riêng của prompt |
|---|---|---|---|---|---|---|
| 9 | `ship_5.png` | Chiến hạm | 5 | 5:1 | 2500×500 | `a large three-masted ship of the line, two rows of cannon ports along each side, ornate carved stern gallery with lanterns, gold trim` |
| 10 | `ship_4.png` | Galleon | 4 | 4:1 | 2000×500 | `a heavy Spanish galleon, high stern castle, three masts, gilded stern decoration, broad hull` |
| 11 | `ship_3a.png` | Khinh hạm | 3 | 3:1 | 1500×500 | `a sleek frigate, two masts, single row of cannons, narrow fast hull` |
| 12 | `ship_3b.png` | Brigantine | 3 | 3:1 | 1500×500 | `a pirate brigantine, two masts with a black flag on the main mast, patched planks, rope coils on deck` |
| 13 | `ship_2.png` | Sloop | 2 | 2:1 | 1000×500 | `a small single-mast pirate sloop, a single small cannon at the bow, lantern at the stern` |

Midjourney: thêm `--ar 5:1` / `--ar 4:1` / `--ar 3:1` / `--ar 2:1` tương ứng.

### 14–18. Bản tàu bị đánh chìm
- **File:** `ship_5_sunk.png`, `ship_4_sunk.png`, `ship_3a_sunk.png`, `ship_3b_sunk.png`, `ship_2_sunk.png`
- Cùng tỉ lệ và kích thước với tàu gốc. Đính kèm ảnh tàu gốc làm tham chiếu để giữ đúng hình dáng.
```
Same ship, same top-down view, same size and outline as the reference image, but wrecked and burning:
charred blackened planks, broken masts lying across the deck, torn burnt sails, glowing embers and
small flames, smoke wisps, partially sinking. Isolated on a pure flat #00FF00 green background, no
text.
```

---

## D. Ký hiệu trên bàn (vuông, nền trong suốt, nhỏ nhưng phải rõ)

| # | File | Kích thước | Prompt |
|---|---|---|---|
| 19 | `mark_hit.png` | 512×512 | `A single burst of fire and explosion seen from above, bright orange-red core, glowing embers and a ring of dark smoke, compact and circular, centered, isolated on a pure flat #00FF00 green background, no text. --ar 1:1` |
| 20 | `mark_miss_chart.png` | 512×512 | `A small splash of dark sepia ink on paper seen from above, round blot with a few droplets, hand-inked look, centered, isolated on a pure flat #00FF00 green background. --ar 1:1` |
| 21 | `mark_miss_water.png` | 512×512 | `A small white water splash seen from above with concentric ripples, moonlit, compact and circular, centered, isolated on a pure flat #00FF00 green background. --ar 1:1` |
| 22 | `mark_smoke.png` | 512×512 | `A soft rising plume of grey-black smoke seen from above with a faint ember glow at the base, wispy edges, centered, isolated on a pure flat #00FF00 green background. --ar 1:1` |
| 23 | `cannonball.png` | 256×256 | `A single iron cannonball, dark metal with subtle highlights and a faint trail of sparks, three-quarter view, centered, isolated on a pure flat #00FF00 green background. --ar 1:1` |

---

## E. Khung và nút (9-slice: mình cắt sao cho 4 góc giữ nguyên, phần giữa co giãn)

**Yêu cầu chung:** mặt trước nhìn thẳng, không chữ, nền xanh `#00FF00`, viền đều bốn phía để cắt được.

| # | File | Tỉ lệ / Kích thước | Prompt |
|---|---|---|---|
| 24 | `btn_gold.png` | 4:1 · 1600×400 | `A blank horizontal game button plaque made of polished aged gold with engraved decorative border, beveled edges, small rivets in the corners, warm highlights, front view, flat even lighting, empty center for text, isolated on a pure flat #00FF00 green background. --ar 4:1` |
| 25 | `btn_wood.png` | 4:1 · 1600×400 | `A blank horizontal game button made of dark weathered oak planks with a thin tarnished brass frame and corner brackets, front view, flat even lighting, empty center for text, isolated on a pure flat #00FF00 green background. --ar 4:1` |
| 26 | `panel_wood.png` | 3:2 · 1500×1000 | `A blank rectangular game UI panel of dark ship-deck oak planks with tarnished brass corner brackets and nail heads, subtle wear, front view, flat even lighting, empty center, isolated on a pure flat #00FF00 green background. --ar 3:2` |
| 27 | `banner_parchment.png` | 5:1 · 2000×400 | `A blank horizontal parchment scroll banner with curled ends, aged cream paper with faint stains, front view, empty center for text, isolated on a pure flat #00FF00 green background. --ar 5:1` |
| 28 | `frame_board.png` | 1:1 · 2048×2048 | `A square ornate wooden frame for a game board, dark oak with brass corner pieces shaped like small anchors and rope trim along the edges, the center completely empty and transparent area, front view, isolated on a pure flat #00FF00 green background. --ar 1:1` |

---

## F. Icon chức năng (painted, nền trong suốt, 512×512)

| # | File | Dùng cho | Prompt |
|---|---|---|---|
| 29 | `icon_quickplay.png` | Chơi nhanh | `A bronze cannon firing with a small burst of flame and smoke, three-quarter view` |
| 30 | `icon_create.png` | Tạo phòng | `A black pirate flag on a short wooden pole planted in sand, flag waving` |
| 31 | `icon_join.png` | Tham gia bằng mã | `An ornate old iron skeleton key with a skull-shaped bow` |
| 32 | `icon_settings.png` | Cài đặt | `A wooden ship's steering wheel with brass hub` |
| 33 | `icon_surrender.png` | Đầu hàng | `A tattered white flag on a broken wooden pole` |
| 34 | `icon_rotate.png` | Xoay tàu | `Two curved brass arrows forming a circle around a small anchor` |
| 35 | `icon_random.png` | Đặt ngẫu nhiên | `Two old bone dice tumbling` |
| 36 | `icon_undo.png` | Hoàn tác | `A curved brass arrow pointing left, nautical rope texture` |

Thêm vào sau mỗi dòng:
`game UI icon, centered, single object, bold readable silhouette at small size, isolated on a pure flat #00FF00 green background, no text. --ar 1:1`

---

## G. Minh hoạ màn hình

| # | File | Tỉ lệ / Kích thước | Prompt |
|---|---|---|---|
| 37 | `result_win.png` | 1:1 · 1536×1536 · trong suốt | `An open wooden treasure chest overflowing with glowing gold coins, jewels and a jeweled goblet, warm golden light spilling out, a few coins scattered in front, three-quarter view, centered, isolated on a pure flat #00FF00 green background, no text. --ar 1:1` |
| 38 | `result_lose.png` | 1:1 · 1536×1536 · trong suốt | `A broken pirate ship sinking into dark deep water, seen from below the surface, bubbles rising, moonlight shafts from above, a rusted anchor and an old locked sea chest on the sea floor, eerie teal light, circular vignette composition, isolated on a pure flat #00FF00 green background, no text. --ar 1:1` |
| 39 | `matchmaking_spyglass.png` | 1:1 · 1024×1024 · trong suốt | `An antique brass spyglass extended, resting diagonally, engraved details, glint of moonlight on the lens, centered, isolated on a pure flat #00FF00 green background, no text. --ar 1:1` |
| 40 | `bg_battle.png` | 9:19.5 · ≥ 1290×2796 · đầy đủ | `Vertical mobile game background: the dark wooden deck of a pirate ship at night seen from above at a slight angle, planks fading into darkness at the edges, a lantern casting warm light in the lower corner, coiled ropes and a cannon barely visible at the sides, the center area dark and calm for overlaying game boards, very low contrast in the middle. --ar 9:19.5` |
| 41 | `avatar_captain_*.png` (tuỳ chọn, 4–6 cái) | 1:1 · 512×512 · đầy đủ | `Portrait of a fictional pirate captain, painted bust, [weathered old man with grey beard / young woman with red bandana / one-eyed sailor with eyepatch / dark-skinned quartermaster with gold earrings], tricorn hat, moody moonlit lighting, dark teal background, original character, not resembling any real person. --ar 1:1` |

---

## Thứ tự nên làm

1. #1 `bg_home` để chốt phong cách.
2. #9–13: 5 tàu. Đây là phần tốn công nhất vì phải đúng tỉ lệ và đúng góc nhìn từ trên xuống.
3. #6, #7: texture bàn cờ.
4. #19–21: ký hiệu trúng/trượt.
5. #2, #4: emblem và icon app.
6. Phần còn lại.

Bộ tối thiểu để giao diện trông "thật" là #1, #2, #4, #6, #7, #9–13, #19–21 (15 ảnh). Khung (#24–28) và icon
(#29–36) có thể thêm sau; tạm thời mình vẽ bằng code theo bảng màu mới.

## Gửi lại cho mình

Bỏ các PNG vào `~/fleetline/assets/art/` (giữ đúng tên file), rồi nhắn mình. Mình sẽ:
- kiểm tra tỉ lệ, xoá nền xanh còn sót, cắt sát mép, tạo bản @2x/@3x và nén;
- sinh icon iOS/Android và splash từ `app_icon.png` / `logo_emblem.png` bằng script (`pnpm icons`);
- dựng lại UI theo phong cách mới: font Grenze Gotisch + Alegreya, khung gỗ/vàng, tàu và hiệu ứng bắn dùng ảnh thật;
- build lại lên iPhone 17 Pro.
