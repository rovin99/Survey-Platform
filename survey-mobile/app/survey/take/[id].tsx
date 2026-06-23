import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { participantService } from '../../../services/participant.service';
import { Ionicons } from '@expo/vector-icons';

// Import question renderers
import SingleChoice from '../../../components/questions/SingleChoice';
import MultipleChoice from '../../../components/questions/MultipleChoice';
import TextQuestion from '../../../components/questions/TextInput';
import Rating from '../../../components/questions/Rating';

export default function SurveyTakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const tabSwitchCount = useRef(0);

  // Tab switch detection
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && session?.survey?.isQuiz) {
        tabSwitchCount.current++;
      }
    });
    return () => sub.remove();
  }, [session]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!session || Object.keys(answers).length === 0) return;
    const interval = setInterval(() => {
      participantService.saveDraft(session.session.id, null, {
        answers,
        currentQuestionIndex: currentIndex,
        tabSwitchCount: tabSwitchCount.current,
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [answers, session, currentIndex]);

  useEffect(() => {
    startSession();
  }, [id]);

  const startSession = async () => {
    try {
      const data = await participantService.startOrResumeSession(parseInt(id!));
      setSession(data);
      setQuestions(data.survey?.questions || []);

      // Restore draft
      if (data.draft?.draft_answers_content) {
        try {
          const draft = typeof data.draft.draft_answers_content === 'string'
            ? JSON.parse(data.draft.draft_answers_content)
            : data.draft.draft_answers_content;
          if (draft.answers) setAnswers(draft.answers);
          if (draft.currentQuestionIndex !== undefined) setCurrentIndex(draft.currentQuestionIndex);
          if (draft.tabSwitchCount) tabSwitchCount.current = draft.tabSwitchCount;
        } catch {}
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to load survey');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: number, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    Alert.alert('Submit', 'Are you sure you want to submit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setSubmitting(true);
          try {
            const answerArray = Object.entries(answers).map(([qId, value]) => ({
              questionId: parseInt(qId),
              responseData: JSON.stringify({ value }),
            }));

            await participantService.submitSurvey(session.session.id, {
              answers: answerArray,
              completedAt: new Date().toISOString(),
              tabSwitchCount: tabSwitchCount.current,
            });

            if (session.survey.isQuiz) {
              router.replace(`/survey/quiz-results/${session.session.id}`);
            } else {
              Alert.alert('Success', 'Survey submitted successfully!', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/participant') },
              ]);
            }
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to submit');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><Text>Loading survey...</Text></View>;
  }

  if (!session || questions.length === 0) {
    return <View style={styles.center}><Text>No questions found</Text></View>;
  }

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const renderQuestion = () => {
    const props = {
      question,
      value: answers[question.id],
      onChange: (value: any) => handleAnswer(question.id, value),
    };

    switch (question.questionType) {
      case 'single-choice': return <SingleChoice {...props} />;
      case 'multiple-choice': return <MultipleChoice {...props} />;
      case 'text': return <TextQuestion {...props} />;
      case 'rating': return <Rating {...props} />;
      default: return <Text style={styles.unsupported}>Question type "{question.questionType}" — open in web browser</Text>;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{session.survey.title}</Text>
        <Text style={styles.counter}>{currentIndex + 1}/{questions.length}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Question */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.questionType}>
          {question.questionType.replace('-', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          {question.mandatory && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.questionText}>{question.questionText}</Text>
        <View style={styles.answerArea}>
          {renderQuestion()}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={() => setCurrentIndex(i => i - 1)}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? '#d1d5db' : '#3b82f6'} />
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Previous</Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setCurrentIndex(i => i + 1)}>
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1e293b' },
  counter: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  progressBar: { height: 3, backgroundColor: '#e2e8f0' },
  progressFill: { height: 3, backgroundColor: '#3b82f6' },
  content: { flex: 1 },
  contentInner: { padding: 20 },
  questionType: { fontSize: 12, color: '#3b82f6', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: '#ef4444' },
  questionText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 8, lineHeight: 28 },
  answerArea: { marginTop: 24 },
  unsupported: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  navBtnTextDisabled: { color: '#d1d5db' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
