import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { language } = useLanguage();
  const searchParams = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoButton, setShowDemoButton] = useState(false);

  useEffect(() => {
    // Check if demo parameter is present in URL
    if (searchParams.demo === "true") {
      setShowDemoButton(true);
    }
  }, [searchParams]);

  const t = {
    ja: {
      brandSubtitle: "魔法の絵本を作成するためにサインイン",
      emailPlaceholder: "メールアドレス",
      passwordPlaceholder: "パスワード",
      demoAccount: "デモアカウントを使用",
      signingIn: "サインイン中...",
      signIn: "サインイン",
      noAccount: "アカウントをお持ちでないですか？",
      signUp: "新規登録",
      errorTitle: "エラー",
      fillAllFields: "すべてのフィールドを入力してください。",
      loginFailed: "ログインに失敗しました。もう一度お試しください。",
    },
    en: {
      brandSubtitle: "Sign in to create magical storybooks",
      emailPlaceholder: "Email",
      passwordPlaceholder: "Password",
      demoAccount: "Use demo account",
      signingIn: "Signing in...",
      signIn: "Sign In",
      noAccount: "Don't have an account?",
      signUp: "Sign Up",
      errorTitle: "Error",
      fillAllFields: "Please fill in all fields.",
      loginFailed: "Login failed. Please try again.",
    },
  }[language];

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      Alert.alert(t.errorTitle, t.fillAllFields);
      return;
    }
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await login(email.trim(), password);
      // Navigation will be handled by root layout auth guard
    } catch (error) {
      Alert.alert(t.errorTitle, t.loginFailed);
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundAlt, Colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === "web" ? 67 + 40 : insets.top + 40,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          },
        ]}
        bottomOffset={20}
      >
        <View style={styles.brandSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="book" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.brandTitle}>Pashabook</Text>
          <Text style={styles.brandSubtitle}>
            {t.brandSubtitle}
          </Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={Colors.textTertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={t.emailPlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-email"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={Colors.textTertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={t.passwordPlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              testID="login-password"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Colors.textTertiary}
              />
            </Pressable>
          </View>

          {showDemoButton && (
            <Pressable
              onPress={() => {
                setEmail("pashabook@example.com");
                setPassword("Demo@1234");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.demoLink,
                pressed && { opacity: 0.6 },
              ]}
              testID="demo-login"
            >
              <Text style={styles.demoLinkText}>{t.demoAccount}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              isLoading && { opacity: 0.7 },
            ]}
            testID="login-submit"
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginGradient}
            >
              {isLoading ? (
                <Text style={styles.loginText}>{t.signingIn}</Text>
              ) : (
                <Text style={styles.loginText}>{t.signIn}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.noAccount}</Text>
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            hitSlop={8}
          >
            <Text style={styles.footerLink}>{t.signUp}</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  brandSection: {
    alignItems: "center",
    gap: 10,
    marginBottom: 48,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  brandSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  formSection: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    height: "100%",
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  demoLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.accent + "40",
    backgroundColor: Colors.accent + "08",
    marginTop: 4,
  },
  demoLinkText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  loginButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  loginGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  loginText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    paddingTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
