# Fleetline

Battleship trực tuyến 1–1 cho iOS và Android. Expo SDK 57 · React Native 0.86 · TypeScript (strict) ·
Expo Router · Supabase (Auth ẩn danh, Postgres + RLS, RPC, Realtime).

- Đăng nhập ẩn danh tự động, đổi tên hiển thị.
- Tạo phòng riêng (mã 6 ký tự, sao chép/chia sẻ), tham gia bằng mã, tìm trận nhanh.
- Đặt tàu: chọn tàu, xoay ngang/dọc, chạm để đặt, nhấc tàu lên, hoàn tác, xoá, đặt ngẫu nhiên.
- Trận đấu theo lượt realtime, tàu đối thủ luôn bị che; trúng/trượt/chìm, số tàu còn lại, trạng thái đối thủ.
- Khôi phục trận sau khi mất mạng hoặc đóng/mở app; đầu hàng; chơi lại khi cả hai đồng ý.
- **Đấu với máy** (ngoại tuyến, không cần Supabase): 3 thuyền trưởng máy Dễ / Thường / Khó. Trận được lưu
  trên máy và tiếp tục được sau khi đóng app.
- Mọi luật được kiểm tra ở server; client không đọc được đội hình đối thủ (xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Yêu cầu

- Node 22+, pnpm 10 (`corepack enable`).
- Expo Go (SDK 57) trên điện thoại, hoặc iOS Simulator / Android Emulator. App chỉ dùng thư viện có sẵn trong
  Expo Go, **không cần development build**.
- Một project Supabase (miễn phí được) — hoặc Supabase local nếu có Docker.
- Để chạy `pnpm test:db`: Postgres 16 (`brew install postgresql@16`). Không cần Docker.

## 1. Tạo backend Supabase

1. Tạo project tại <https://supabase.com/dashboard>.
2. **Bật đăng nhập ẩn danh:** Authentication → Sign In / Providers → bật *Allow anonymous sign-ins*.
   (Nên bật thêm CAPTCHA / giữ rate limit mặc định cho anonymous sign-ins trước khi phát hành.)
3. **Chạy migration** (chọn một cách):

   ```bash
   # Cách A — Supabase CLI (khuyên dùng)
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <project-ref>
   pnpm dlx supabase db push          # áp dụng supabase/migrations/*
   ```

   Cách B — Dashboard → SQL Editor → dán toàn bộ nội dung
   `supabase/migrations/20261012000000_fleetline_core.sql` → Run.

4. Kiểm tra Realtime: Database → Publications → `supabase_realtime` phải gồm **matches** và **shots**
   (migration đã thêm; **không** thêm `fleets`).

### Supabase local (tuỳ chọn, cần Docker)

```bash
pnpm dlx supabase start      # in ra API URL và publishable/anon key
pnpm dlx supabase db reset   # chạy migration + seed
```

`supabase/config.toml` đã bật `enable_anonymous_sign_ins`. Khi chạy app trên điện thoại thật, dùng IP LAN của
máy thay cho `127.0.0.1` trong `EXPO_PUBLIC_SUPABASE_URL`.

## 2. Biến môi trường

```bash
cp .env.example .env
```

Điền `EXPO_PUBLIC_SUPABASE_URL` và `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API, hoặc nút
*Connect*). Project cũ dùng `EXPO_PUBLIC_SUPABASE_ANON_KEY` cũng được. **Không bao giờ** dùng
`service_role`/secret key trong app — mọi biến `EXPO_PUBLIC_*` đều nằm trong bản build. `.env` đã được
`.gitignore`.

Sau khi đổi `.env`, khởi động lại Metro.

## 3. Chạy app

```bash
pnpm install
pnpm start            # rồi nhấn i (iOS) / a (Android), hoặc quét QR bằng Expo Go
```

**Chơi thử với 2 người:** mỗi bản cài là một người chơi ẩn danh riêng. Dùng hai thiết bị bất kỳ: điện thoại +
simulator, hai simulator khác nhau (mở cùng URL `exp://…` trong Expo Go của từng máy), hoặc iOS + Android.
Một máy tạo phòng, máy kia nhập mã; hoặc cả hai bấm *Chơi nhanh*.

Trong chế độ dev có trang xem trước giao diện không cần backend:
`exp://127.0.0.1:<port>/--/dev?screen=placement|battle|result|waiting` (thêm `&presence=away|gone`).

## 4. Kiểm thử

| Lệnh | Nội dung |
|---|---|
| `pnpm typecheck` | TypeScript strict |
| `pnpm lint` | ESLint (expo + React Compiler rules) + Prettier |
| `pnpm test` | Jest: luật chơi, đặt tàu, model trận, map lỗi |
| `pnpm test:db` | Migration + RLS + RPC + đồng thời trên Postgres tạm (không cần Docker) |
| `pnpm verify` | Tất cả các lệnh trên |
| `pnpm smoke` | **Cần `.env`.** 2 người chơi ẩn danh chơi hết 1 trận trên Supabase thật, kiểm tra Realtime và các thao tác bị từ chối |
| `pnpm doctor` | `expo-doctor` |

## 5. Deploy

- **Backend:** mỗi thay đổi schema là một file mới trong `supabase/migrations/`, kiểm thử bằng `pnpm test:db`,
  rồi `pnpm dlx supabase db push` lên project production. Không sửa migration đã áp dụng.
  Sau khi đổi schema, cập nhật `src/types/database.ts`
  (`pnpm dlx supabase gen types typescript --project-id <ref> --schema public`).
- **App:** build bằng EAS (`npx eas-cli@latest build`). Khai báo `EXPO_PUBLIC_SUPABASE_URL` và
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` trong EAS environment variables (`npx eas-cli@latest env:create`).
  `bundleIdentifier`/`package` hiện là `com.fleetline.app` — đổi thành định danh của bạn trước khi phát hành.
- Icon app, splash và mọi ảnh trong app sinh từ ảnh gốc bằng `pnpm art` (đừng sửa file đầu ra bằng tay,
  xem mục **Ảnh**).

## Ảnh

Phong cách "đêm trăng Caribbean": ảnh vẽ bằng AI theo [docs/ASSET_PROMPTS.md](docs/ASSET_PROMPTS.md),
font Grenze Gotisch (tiêu đề), Alegreya SC (nút, nhãn) và Alegreya (chữ thường); cả ba đều có đủ dấu tiếng Việt.

- `assets/art-src/`: 43 PNG gốc (~83 MB). **Không commit** (đã gitignore); bản gốc nằm trong
  `Fleetline_Complete_Assets.zip`, giải nén `assets/art/*.png` vào đây khi cần sinh lại.
- `pnpm art` (`tools/build-art.mjs`, dùng `sharp`) sinh ra:
  - `assets/art/*.webp` (~2,7 MB). Tàu được cắt theo vùng chung của cặp nguyên vẹn/cháy để hai bản khớp
    từng pixel, rồi co để thân tàu dài đúng N ô. Nút, bảng gỗ, băng giấy da và khung bàn cờ xuất @3x kèm
    cap inset cho 9-slice.
  - `assets/images/`: icon app 1024, splash, các lớp icon Android, favicon.
  - `src/ui/art.ts`: bản đồ `require` có kiểu, kèm tỉ lệ tàu và cap inset.
- Đổi icon hoặc splash thì phải build native lại (`npx expo prebuild -p ios --clean`, rồi `pnpm ios`).

## Cấu trúc

```
src/app/                    routes: index, matchmaking, join, settings, match/[id], dev
src/features/game/logic     luật chơi thuần + AI (ai.ts) + test
src/features/game/components Board, ShipTray, FleetStatus
src/features/match          api.ts (RPC/SELECT), useMatch (realtime/heartbeat/reconnect), model, màn trận
src/features/matchmaking    useQuickMatch
src/features/solo           trận với máy: game.ts (luật thuần + adapter sang MatchRow), soloStore (lưu AsyncStorage)
src/features/auth           phiên ẩn danh + profile
src/features/settings       cài đặt rung + haptics
src/lib/supabase            client, map lỗi
src/ui                      theme, Slice/Panel (9-slice), Button, art.ts (sinh tự động)
tools/build-art.mjs         xử lý ảnh AI → assets/art, assets/images, src/ui/art.ts
supabase/migrations         schema, RLS, RPC, publication
supabase/tests              test SQL; support/ = stub Supabase cho Postgres thường
scripts/                    test-db.sh, db-concurrency.mjs, smoke.mjs
docs/                       IMPLEMENTATION_PLAN.md, ARCHITECTURE.md
```

## Giới hạn hiện tại

- Chưa có âm thanh (chỉ rung, tắt được trong Cài đặt). Chưa có xếp hạng, chat, push notification.
- Tài khoản ẩn danh gắn với bản cài: xoá app là mất người chơi đó (có thể nâng cấp lên email sau qua
  `supabase.auth.updateUser`).
- Trạng thái trực tuyến của đối thủ dựa trên heartbeat 10 s, nên có độ trễ tới ~25 s.
- Phòng chờ bỏ quên sau 24 giờ không vào được nữa; chưa có job dọn dẹp định kỳ (hàng chờ tìm trận được dọn
  mỗi lần có người tìm trận).
