import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { participantService } from '../../../services/participant.service';
import { Ionicons } from '@expo/vector-icons';

export default function QuizResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await participantService.evaluateQuiz(parseInt(id!));
        setResults(data);
      } catch (error) {
        console.error('Error evaluating:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><Text>Evaluating quiz...</Text></View>;
  if (!results) return <View style={styles.center}><Text>Failed to load results</Text></View>;

  const passed = results.passed;
  const hasPending = results.results?.some((r: any) => r.pendingEvaluation);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Score Header */}
      <View style={[styles.scoreCard, { backgroundColor: passed ? '#ecfdf5' : '#fef2f2' }]}>
        <Text style={styles.scoreEmoji}>{passed ? '🎉' : '📝'}</Text>
        <Text style={[styles.scorePercent, { color: passed ? '#059669' : '#dc2626' }]}>
          {Math.round(results.percentage || 0)}%
        </Text>
        <Text style={styles.scoreLabel}>{passed ? 'Passed!' : 'Not Passed'}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{results.score}/{results.totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{results.correctCount}/{results.totalQuestions}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          {results.timeTakenSeconds > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statVal}>{Math.floor(results.timeTakenSeconds / 60)}m</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          )}
        </View>
      </View>

      {hasPending && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={18} color="#2563eb" />
          <Text style={styles.pendingText}>Some questions are pending manual evaluation</Text>
        </View>
      )}

      {/* Question Results */}
      {results.results?.map((r: any, i: number) => (
        <View key={r.questionId} style={[
          styles.questionCard,
          r.pendingEvaluation ? styles.pendingCard :
          r.isCorrect ? styles.correctCard : styles.incorrectCard
        ]}>
          <View style={styles.qHeader}>
            <Text style={styles.qNumber}>Q{i + 1}</Text>
            {r.pendingEvaluation ? (
              <View style={styles.pendingBadge}><Ionicons name="time-outline" size={12} color="#2563eb" /><Text style={styles.pendingBadgeText}>Pending</Text></View>
            ) : (
              <Text style={[styles.qPoints, { color: r.isCorrect ? '#059669' : '#dc2626' }]}>
                {r.pointsEarned}/{r.pointsPossible}
              </Text>
            )}
          </View>
          <Text style={styles.qText}>{r.questionText}</Text>
          <Text style={styles.answerLabel}>Your Answer:</Text>
          <Text style={styles.answerValue}>
            {typeof r.userAnswer === 'object' ? JSON.stringify(r.userAnswer) : String(r.userAnswer || '—')}
          </Text>
          {!r.pendingEvaluation && r.correctAnswer && (
            <>
              <Text style={styles.answerLabel}>Correct Answer:</Text>
              <Text style={[styles.answerValue, { color: '#059669' }]}>
                {typeof r.correctAnswer === 'object' ? JSON.stringify(r.correctAnswer) : String(r.correctAnswer)}
              </Text>
            </>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/participant')}>
        <Text style={styles.backBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scoreCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  scoreEmoji: { fontSize: 48 },
  scorePercent: { fontSize: 48, fontWeight: 'bold', marginTop: 8 },
  scoreLabel: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statLabel: { fontSize: 12, color: '#64748b' },
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#dbeafe', padding: 12, borderRadius: 12, marginBottom: 16,
  },
  pendingText: { color: '#1e40af', fontSize: 13, flex: 1 },
  questionCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  correctCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  incorrectCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  pendingCard: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qNumber: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  qPoints: { fontSize: 15, fontWeight: '700' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pendingBadgeText: { color: '#2563eb', fontSize: 11, fontWeight: '600' },
  qText: { fontSize: 15, color: '#1e293b', marginTop: 8, fontWeight: '500' },
  answerLabel: { fontSize: 12, color: '#64748b', marginTop: 8 },
  answerValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  backBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
