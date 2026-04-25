import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { MessageBubble } from '@/components/MessageBubble';
import { LoadingDots } from '@/components/LoadingDots';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { chat, type Message } from '@/services/claude';
import { Colors } from '@/theme/colors';

const STARTERS = [
  'What can you help me with today?',
  'Explain quantum computing simply.',
  'What makes a great startup idea?',
  'How do I improve my writing?',
];

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = { role: 'user', content: text.trim() };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput('');
      setLoading(true);

      try {
        const reply = await chat(updated, apiKey);
        setMessages([...updated, { role: 'assistant', content: reply }]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages([...updated, { role: 'assistant', content: `Error: ${msg}` }]);
      } finally {
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [messages, loading, apiKey],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Header title="Chat" subtitle="Multi-turn conversation with Claude" />

      {!apiKey && <ApiKeyBanner onSave={setApiKey} />}

      {messages.length === 0 && apiKey && (
        <View style={styles.starters}>
          {STARTERS.map((s) => (
            <Pressable key={s} style={styles.starter} onPress={() => send(s)}>
              <Text style={styles.starterText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.list}
        style={styles.listContainer}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <View style={styles.loadingAvatar}>
            <Text style={styles.loadingAvatarText}>C</Text>
          </View>
          <LoadingDots />
        </View>
      )}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={apiKey ? 'Message Claude…' : 'Add API key above to start'}
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={2000}
          editable={!!apiKey}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          blurOnSubmit
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading || !apiKey) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading || !apiKey}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  starters: {
    padding: 16,
    gap: 8,
  },
  starter: {
    backgroundColor: Colors.bg2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  starterText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    paddingVertical: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  loadingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg0,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: Colors.bg2,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
