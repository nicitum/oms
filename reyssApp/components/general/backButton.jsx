import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

const BackButton = ({ navigation }) => (
  <TouchableOpacity
    style={styles.headerText}
    onPress={() => navigation.goBack()}
  >
    <Text style={styles.backButtonText}>Back</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 10,
    color: "#fff",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default BackButton;
