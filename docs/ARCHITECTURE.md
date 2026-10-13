# Fleetline — Kiến trúc

## Tổng quan

```
App (Expo Router)                         Supabase
┌──────────────────────────┐   RPC     ┌────────────────────────────────────┐
│ src/app/*  (màn hình)    │ ───────▶  │ public.* functions (SECURITY DEFINER)│
│ features/match/useMatch  │           │   kiểm tra auth.uid(), lượt, trạng thái│
│ features/matchmaking     │  SELECT   │ Tables + RLS (chỉ đọc cho client)    │
│ features/game/logic (pure)│ ◀──────  │   matches · shots · profiles         │
│                          │ Realtime  │   fleets (bí mật) · matchmaking_queue │
│                          │ ◀──────── │ publication: matches, shots          │
└──────────────────────────┘           └────────────────────────────────────┘
```

- **Luật chơi** (`src/features/game/logic`) là hàm thuần, không phụ thuộc React hay Supabase. Client dùng
  để đặt tàu, hiển thị và chặn sớm thao tác sai; **server tự tính lại mọi thứ** (`private.normalise_fleet`,
  `public.fire`) và không tin dữ liệu client.
- **Truy cập dữ liệu** (`src/features/match/api.ts`): wrapper cho RPC và SELECT, ném `AppError` với mã lỗi
  rõ ràng (`src/lib/supabase/errors.ts`).
- **Đồng bộ** (`src/features/match/useMatch.ts`): tải đầy đủ trạng thái, đăng ký Realtime, thử lại với
  backoff, tải lại khi app quay về foreground hoặc có mạng trở lại, gửi heartbeat.
- **UI** (`src/ui`, `src/features/*/components`, `src/app`): chỉ hiển thị và gọi hành động.

## Vì sao tách dữ liệu công khai và bí mật

Battleship chỉ an toàn khi client **không bao giờ** nhận được vị trí tàu đối thủ. Thay vì lưu cả hai đội hình
trong `matches` và lọc ở client, đội hình nằm trong bảng `fleets` riêng:

- Policy SELECT của `fleets`: chỉ chủ đội hình, hoặc thành viên trận khi `status = 'finished'`
  (để màn kết quả hiện đội hình đối thủ).
- `fleets` **không** có trong publication `supabase_realtime`, nên Realtime không thể phát nó cho ai.
- `public.fire` đọc đội hình đối thủ với quyền owner (SECURITY DEFINER) và chỉ trả về `miss | hit | sunk`.
  Khi tàu chìm mới công bố các ô của chính tàu đó, giống luật bàn cờ.

`matches` và `shots` chỉ chứa thông tin cả hai người được phép biết (lượt, kết quả bắn, cờ sẵn sàng,
heartbeat), nên có thể phát qua Realtime Postgres Changes. Realtime áp dụng policy SELECT cho từng subscriber,
nên người ngoài trận không nhận được gì.

## Ghi dữ liệu: chỉ qua RPC

Client chỉ có quyền `SELECT` trên các bảng (đã `revoke` insert/update/delete và không có policy ghi).
Mọi thay đổi đi qua các hàm:

| RPC | Việc | Kiểm tra chính |
|---|---|---|
| `create_room` | tạo phòng mã 6 ký tự | 1 trận mở / người; bấm lại trả về phòng cũ |
| `join_room(code)` | vào phòng | mã hợp lệ, không phải phòng mình, chưa đủ người, chưa bắt đầu |
| `cancel_room` | huỷ phòng đang chờ | chỉ chủ phòng, chỉ khi `waiting` |
| `join_queue` / `leave_queue` | tìm trận nhanh (poll ~2,5 s, kiêm heartbeat hàng chờ) | không tự ghép mình, bỏ qua mục cũ > 20 s |
| `place_fleet(ships)` | khoá đội hình | đúng 5 tàu, trong bàn, không chồng; gửi lại = no-op |
| `fire(cell, shot_id)` | bắn | thành viên, `active`, đúng lượt, ô 0–99, chưa bắn; `shot_id` chống gửi lặp |
| `surrender` | đầu hàng | thành viên, trận đang diễn ra |
| `heartbeat` | báo còn kết nối | chỉ cập nhật cột của chính mình |
| `claim_abandoned` | nhận thắng khi đối thủ im lặng | server kiểm tra đối thủ im lặng ≥ 120 s |
| `request_rematch` | chơi lại | cả hai đồng ý mới tạo trận mới, gọi lặp an toàn |

Tất cả là `SECURITY DEFINER` với `set search_path = ''`; quyền EXECUTE bị thu hồi khỏi `anon`
(người chưa đăng nhập không gọi được) và chỉ cấp cho `authenticated` (bao gồm người dùng ẩn danh).
Hàm nội bộ nằm trong schema `private`, không được PostgREST công khai.

## Tính nguyên tử và đồng thời

- Mọi thao tác trên trận khoá dòng `matches … FOR UPDATE` → hai phát bắn đồng thời không thể cùng qua
  (test: `scripts/db-concurrency.mjs`, "double fire").
- Thao tác có thể tạo trận khoá dòng `profiles` của người gọi (`FOR NO KEY UPDATE`, không chặn kiểm tra FK)
  → không ai có hai trận mở cùng lúc.
- Ghép cặp tìm trận nhanh dùng một `pg_advisory_xact_lock` ngắn. Cách "mỗi người khoá mục của mình rồi
  `SKIP LOCKED` người khác" bị livelock khi mọi người poll cùng lúc (đã tái hiện trong test), nên đã thay.
- `shots` có `unique (match_id, shooter, cell)` làm lớp chặn cuối cho bắn lặp.

## Kết nối và khôi phục

- Phiên ẩn danh lưu trong AsyncStorage → mở lại app vẫn là cùng người chơi; trang chủ tìm trận chưa kết
  thúc (RLS giới hạn truy vấn về trận của mình) và hiện nút "Tiếp tục".
- `useMatch` luôn coi server là nguồn sự thật: mỗi lần (re)subscribe Realtime, quay lại foreground, có mạng
  trở lại hoặc một hành động thất bại đều tải lại toàn bộ trạng thái.
- Hành động gặp lỗi mạng được thử lại tối đa 3 lần; `fire` giữ nguyên `shot_id` giữa các lần thử nên
  không thể bắn hai lần.
- Đối thủ "mất kết nối" khi heartbeat cũ hơn 25 s; chỉ sau 120 s mới cho phép nhận thắng (và server kiểm
  tra lại). Không có tự động đổi lượt hay tự động xử thua.

## Kiểm thử

- `pnpm test` — Jest: luật chơi, reducer đặt tàu, model trận, map lỗi.
- `pnpm test:db` — tạo cluster Postgres tạm, nạp stub những gì Supabase có sẵn (role, `auth.uid()`,
  default privileges, publication), chạy migration rồi `supabase/tests/*.test.sql` + test đồng thời.
  Không cần Docker. Stub này mô phỏng Supabase, không thay thế được Supabase thật — vì vậy có thêm:
- `pnpm smoke` — chạy với project Supabase thật (local hoặc hosted): 2 người chơi ẩn danh chơi hết một trận,
  kiểm tra Realtime và các thao tác bị từ chối.

## Đấu với máy

Chạy hoàn toàn trên thiết bị, không gọi Supabase. Vì không có đối thủ người, không có gì cần giấu nên luật được
áp dụng ở client.

- **Luật:** `src/features/solo/game.ts` dùng chung `resolveShot`/`checkFire` với phần online, cùng luật một
  phát mỗi lượt.
- **AI:** `chooseShot` (`src/features/game/logic/ai.ts`) chỉ nhận kết quả các phát bắn của chính nó, không
  bao giờ đọc hạm đội của người chơi.
  - **Dễ:** bắn ngẫu nhiên.
  - **Thường:** dò theo ô cờ, trúng rồi thì truy đến khi tàu chìm.
  - **Khó:** bản đồ mật độ xác suất.
- **Hiển thị:** trận được chuyển sang dạng `MatchRow`/`ShotRow`, nên `BattleView` và `ResultView` dùng lại
  nguyên vẹn.
- **Lưu trận:** lưu vào AsyncStorage (`fleetline.solo.v1`) sau mỗi nước đi, và kiểm tra lại bằng
  `isSoloGame` khi nạp.
