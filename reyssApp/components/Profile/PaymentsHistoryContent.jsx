import React from "react";
import { View, Text, StyleSheet } from "react-native";

const PaymentsHistoryContent = () => {
  return (
    <View style={styles.contentContainer}>
      <Text style={styles.title}>Payment History</Text>
      <Text>List of your recent payments:</Text>
      {/* Add history of payments */}
    </View>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
});

export default PaymentsHistoryContent;
