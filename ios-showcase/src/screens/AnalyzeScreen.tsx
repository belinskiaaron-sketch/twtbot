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
import { analyzeText, type AnalysisResult } from '@/services/claude';
import { Colors } from '@/theme/colors';

const SAMPLE = `The Federal Reserve raised interest rates by 25 basis points today, citing persistent inflation
above its 2% target. Markets reacted cautiously, with the S&P 500 slipping 0.4% before recovering
to close flat. Fed Chair Powell noted that while labor markets remain resilient, consumer sentiment
has weakened over the past quarter, suggesting the rate cycle may be nearing its peak.`;

const SENTIMENT_COLORS: Record<string, string> = {
  positive: Colors.accentGreen,
  negative: Colors.error,
  neutral: Colors.textSecondary,
  mixed: Colors.accentAmber,
};

function SentimentBar({ score }: { score: number }) {
  const color = score >= 60 ? Colors.accentGreen : score >= 40 ? Colors.accentAmber : Colors.error;
  return (
    <View style={sentStyles.track}>
      <View style={[sentStyles.fill, { width: `${score}%`, backgroundColor: color }]} />
    </View>
  );
}

const sentStyles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: Colors.bg3,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});

export function AnalyzeScreen() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await analyzeText(text.trim(), apiKey);
      setResult(r);
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
      <Header title="Analyze" subtitle="Sentiment, themes, tone & readability" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!apiKey && <ApiKeyBanner onSave={setApiKey} />}

        <Text style={styles.label}>TEXT TO ANALYZE</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Paste any text…"
          placeholderTextColor={Colors.textMuted}
        />

        <Pressable
          style={[styles.button, (!text.trim() || loading || !apiKey) && styles.buttonDisabled]}
          onPress={analyze}
          disabled={!text.trim() || loading || !apiKey}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Analyze with Claude</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result && (
          <View style={styles.results}>
            {/* Sentiment */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SENTIMENT</Text>
              <View style={styles.row}>
                <Text style={[styles.sentimentText, { color: SENTIMENT_COLORS[result.sentiment] }]}>
                  {result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1)}
                </Text>
                <Text style={styles.scoreText}>{result.score}/100</Text>
              </View>
              <SentimentBar score={result.score} />
            </View>

            {/* Summary */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SUMMARY</Text>
              <Text style={styles.cardBody}>{result.summary}</Text>
            </View>

            {/* Key Themes */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>KEY THEMES</Text>
              <View style={styles.tags}>
                {result.keyThemes.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Tone & Readability */}
            <View style={styles.metaRow}>
              <View style={[styles.card, styles.metaCard]}>
                <Text style={styles.cardLabel}>TONE</Text>
                <Text style={styles.metaValue}>{result.tone}</Text>
              </View>
              <View style={[styles.card, styles.metaCard]}>
                <Text style={styles.cardLabel}>READABILITY</Text>
                <Text style={styles.metaValue}>{result.readability}</Text>
              </View>
            </View>
          </View>
        )}
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
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.bg2,
    borderRadius: 14,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  button: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  results: { gap: 10 },
  card: {
    backgroundColor: Colors.bg2,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cardBody: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sentimentText: { fontSize: 22, fontWeight: '700' },
  scoreText: { fontSize: 14, color: Colors.textSecondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: Colors.accentBlue + '22',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accentBlue + '44',
  },
  tagText: { color: Colors.accentBlue, fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaCard: { flex: 1 },
  metaValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600' },
});
