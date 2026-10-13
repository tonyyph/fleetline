/** Error codes raised by the SQL functions (see supabase/migrations), plus client-side ones. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Phiên đăng nhập đã hết. Mở lại ứng dụng để tiếp tục.',
  no_profile: 'Chưa có hồ sơ người chơi. Thử lại sau giây lát.',
  invalid_name: 'Tên cần 2–20 ký tự.',
  already_in_match: 'Bạn đang có một trận chưa kết thúc.',
  code_exhausted: 'Không tạo được mã phòng. Thử lại.',
  invalid_code: 'Mã phòng gồm 6 ký tự chữ và số.',
  room_not_found: 'Không tìm thấy phòng với mã này.',
  own_room: 'Đây là phòng của bạn. Gửi mã cho bạn bè để họ vào.',
  room_full: 'Phòng đã đủ hai người.',
  room_started: 'Trận trong phòng này đã bắt đầu.',
  match_not_found: 'Không tìm thấy trận đấu.',
  not_placing: 'Đã qua giai đoạn đặt tàu.',
  invalid_fleet: 'Đội hình không hợp lệ.',
  not_active: 'Trận không còn diễn ra.',
  not_your_turn: 'Chưa đến lượt của bạn.',
  invalid_cell: 'Ô không hợp lệ.',
  already_fired: 'Bạn đã bắn ô này rồi.',
  invalid_shot_id: 'Yêu cầu bắn không hợp lệ.',
  fleet_missing: 'Đối thủ chưa có đội hình.',
  opponent_active: 'Đối thủ vẫn còn kết nối.',
  not_finished: 'Trận chưa kết thúc.',
  opponent_busy: 'Đối thủ đã vào trận khác.',
  network: 'Mất kết nối mạng. Đang thử lại…',
  not_configured: 'Chưa cấu hình Supabase (xem README).',
  unknown: 'Có lỗi xảy ra. Thử lại.',
};

export class AppError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? MESSAGES[code] ?? MESSAGES.unknown);
    this.name = 'AppError';
  }

  get isNetwork(): boolean {
    return this.code === 'network';
  }
}

const NETWORK_HINTS = [
  'Network request failed',
  'Failed to fetch',
  'fetch failed',
  'NetworkError',
  'timeout',
];

/** Normalise anything thrown by supabase-js / fetch into an AppError with a known code. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';
  if (message in MESSAGES) return new AppError(message);
  if (NETWORK_HINTS.some((h) => message.includes(h))) return new AppError('network');
  return new AppError('unknown');
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.unknown;
}
