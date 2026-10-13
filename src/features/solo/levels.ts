import type { ImageSourcePropType } from 'react-native';

import type { AiLevel } from '@/features/game/logic';
import { art } from '@/ui';

export interface AiCaptain {
  level: AiLevel;
  name: string;
  levelLabel: string;
  description: string;
  avatar: ImageSourcePropType;
}

export const AI_CAPTAINS: readonly AiCaptain[] = [
  {
    level: 'easy',
    name: 'Thủy thủ tập sự',
    levelLabel: 'Dễ',
    description: 'Bắn đoán là chính, thỉnh thoảng mới bám theo phát trúng.',
    avatar: art.avatar_captain_02,
  },
  {
    level: 'normal',
    name: 'Hoa tiêu lão luyện',
    levelLabel: 'Thường',
    description: 'Dò biển theo ô cờ, đã trúng là truy đến khi tàu chìm.',
    avatar: art.avatar_captain_03,
  },
  {
    level: 'hard',
    name: 'Thuyền trưởng huyền thoại',
    levelLabel: 'Khó',
    description: 'Tính xác suất từng ô từ mọi phát bắn. Rất ít khi phí đạn.',
    avatar: art.avatar_captain_04,
  },
];

export const captainFor = (level: AiLevel): AiCaptain =>
  AI_CAPTAINS.find((c) => c.level === level) ?? AI_CAPTAINS[1]!;
