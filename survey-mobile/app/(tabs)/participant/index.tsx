import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { participantService } from '../../../services/participant.service';
import { useAuth } from '../../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface SurveyEntry {
  sessionId: number;
  surveyId: number;
  surveyTitle: string;
  status: string;
  isQuiz: boolean;
  score?: number;
  totalPoints?: number;
  percentage?: number;
  passed?: boolean;
  completedAt?: string;
  timeTakenSeconds?: number;
}

export default function ParticipantDashboard() {
  const [history, setHistory] = useState<{ inProgress: SurveyEntry[]; completed: SurveyEntry[] }>({ inProgress: [], completed: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const data = await participantService.getMyHistory();
      const inProgress = (data.surveys || []).filter((s: SurveyEntry) => s.status === 'IN_PROGRESS');
      const completed = (data.surveys || []).filter((s: SurveyEntry) => s.status === 'COMPLETED');
      setHistory({ inProgress, completed });
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const renderSurvey = ({ item }: { item: SurveyEntry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (item.status === 'IN_PROGRESS') {
          router.push(`/survey/take/${item.surveyId}`);
        } else if (item.isQuiz) {
          router.push(`/survey/quiz-results/${item.sessionId}`);
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.surveyTitle}</Text>
        <View style={styles.badges}>
          {item.isQuiz && <View style={styles.quizBadge}><Text style={styles.quizBadgeText}>Quiz</Text></View>}
          {item.status === 'IN_PROGRESS' && <View style={styles.progressBadge}><Text style={styles.progressBadgeText}>In Progress</Text></View>}
          {item.passed === true && <View style={styles.passBadge}><Text style={styles.passBadgeText}>Passed</Text></View>}
          {item.passed === false && <View style={styles.failBadge}><Text style={styles.failBadgeText}>Failed</Text></View>}
        </View>
      </View>
      {item.status === 'COMPLETED' && item.isQuiz && item.percentage !== undefined && (
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>{Math.round(item.percentage)}%</Text>
          <Text style={styles.scoreDetail}>{item.score}/{item.totalPoints} pts</Text>
          {item.timeTakenSeconds && <Text style={styles.timeText}>{formatTime(item.timeTakenSeconds)}</Text>}
        </View>
      )}
      {item.status === 'IN_PROGRESS' && (
        <View style={styles.resumeRow}>
          <Ionicons name="play-circle-outline" size={16} color="#3b82f6" />
          <Text style={styles.resumeText}>Tap to continue</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.username || 'Participant'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{history.inProgress.length + history.completed.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{history.inProgress.length}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{history.completed.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <FlatList
        data={[...history.inProgress, ...history.completed]}
        keyExtractor={(item) => `${item.sessionId}`}
        renderItem={renderSurvey}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No surveys yet</Text>
            <Text style={styles.emptySubtext}>Your surveys will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  greeting: { fontSize: 14, color: '#64748b' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1, marginRight: 8 },
  badges: { flexDirection: 'row', gap: 4 },
  quizBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  quizBadgeText: { color: '#2563eb', fontSize: 11, fontWeight: '600' },
  progressBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  progressBadgeText: { color: '#d97706', fontSize: 11, fontWeight: '600' },
  passBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  passBadgeText: { color: '#059669', fontSize: 11, fontWeight: '600' },
  failBadge: { backgroundColor: '#fce7f3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  failBadgeText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  scoreText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  scoreDetail: { fontSize: 13, color: '#64748b' },
  timeText: { fontSize: 13, color: '#64748b' },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  resumeText: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#9ca3af', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#d1d5db', marginTop: 4 },
});
