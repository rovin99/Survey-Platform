import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)/participant');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!magicEmail.trim() || !magicEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setMagicLoading(true);
    try {
      const response = await api.post('/api/auth/request-magic-link', { email: magicEmail.trim() });
      console.log('Magic link response:', response.data);
      setMagicSent(true);
    } catch (err: any) {
      console.error('Magic link error:', err.message, err.response?.status, err.response?.data);
      setError(err.response?.data?.message || err.message || 'Failed to send magic link');
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="clipboard-outline" size={48} color="#3b82f6" />
          <Text style={styles.title}>Survey Platform</Text>
          <Text style={styles.subtitle}>
            {showMagicLink ? 'Sign in with Magic Link' : 'Sign in to your account'}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {magicSent ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Magic link sent!</Text>
              <Text style={styles.successText}>
                Check {magicEmail} for a sign-in link. Open it in your browser.
              </Text>
            </View>
          </View>
        ) : showMagicLink ? (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                value={magicEmail}
                onChangeText={(t) => { setMagicEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.button, magicLoading && styles.buttonDisabled]}
              onPress={handleMagicLink}
              disabled={magicLoading}
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.buttonText}>{magicLoading ? 'Sending...' : 'Send Magic Link'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchBtn} onPress={() => { setShowMagicLink(false); setError(''); }}>
              <Text style={styles.switchText}>Back to password login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={(t) => { setUsername(t); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.magicButton}
              onPress={() => { setShowMagicLink(true); setError(''); }}
            >
              <Ionicons name="mail-outline" size={20} color="#3b82f6" />
              <Text style={styles.magicButtonText}>Sign in with Magic Link</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" style={styles.link}>
                <Text style={styles.linkText}>Register</Text>
              </Link>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 12 },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
  form: { gap: 14 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#e2e8f0', height: 52,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  button: {
    backgroundColor: '#3b82f6', borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { marginHorizontal: 12, color: '#94a3b8', fontSize: 13 },
  magicButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#3b82f6', borderRadius: 12, height: 52,
  },
  magicButtonText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  switchBtn: { alignItems: 'center', paddingVertical: 8 },
  switchText: { color: '#3b82f6', fontSize: 14, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', padding: 12, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#ecfdf5', padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#a7f3d0',
  },
  successTitle: { color: '#059669', fontSize: 16, fontWeight: '600' },
  successText: { color: '#065f46', fontSize: 14, marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  footerText: { color: '#64748b', fontSize: 14 },
  link: {},
  linkText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
});
