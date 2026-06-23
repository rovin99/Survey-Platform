import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  question: any;
  value: any;
  onChange: (value: any) => void;
}

const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function Rating({ question, value, onChange }: Props) {
  const rating = typeof value === 'number' ? value : 0;

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(i => (
          <TouchableOpacity key={i} onPress={() => onChange(i)} style={styles.star}>
            <Ionicons
              name={i <= rating ? 'star' : 'star-outline'}
              size={40}
              color={i <= rating ? '#f59e0b' : '#d1d5db'}
            />
          </TouchableOpacity>
        ))}
      </View>
      {rating > 0 && (
        <Text style={styles.label}>{labels[rating]} ({rating}/5)</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { padding: 4 },
  label: { fontSize: 16, color: '#64748b', marginTop: 12, fontWeight: '500' },
});
