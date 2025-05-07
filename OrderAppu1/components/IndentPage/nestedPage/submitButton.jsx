import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

const SubmitButton = ({ handleSubmit }) => (
  <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
    <Text style={styles.submitButtonText}>Submit</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  submitButton: {
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#fff",
    padding: 10,
    margin: 10,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
});

export default SubmitButton;
