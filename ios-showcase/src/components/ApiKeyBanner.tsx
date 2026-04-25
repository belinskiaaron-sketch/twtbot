import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { Colors } from '@/theme/colors';

interface ApiKeyBannerProps {
  onSave: (key: string) => void;
}

export function ApiKeyBanner({ onSave }: ApiKeyBannerProps) {
  const [key, setKey] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your Anthropic API key</Text>
      <Text style={styles.subtitle}>Required to call Claude. Your key stays on-device only.</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="sk-ant-..."
          placeholderTextColor={Colors.textMuted}
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, !key.trim() && styles.buttonDisabled]}
          onPress={() => key.trim() && onSave(key.trim())}
          disabled={!key.trim()}
        >
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.brand + '55',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.bg3,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
