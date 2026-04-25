import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';

interface CapabilityCardProps {
  title: string;
  description: string;
  icon: string;
  gradient: [string, string];
  accentColor: string;
  onPress: () => void;
}

export function CapabilityCard({
  title,
  description,
  icon,
  gradient,
  accentColor,
  onPress,
}: CapabilityCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <LinearGradient colors={gradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[styles.iconContainer, { backgroundColor: accentColor + '22' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={[styles.arrow, { backgroundColor: accentColor + '33' }]}>
          <Text style={[styles.arrowText, { color: accentColor }]}>→</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  gradient: {
    padding: 18,
    minHeight: 160,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  arrow: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
