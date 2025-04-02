import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
const RefreshButton = ({ onRefresh }) => {
  return (
    <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
      <MaterialIcons name="refresh" size={24} color="white" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  refreshButton: {
    padding: 10,
  },
});

export default RefreshButton;
