# Fleetline — Implementation plan

Battleship online cho iOS/Android. Expo SDK 57 · React Native 0.86 · TypeScript strict · Expo Router ·
Supabase (Auth ẩn danh, Postgres, RLS, RPC, Realtime).

## 0. Khảo sát (2026-10-12)

- Thư mục `~/fleetline` chưa tồn tại → tạo mới bằng `create-expo-app` (template `default@sdk-57`).
- Routes nằm trong `src/app/` (theo `AGENTS.md` của template). Code không phải route nằm ngoài `src/app/`.
- Package manager: pnpm 10 với `nodeLinker: hoisted` (giống các app Expo khác trên máy này).
- Lint: `expo lint` (ESLint 9 flat config, pin `^9` vì ESLint 10 làm hỏng `eslint-config-expo`).
- Test: `jest-expo`. Máy không có Docker/Supabase CLI nhưng có Postgres 16 → migration và RLS được
  kiểm thử trên một cluster Postgres tạm, có stub cho `auth.uid()`, role `anon`/`authenticated` và
  publication `supabase_realtime`.

## 1. Kiến trúc

```
src/app/                    routes (Expo Router)
src/features/game/logic     luật chơi thuần (không React, không Supabase) + test
src/features/game/components lưới, ô, khay tàu, bàn đặt tàu, bàn trận đấu
src/features/match          RPC wrappers, hook useMatch (load + realtime + heartbeat + reconnect)
src/features/matchmaking    hook tìm trận nhanh
src/features/auth           khởi tạo phiên ẩn danh + profile
src/features/settings       cài đặt rung (persist AsyncStorage)
src/lib/supabase            client, map lỗi RPC → thông báo tiếng Việt
src/ui                      theme, component nền (Button, Screen, Logo…)
supabase/migrations         schema + RLS + RPC
supabase/tests              test SQL (bảo mật & luật) chạy bằng scripts/test-db.sh
scripts/smoke.ts            chạy 2 người chơi ẩn danh đánh hết 1 trận trên Supabase thật
```

## 2. Dữ liệu & bảo mật

Tách **trạng thái công khai** khỏi **dữ liệu bí mật**:

| Bảng | Nội dung | Ai đọc | Ai ghi |
|---|---|---|---|
| `profiles` | tên hiển thị | mọi user đã đăng nhập | chỉ RPC |
| `matches` | mã phòng, 2 người chơi, trạng thái, lượt, người thắng, cờ sẵn sàng/rematch, heartbeat | 2 thành viên | chỉ RPC |
| `fleets` | đội hình của 1 người trong 1 trận | **chỉ chủ đội hình**; đối thủ chỉ khi trận đã kết thúc | chỉ RPC |
| `shots` | phát bắn: ô, kết quả (miss/hit/sunk), ô của tàu vừa chìm | 2 thành viên | chỉ RPC |
| `matchmaking_queue` | hàng chờ | chỉ chính mình | chỉ RPC |

- Client chỉ có quyền `SELECT` (qua RLS). Mọi thay đổi đi qua RPC `security definer` có
  `set search_path = ''`, kiểm tra `auth.uid()`, khoá hàng `matches … for update` để nguyên tử.
- Realtime dùng **Postgres Changes** trên `matches` và `shots` (Realtime áp dụng RLS cho từng subscriber).
  `fleets` **không** nằm trong publication → không bao giờ được phát qua Realtime.
- Kết quả "hit" không cho biết là tàu nào; chỉ khi tàu chìm thì ô của tàu đó mới được công bố (luật cổ điển).
- Chống request lặp: `fire` nhận `shot_id` do client sinh; gửi lại cùng `shot_id` trả về kết quả cũ thay vì
  bắn lần hai. Bắn lại ô cũ với id khác → lỗi `already_fired`.

## 3. Luồng trận

`waiting` (phòng riêng chờ người thứ 2) → `placing` → `active` → `finished`; `cancelled` khi chủ phòng huỷ.
Tìm trận nhanh tạo thẳng trận ở `placing`. Lượt luân phiên sau mỗi phát (luật cổ điển). Người đi trước chọn
ngẫu nhiên phía server. Rematch: cả hai bấm "Chơi lại" → server tạo trận mới, cùng 2 người.

Heartbeat 10 s (`heartbeat` RPC) cập nhật `p1_seen_at`/`p2_seen_at`. Đối thủ coi là "mất kết nối" sau 25 s.
Không tự xử thua; chỉ sau 120 s im lặng người còn lại mới được bấm "Nhận thắng" (`claim_abandoned`, server
kiểm tra lại thời gian). Không có đổi lượt tự động.

## 4. Các bước

1. Nền tảng: dọn template, pnpm, TS strict, ESLint/Prettier, Jest, theme, font, navigation.
2. Luật chơi thuần + test (toạ độ, đặt tàu, validate đội hình, random fleet, áp dụng phát bắn, thắng).
3. UI đặt tàu và bàn trận đấu với dữ liệu local.
4. Migration Supabase + RLS + RPC + test SQL (an ninh, luật, đồng thời).
5. Auth ẩn danh, profile, phòng, matchmaking, trận realtime, đầu hàng, khôi phục, rematch.
6. Trạng thái offline/reconnecting/lỗi, README, `.env.example`, smoke test, chạy toàn bộ kiểm tra.

## 5. Ngoài phạm vi MVP

Âm thanh (chỉ có rung, mặc định bật nhưng tắt được), xếp hạng, chat, push notification, liên kết tài khoản
ẩn danh với email.

## 6. Trạng thái (2026-10-12)

| Bước | Trạng thái |
|---|---|
| 1. Nền tảng | Xong — `pnpm verify` sạch, `expo-doctor` 21/21 |
| 2. Luật chơi + test | Xong — 36 test Jest |
| 3. UI local | Xong — kiểm tra trên iPhone SE qua route `/dev` |
| 4. Migration + RLS + RPC | Xong — 110 kiểm tra (SQL + 3 kịch bản đồng thời) trên Postgres 16 tạm |
| 5. Tích hợp multiplayer | Code xong, typecheck/lint sạch. **Chưa chạy trên Supabase thật** (chưa có project) |
| 6. Hoàn thiện + tài liệu | Xong — README, ARCHITECTURE, `.env.example`, `pnpm smoke` |
| 8. Đấu với máy (2026-10-13) | Xong — AI 3 mức (trung bình 66 / 52 / 44 phát để đánh chìm cả hạm đội, đo trên 40 ván), lưu trận cục bộ; chơi trọn một ván trên iPhone 17 Pro |
| 7. Giao diện cướp biển (2026-10-13) | Xong — 43 ảnh AI qua `pnpm art`, font mới, 9-slice; kiểm tra trên iPhone 17 Pro (simulator) qua `/dev` và các màn chính |

Còn phụ thuộc cấu hình ngoài: tạo project Supabase, bật anonymous sign-ins, `db push`, điền `.env`, rồi chạy
`pnpm smoke` và thử hai thiết bị. Phát hiện trong lúc làm: ghép cặp bằng `SKIP LOCKED` theo từng hàng bị
livelock khi mọi người poll cùng lúc → đổi sang advisory lock ngắn (xem ARCHITECTURE.md).
