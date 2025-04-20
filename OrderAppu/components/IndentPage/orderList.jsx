import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import OrderCard from "./orderCard";
import Toast from "react-native-toast-message";
import { ipAddress } from "../../urls";

const showToast = (message, type = "info") => {
  Toast.show({
      type,
      text1: type === "info" ? "Order Information" : "Time Restriction",
      text2: message,
      position: "top",
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 50,
      propsOverride: {
          text2Style: { flexWrap: "wrap", width: "100%" },
      },
  });
};

const OrdersList = ({ amOrder, pmOrder, selectedDate, navigation }) => {
  const handleOrderClick = async (order, shift) => {
      try {
          // If order exists, navigate to UpdateOrdersU
          if (order) {
              navigation.navigate("UpdateOrdersPage", { order, selectedDate, shift });
          
              showToast(`Navigating to update existing ${shift} order.`);
              return;
          }

          // Otherwise, check shift allowance for placing a new order
          const response = await fetch(`http://${ipAddress}:8090/allowed-shift?shift=${shift}`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          if (!data.allowed) {
              let errorMessage = "";
              if (shift === "AM") {
                  errorMessage = "AM orders can only be placed between 6:00 AM and 12:00 PM.";
              } else if (shift === "PM") {
                  errorMessage = "PM orders can only be placed between 12:00 PM and 4:00 PM.";
              }
              showToast(errorMessage, "error");
              return;
          }

          // Navigate to PlaceOrderPage if time is allowed and no order exists
          navigation.navigate("PlaceOrderPage", { order, selectedDate, shift });
          showToast(`Navigating to place new ${shift} order.`);

      } catch (error) {
          console.error("Error checking shift allowance:", error);
          showToast("Could not check order time. Please try again later.", "error");
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