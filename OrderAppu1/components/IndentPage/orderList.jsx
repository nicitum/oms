import React from "react";
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import OrderCard from "./orderCard";
import Toast from "react-native-toast-message";
import { ipAddress } from "../../urls";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

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
          if (order) {
              navigation.navigate("UpdateOrdersPage", { order, selectedDate, shift });
              showToast(`Navigating to update existing ${shift} order.`);
              return;
          }

          const response = await fetch(`http://${ipAddress}:8091/allowed-shift?shift=${shift}`);
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

          navigation.navigate("PlaceOrderPage", { order, selectedDate, shift });
          showToast(`Navigating to place new ${shift} order.`);
      } catch (error) {
          console.error("Error checking shift allowance:", error);
          showToast("Could not check order time. Please try again later.", "error");
      }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.dateContainer}>
          <MaterialIcons name="event" size={20} color="#003366" />
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shiftSection}>
          <View style={styles.shiftHeader}>
            <MaterialIcons name="wb-sunny" size={20} color="#003366" />
            <Text style={styles.shiftTitle}>Morning Shift (AM)</Text>
          </View>
        <OrderCard
          shift="AM"
          order={amOrder}
          selectedDate={selectedDate}
          onOrderClick={handleOrderClick}
        />
        </View>

        <View style={styles.shiftSection}>
          <View style={styles.shiftHeader}>
            <MaterialIcons name="nights-stay" size={20} color="#003366" />
            <Text style={styles.shiftTitle}>Evening Shift (PM)</Text>
          </View>
        <OrderCard
          shift="PM"
          order={pmOrder}
          selectedDate={selectedDate}
          onOrderClick={handleOrderClick}
        />
        </View>
      </ScrollView>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#003366",
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
    padding: 8,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#003366",
    marginLeft: 8,
    fontWeight: "500",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  shiftSection: {
    marginBottom: 24,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f0f4f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  shiftTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#003366",
    marginLeft: 8,
  },
});

export default OrdersList;