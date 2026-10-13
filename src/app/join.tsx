import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { fetchOpenMatch, joinRoom } from '@/features/match/api';
import { toAppError } from '@/lib/supabase';
import { AppText, Banner, Button, IconButton, Screen, colors, fonts, radius, space } from '@/ui';

// Room codes avoid 0/O and 1/I, so anything else is dropped as the player types.
const CODE_CHARS = /[^A-HJ-NP-Z2-9]/g;

export default function Join() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setJoining(true);
    setError(null);
    try {
      const match = await joinRoom(code);
      router.replace({ pathname: '/match/[id]', params: { id: match.id } });
    } catch (e) {
      const err = toAppError(e);
      if (err.code === 'already_in_match') {
        const open = await fetchOpenMatch().catch(() => null);
        setError(
          open
            ? 'Bạn đang có một trận chưa kết thúc. Hoàn thành hoặc đầu hàng trận đó trước.'
            : err.message,
        );
      } else {
        setError(err.message);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <IconButton icon="chevron-back" label="Quay lại" onPress={() => router.back()} />
        <View style={styles.body}>
          <AppText variant="title">Tham gia phòng</AppText>
          <AppText variant="body">Nhập mã 6 ký tự mà bạn bè gửi cho bạn.</AppText>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setError(null);
              setCode(t.toUpperCase().replace(CODE_CHARS, '').slice(0, 6));
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={6}
            placeholder="ABC123"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={() => code.length === 6 && void submit()}
            accessibilityLabel="Mã phòng"
          />
          {error ? <Banner tone="error" text={error} /> : null}
          <Button
            label="Lên tàu"
            art="join"
            disabled={code.length !== 6}
            loading={joining}
            onPress={submit}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, marginTop: space.lg },
  input: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: 'rgba(6,13,16,0.8)',
    color: colors.accentBright,
    textAlign: 'center',
    fontFamily: fonts.caps,
    fontSize: 40,
    letterSpacing: 10,
  },
});
