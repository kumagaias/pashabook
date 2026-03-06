import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface Props {
  selected: "ja" | "en";
  onSelect: (lang: "ja" | "en") => void;
}

export default function LanguagePicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onSelect("ja")}
        style={[styles.option, selected === "ja" && styles.optionSelected]}
      >
        <Text style={styles.flag}>JP</Text>
        <Text style={[styles.label, selected === "ja" && styles.labelSelected]}>
          Japanese
        </Text>
        {selected === "ja" && (
          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
        )}
      </Pressable>
      <Pressable
        onPress={() => onSelect("en")}
        style={[styles.option, selected === "en" && styles.optionSelected]}
      >
        <Text style={styles.flag}>EN</Text>
        <Text style={[styles.label, selected === "en" && styles.labelSelected]}>
          English
        </Text>
        {selected === "en" && (
          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "08",
  },
  flag: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    width: 32,
    height: 32,
    lineHeight: 32,
    textAlign: "center",
    backgroundColor: Colors.primary + "15",
    borderRadius: 8,
    overflow: "hidden",
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  labelSelected: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
