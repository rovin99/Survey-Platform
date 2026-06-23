import { Stack } from 'expo-router';

export default function SurveyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="take/[id]" />
      <Stack.Screen name="quiz-results/[id]" />
    </Stack>
  );
}
