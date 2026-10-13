import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/features/auth/authStore';
import { useOnline } from '@/features/connection/useOnline';
import { createRoom, fetchOpenMatch } from '@/features/match/api';
import { captainFor } from '@/features/solo/levels';
import { useSolo } from '@/features/solo/soloStore';
import { toAppError } from '@/lib/supabase';
import type { MatchRow } from '@/types/database';
import {
  AppText,
  Banner,
  Button,
  IconButton,
  Logo,
  Panel,
  Pill,
  Screen,
  art,
  colors,
  fonts,
  radius,
  space,
} from '@/ui';

const AVATARS = [
  art.avatar_captain_01,
  art.avatar_captain_02,
  art.avatar_captain_03,
  art.avatar_captain_04,
];

/** A stable portrait per player, picked from their id. */
function avatarFor(id: string | undefined) {
  if (!id) return AVATARS[0]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length]!;
}

const STATUS_TEXT: Record<string, string> = {
  waiting: 'Phòng của bạn đang chờ đối thủ',
  placing: 'Đang bố trí hạm đội',
  active: 'Trận đang diễn ra',
};

export default function Home() {
  const { status, profile, error, init } = useAuth();
  const online = useOnline();
  const [openMatch, setOpenMatch] = useState<MatchRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const ready = status === 'ready';
  const solo = useSolo((s) => s.game);
  const soloOpen = solo && solo.status !== 'finished' ? solo : null;
  const soloButton = (
    <Button
      label="Đấu với máy"
      art="cannonball"
      variant={ready ? 'secondary' : 'primary'}
      accessibilityHint="Chơi ngoại tuyến với máy"
      onPress={() => router.push('/solo')}
    />
  );

  useFocusEffect(
    useCallback(() => {
      setActionError(null);
      if (!ready) return;
      let active = true;
      fetchOpenMatch()
        .then((m) => active && setOpenMatch(m))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [ready]),
  );

  const goToMatch = (id: string) => router.push({ pathname: '/match/[id]', params: { id } });

  const onCreateRoom = async () => {
    setCreating(true);
    setActionError(null);
    try {
      const room = await createRoom();
      goToMatch(room.id);
    } catch (e) {
      const err = toAppError(e);
      if (err.code === 'already_in_match') {
        const m = await fetchOpenMatch().catch(() => null);
        if (m) {
          goToMatch(m.id);
          return;
        }
      }
      setActionError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const connection =
    online === false
      ? { label: 'Ngoại tuyến', tone: 'bad' as const }
      : status === 'ready'
        ? { label: 'Đã kết nối', tone: 'good' as const }
        : status === 'error' || status === 'unconfigured'
          ? { label: 'Chưa kết nối', tone: 'bad' as const }
          : { label: 'Đang kết nối…', tone: 'warn' as const };

  return (
    <Screen backdrop="home" contentStyle={styles.content}>
      <View style={styles.top}>
        <Pill label={connection.label} tone={connection.tone} />
        <IconButton art="settings" label="Cài đặt" onPress={() => router.push('/settings')} />
      </View>

      <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
        <Logo size={140} width={280} />
        <AppText variant="body" align="center" color={colors.textDim} style={styles.tagline}>
          Hải chiến theo lượt dưới trăng Caribbean, đấu trực tuyến 1–1.
        </AppText>
      </Animated.View>

      <Panel style={styles.player}>
        <Image source={avatarFor(profile?.id)} style={styles.avatar} />
        <View style={styles.playerText}>
          <AppText variant="label">Thuyền trưởng</AppText>
          {profile ? (
            <AppText variant="heading" numberOfLines={1}>
              {profile.display_name}
            </AppText>
          ) : status === 'loading' || status === 'idle' ? (
            <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <AppText variant="heading" color={colors.textMuted}>
              —
            </AppText>
          )}
        </View>
        <Button
          label="Đổi tên"
          icon="create-outline"
          variant="secondary"
          compact
          disabled={!ready}
          onPress={() => setRenaming(true)}
        />
      </Panel>

      {status === 'unconfigured' ? (
        <Banner
          tone="error"
          text="Chưa cấu hình Supabase nên chưa chơi online được (tạo .env theo .env.example). Đấu với máy vẫn chơi được."
        />
      ) : null}
      {status === 'error' && error ? (
        <Banner
          tone="error"
          text={error.message}
          action={<Button label="Thử lại" compact onPress={() => void init()} />}
        />
      ) : null}
      {online === false ? (
        <Banner tone="warn" text="Không có mạng. Kết nối lại để chơi trực tuyến." />
      ) : null}
      {actionError ? <Banner tone="error" text={actionError} /> : null}

      {openMatch ? (
        <Panel style={styles.resume}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">
              {STATUS_TEXT[openMatch.status] ?? 'Trận chưa kết thúc'}
            </AppText>
            <AppText variant="caption">Tiếp tục từ chỗ bạn đã dừng.</AppText>
          </View>
          <Button label="Tiếp tục" icon="play" compact onPress={() => goToMatch(openMatch.id)} />
        </Panel>
      ) : null}

      {soloOpen ? (
        <Panel style={styles.resume}>
          <Image source={captainFor(soloOpen.level).avatar} style={styles.resumeAvatar} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">Trận với máy đang dở</AppText>
            <AppText variant="caption" numberOfLines={1}>
              vs {captainFor(soloOpen.level).name}
            </AppText>
          </View>
          <Button label="Tiếp tục" icon="play" compact onPress={() => router.push('/solo')} />
        </Panel>
      ) : null}

      <View style={styles.actions}>
        {/* Offline play is the only option until the backend is reachable, so it leads then. */}
        {ready ? null : soloButton}
        <Button
          label="Chơi nhanh"
          art="quickplay"
          variant={ready ? 'primary' : 'secondary'}
          disabled={!ready}
          onPress={() => router.push('/matchmaking')}
        />
        {ready ? soloButton : null}
        <Button
          label="Tạo phòng"
          art="create"
          variant="secondary"
          disabled={!ready}
          loading={creating}
          onPress={onCreateRoom}
        />
        <Button
          label="Tham gia bằng mã"
          art="join"
          variant="secondary"
          disabled={!ready}
          onPress={() => router.push('/join')}
        />
      </View>

      <RenameModal
        visible={renaming}
        current={profile?.display_name ?? ''}
        onClose={() => setRenaming(false)}
      />
    </Screen>
  );
}

function RenameModal({
  visible,
  current,
  onClose,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
}) {
  const rename = useAuth((s) => s.rename);
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setName(current);
        setError(null);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Panel style={styles.modal}>
          <AppText variant="heading">Đổi tên</AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoFocus
            autoCorrect={false}
            placeholder="Tên của bạn"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="done"
            accessibilityLabel="Tên hiển thị"
          />
          <AppText variant="caption">2–20 ký tự. Đối thủ sẽ thấy tên này.</AppText>
          {error ? <Banner tone="error" text={error} /> : null}
          <View style={styles.modalActions}>
            <Button label="Huỷ" variant="ghost" compact onPress={onClose} style={{ flex: 1 }} />
            <Button
              label="Lưu"
              compact
              loading={saving}
              disabled={name.trim().length < 2}
              style={{ flex: 1 }}
              onPress={async () => {
                setSaving(true);
                setError(null);
                try {
                  await rename(name);
                  onClose();
                } catch (e) {
                  setError(toAppError(e).message);
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        </Panel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
  tagline: { maxWidth: 300, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 6 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.accentDim,
  },
  playerText: { flex: 1, gap: 0 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  resumeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accentDim,
  },
  actions: { gap: space.md, paddingBottom: space.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: space.lg,
  },
  modal: { gap: space.md, padding: space.xl + 4 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: 'rgba(6,13,16,0.75)',
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  modalActions: { flexDirection: 'row', gap: space.md },
});
