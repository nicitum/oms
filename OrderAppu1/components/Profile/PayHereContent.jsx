import React from "react";
import { View, Text, StyleSheet } from "react-native";

const PayHereContent = () => {
  return (
    <View style={styles.contentContainer}>
      <Text style={styles.title}>Pay Here</Text>
      <Text>You can make payments for your pending orders here.</Text>
      {/* Add payment form or instructions */}
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

export default PayHereContent;
