import { View, Text, TextInput as RNTextInput, StyleSheet } from 'react-native';

interface Props {
  question: any;
  value: any;
  onChange: (value: any) => void;
}

export default function TextQuestion({ question, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <RNTextInput
        style={styles.input}
        placeholder="Type your answer here..."
        value={value || ''}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        placeholderTextColor="#9ca3af"
      />
      <Text style={styles.charCount}>{(value || '').length} characters</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16,
    minHeight: 120, color: '#1e293b',
  },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
});
