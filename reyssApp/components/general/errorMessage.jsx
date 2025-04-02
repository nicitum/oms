import React from "react";
import { View, Text, StyleSheet } from "react-native";

const ErrorMessage = ({ message }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  errorContainer: {
    padding: 10,
    margin: 10,
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "red",
  },
});

export default ErrorMessage;
