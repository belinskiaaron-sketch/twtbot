import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/Header';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { generateContent, type GenerateMode } from '@/services/claude';
import { Colors } from '@/theme/colors';

const MODES: { key: GenerateMode; label: string; icon: string }[] = [
  { key: 'tweet', label: 'Tweet', icon: '🐦' },
  { key: 'headline', label: 'Headlines', icon: '📰' },
  { key: 'story', label: 'Story', icon: '📖' },
  { key: 'email', label: 'Email', icon: '✉️' },
  { key: 'bio', label: 'Bio', icon: '👤' },
];

const EXAMPLE_TOPICS = ['AI in healthcare', 'climate tech', 'indie game dev', 'remote work culture'];

export function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<GenerateMode>('tweet');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const text = await generateContent(topic.trim(), mode, apiKey);
      setOutput(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Generate" subtitle="AI content for any format" />

      {!apiKey && <ApiKeyBanner onSave={setApiKey} />}

      <View style={styles.section}>
        <Text style={styles.label}>FORMAT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
              onPress={() => setMode(m.key)}
            >
              <Text style={styles.modeIcon}>{m.icon}</Text>
              <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>TOPIC OR PROMPT</Text>
        <TextInput
          style={styles.input}
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. AI in healthcare"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exampleRow}>
          {EXAMPLE_TOPICS.map((ex) => (
            <Pressable key={ex} style={styles.exampleChip} onPress={() => setTopic(ex)}>
              <Text style={styles.exampleText}>{ex}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable
        style={[styles.button, (!topic.trim() || loading || !apiKey) && styles.buttonDisabled]}
        onPress={generate}
        disabled={!topic.trim() || loading || !apiKey}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Generate ✨</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {output ? (
        <View style={styles.outputCard}>
          <View style={styles.outputHeader}>
            <Text style={styles.outputLabel}>OUTPUT</Text>
            <View style={styles.outputBadge}>
              <Text style={styles.outputBadgeText}>{MODES.find((m) => m.key === mode)?.label}</Text>
            </View>
          </View>
          <Text style={styles.outputText}>{output}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg0 },
  scroll: { paddingHorizontal: 16 },
  section: { marginTop: 16 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  modeRow: { gap: 8, paddingVertical: 4 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeChipActive: {
    backgroundColor: Colors.accentGreen + '22',
    borderColor: Colors.accentGreen + '66',
  },
  modeIcon: { fontSize: 15 },
  modeLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  modeLabelActive: { color: Colors.accentGreen },
  input: {
    backgroundColor: Colors.bg2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  exampleRow: { gap: 8, paddingVertical: 2 },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  exampleText: { fontSize: 12, color: Colors.textSecondary },
  button: {
    marginTop: 20,
    backgroundColor: Colors.accentGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  outputCard: {
    backgroundColor: Colors.bg2,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accentGreen + '33',
  },
  outputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  outputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  outputBadge: {
    backgroundColor: Colors.accentGreen + '22',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outputBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.accentGreen },
  outputText: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
});
