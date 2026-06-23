import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);

  const hasConductor = user?.roles?.includes('Conducting');
  const hasParticipant = user?.roles?.includes('Participating');

  const registerConductor = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
    setLoading(true);
    try {
      await authService.registerAsConductor({ name: name.trim() });
      await refreshUser();
      router.replace('/(tabs)/conductor');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to register');
    } finally { setLoading(false); }
  };

  const registerParticipant = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
    setLoading(true);
    try {
      await authService.registerAsParticipant({ name: name.trim() });
      await refreshUser();
      router.replace('/(tabs)/participant');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to register');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose Your Role</Text>
      <Text style={styles.subtitle}>How would you like to use the platform?</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
        <TextInput style={styles.input} placeholder="Your Name" value={name} onChangeText={setName} />
      </View>

      <TouchableOpacity
        style={[styles.card, hasConductor && styles.cardDisabled]}
        onPress={registerConductor}
        disabled={loading || hasConductor}
      >
        <Ionicons name="create-outline" size={32} color={hasConductor ? '#9ca3af' : '#3b82f6'} />
        <Text style={[styles.cardTitle, hasConductor && styles.textDisabled]}>Conductor</Text>
        <Text style={styles.cardDesc}>Create surveys, quizzes, and manage evaluations</Text>
        {hasConductor && <Text style={styles.registered}>Already registered</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, hasParticipant && styles.cardDisabled]}
        onPress={registerParticipant}
        disabled={loading || hasParticipant}
      >
        <Ionicons name="school-outline" size={32} color={hasParticipant ? '#9ca3af' : '#10b981'} />
        <Text style={[styles.cardTitle, hasParticipant && styles.textDisabled]}>Participant</Text>
        <Text style={styles.cardDesc}>Take surveys, quizzes, and view your results</Text>
        {hasParticipant && <Text style={styles.registered}>Already registered</Text>}
      </TouchableOpacity>

      {(hasConductor || hasParticipant) && (
        <TouchableOpacity style={styles.continueBtn} onPress={() => router.replace('/(tabs)/participant')}>
          <Text style={styles.continueBtnText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 80, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e2e8f0', height: 52, marginBottom: 20,
  },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center',
  },
  cardDisabled: { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 12 },
  cardDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 4 },
  textDisabled: { color: '#9ca3af' },
  registered: { color: '#10b981', fontSize: 12, fontWeight: '600', marginTop: 8 },
  continueBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
