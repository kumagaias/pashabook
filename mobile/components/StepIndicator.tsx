import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface Step {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: Step[] = [
  { key: "analyzing", label: "Analyzing", icon: "eye-outline" },
  { key: "generating_story", label: "Story", icon: "book-outline" },
  { key: "generating_illustrations", label: "Illustrating", icon: "color-palette-outline" },
  { key: "generating_narration", label: "Narration", icon: "mic-outline" },
  { key: "generating_animation", label: "Animating", icon: "film-outline" },
  { key: "compositing", label: "Compositing", icon: "videocam-outline" },
];

function StepDot({ step, isActive, isComplete }: { step: Step; isActive: boolean; isComplete: boolean }) {
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      opacity.value = withTiming(1, { duration: 300 });
    } else if (isComplete) {
      pulse.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      pulse.value = 1;
      opacity.value = withTiming(0.4, { duration: 300 });
    }
  }, [isActive, isComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.stepItem}>
      <Animated.View
        style={[
          styles.stepDot,
          isComplete && styles.stepDotComplete,
          isActive && styles.stepDotActive,
          animatedStyle,
        ]}
      >
        {isComplete ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : (
          <Ionicons
            name={step.icon}
            size={16}
            color={isActive ? "#fff" : Colors.textTertiary}
          />
        )}
      </Animated.View>
      <Text
        style={[
          styles.stepLabel,
          isActive && styles.stepLabelActive,
          isComplete && styles.stepLabelComplete,
        ]}
      >
        {step.label}
      </Text>
    </View>
  );
}

export default function StepIndicator({ currentStep }: { currentStep: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.key}>
          <StepDot
            step={step}
            isActive={index === currentIndex}
            isComplete={index < currentIndex}
          />
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.connector,
                index < currentIndex && styles.connectorComplete,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  stepItem: {
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.shimmer,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotComplete: {
    backgroundColor: Colors.success,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  stepLabelComplete: {
    color: Colors.success,
  },
  connector: {
    height: 2,
    flex: 1,
    backgroundColor: Colors.shimmer,
    marginBottom: 20,
    marginHorizontal: 2,
  },
  connectorComplete: {
    backgroundColor: Colors.success,
  },
});
