import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CapabilityCard } from '@/components/CapabilityCard';
import { Colors } from '@/theme/colors';

const CAPABILITIES = [
  {
    title: 'Chat',
    description: 'Conversational AI with context-aware multi-turn dialogue.',
    icon: '💬',
    gradient: Colors.gradients.chat,
    accentColor: Colors.accentPurple,
    route: '/chat',
  },
  {
    title: 'Analyze',
    description: 'Deep text analysis: sentiment, themes, tone, and readability.',
    icon: '🔍',
    gradient: Colors.gradients.analyze,
    accentColor: Colors.accentBlue,
    route: '/analyze',
  },
  {
    title: 'Generate',
    description: 'Create tweets, headlines, stories, emails, and bios on demand.',
    icon: '✨',
    gradient: Colors.gradients.generate,
    accentColor: Colors.accentGreen,
    route: '/generate',
  },
  {
    title: 'Code',
    description: 'Explain, review, convert, or document any code snippet.',
    icon: '⌨️',
    gradient: Colors.gradients.code,
    accentColor: Colors.accentAmber,
    route: '/code',
  },
];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient
        colors={['#1A0A2E', '#0A0A0F']}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Powered by Claude</Text>
        </View>
        <Text style={styles.heroTitle}>AI at your{'\n'}fingertips</Text>
        <Text style={styles.heroSubtitle}>
          Explore what Claude can do — from rich conversation to deep code analysis.
        </Text>
      </LinearGradient>

      {/* Section label */}
      <Text style={styles.sectionLabel}>CAPABILITIES</Text>

      {/* 2-column grid */}
      <View style={styles.grid}>
        {CAPABILITIES.map((cap) => (
          <CapabilityCard
            key={cap.title}
            title={cap.title}
            description={cap.description}
            icon={cap.icon}
            gradient={cap.gradient}
            accentColor={cap.accentColor}
            onPress={() => router.push(cap.route as never)}
          />
        ))}
      </View>

      {/* Footer note */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built with the{' '}
          <Text style={styles.footerAccent}>Anthropic API</Text>
          {' '}· claude-sonnet-4-6
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  content: {
    paddingHorizontal: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.accentPurple + '33',
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brand + '22',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.brand + '44',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
    marginLeft: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  footerAccent: {
    color: Colors.brand,
  },
});
