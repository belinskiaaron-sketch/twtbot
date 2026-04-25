import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { processCode, type CodeMode } from '@/services/claude';
import { Colors } from '@/theme/colors';

const MODES: { key: CodeMode; label: string; icon: string }[] = [
  { key: 'explain', label: 'Explain', icon: '📝' },
  { key: 'review', label: 'Review', icon: '🔍' },
  { key: 'convert', label: 'Convert', icon: '🔄' },
  { key: 'document', label: 'Document', icon: '📚' },
];

const SAMPLE_CODE = `function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}`;

const CONVERT_TARGETS = ['Python', 'TypeScript', 'Rust', 'Go', 'Swift'];

export function CodeScreen() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [code, setCode] = useState(SAMPLE_CODE);
  const [mode, setMode] = useState<CodeMode>('explain');
  const [targetLang, setTargetLang] = useState('Python');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const result = await processCode(code.trim(), mode, apiKey, mode === 'convert' ? targetLang : undefined);
      setOutput(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Code" subtitle="Explain, review, convert & document" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!apiKey && <ApiKeyBanner onSave={setApiKey} />}

        <Text style={styles.label}>OPERATION</Text>
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

        {mode === 'convert' && (
          <View style={styles.convertRow}>
            <Text style={styles.convertLabel}>Target language:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
              {CONVERT_TARGETS.map((lang) => (
                <Pressable
                  key={lang}
                  style={[styles.langChip, targetLang === lang && styles.langChipActive]}
                  onPress={() => setTargetLang(lang)}
                >
                  <Text style={[styles.langText, targetLang === lang && styles.langTextActive]}>{lang}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.label, styles.labelTop]}>CODE</Text>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          multiline
          placeholder="Paste your code here…"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        <Pressable
          style={[styles.button, (!code.trim() || loading || !apiKey) && styles.buttonDisabled]}
          onPress={run}
          disabled={!code.trim() || loading || !apiKey}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Run with Claude ⌨️</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {output ? (
          <View style={styles.outputCard}>
            <Text style={styles.outputLabel}>RESULT</Text>
            <Text style={styles.outputText}>{output}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg0 },
  scroll: { padding: 16 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  labelTop: { marginTop: 16 },
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
    backgroundColor: Colors.accentAmber + '22',
    borderColor: Colors.accentAmber + '66',
  },
  modeIcon: { fontSize: 15 },
  modeLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  modeLabelActive: { color: Colors.accentAmber },
  convertRow: { marginTop: 12 },
  convertLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  langRow: { gap: 8 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langChipActive: {
    backgroundColor: Colors.accentAmber + '22',
    borderColor: Colors.accentAmber + '66',
  },
  langText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  langTextActive: { color: Colors.accentAmber },
  codeInput: {
    backgroundColor: Colors.bg1,
    borderRadius: 14,
    padding: 14,
    color: '#A8D8A8',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    minHeight: 160,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  button: {
    backgroundColor: Colors.accentAmber,
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
    borderColor: Colors.accentAmber + '33',
  },
  outputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  outputText: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
});
