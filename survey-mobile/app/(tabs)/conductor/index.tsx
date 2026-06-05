import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ConductorDashboard() {
  return (
    <View style={styles.container}>
      <Ionicons name="construct-outline" size={48} color="#d1d5db" />
      <Text style={styles.title}>Conductor Dashboard</Text>
      <Text style={styles.subtitle}>Coming soon — manage surveys, view results, grade submissions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#64748b', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
});
