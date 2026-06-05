import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  question: any;
  value: any;
  onChange: (value: any) => void;
}

export default function SingleChoice({ question, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {question.options?.map((option: any) => {
        const selected = value === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(option.id)}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? '#3b82f6' : '#d1d5db'}
            />
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {option.optionText}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#e2e8f0',
  },
  optionSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  optionText: { fontSize: 16, color: '#374151', flex: 1 },
  optionTextSelected: { color: '#1e40af', fontWeight: '600' },
});
