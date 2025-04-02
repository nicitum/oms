import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import OrderCard from "./orderCard";
import Toast from "react-native-toast-message";
import { ipAddress } from "../../urls";

const OrdersList = ({ amOrder, pmOrder, selectedDate, navigation }) => {
  const handleOrderClick = async (order, shift) => {
    try {
      const response = await fetch(`http://${ipAddress}:8090/allowed-shift?shift=${shift}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (!data.allowed) {
        const errorMessage =
          shift === "AM"
            ? "AM orders are only allowed between 6:00 AM and 12:00 PM."
            : "PM orders are only allowed between 12:00 PM and 4:00 PM.";
        Toast.show({
          type: "error",
          text1: "Time Restriction",
          text2: errorMessage,
          position: "top",
          topOffset: 60,
        });
        return;
      }

      navigation.navigate("PlaceOrderPage", { order, selectedDate, shift });
      Toast.show({
        type: "success",
        text1: "Order Info",
        text2: order ? `Viewing ${shift} order details` : `Placing a new ${shift} order`,
        position: "top",
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error checking shift allowance:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to verify order time. Try again later.",
        position: "top",
        topOffset: 60,
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <OrderCard
          shift="AM"
          order={amOrder}
          selectedDate={selectedDate}
          onOrderClick={handleOrderClick}
        />
        <OrderCard
          shift="PM"
          order={pmOrder}
          selectedDate={selectedDate}
          onOrderClick={handleOrderClick}
        />
      </ScrollView>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 20,
  },
});

export default OrdersList;