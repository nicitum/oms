import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import moment from "moment";

const OrderCard = ({ shift, order, selectedDate, onOrderClick }) => {
  const isPastDate = moment(selectedDate, "YYYY-MM-DD").isBefore(moment(), "day");
  const showArrowButton = order || (!order && !isPastDate);

  const getDeliveryInfo = (shift) => {
    return shift === "AM" ? "Same Day Delivery" : "Next Day 5AM";
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.shift}>{shift}</Text>
        <Text style={styles.deliveryInfo}>{getDeliveryInfo(shift)}</Text>
      </View>
      <View style={styles.contentRow}>
        <View style={styles.details}>
          <Text style={styles.date}>
            {moment(selectedDate, "YYYY-MM-DD").format("DD MMM YYYY")}
          </Text>
          {order ? (
            <>
              <Text style={styles.info}>Qty: {order.quantity}</Text>
              <Text style={styles.info}>Total: ₹{order.totalAmount}</Text>
            </>
          ) : (
            <Text style={styles.noOrder}>No Order Placed</Text>
          )}
        </View>
        {showArrowButton && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onOrderClick(order, shift, selectedDate)}
          >
            <MaterialIcons name="chevron-right" size={26} color="#003366" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 15,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#003366", // Blue accent
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  shift: {
    fontSize: 20,
    fontWeight: "700",
    color: "#003366",
  },
  deliveryInfo: {
    fontSize: 12,
    color: "#003366",
    fontWeight: "600",
    backgroundColor: "#E6ECF5", // Light blue background
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  contentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  details: {
    flex: 1,
  },
  date: {
    fontSize: 14,
    color: "#555555",
    marginBottom: 4,
  },
  info: {
    fontSize: 15,
    color: "#333333",
    fontWeight: "500",
    marginVertical: 2,
  },
  noOrder: {
    fontSize: 15,
    color: "#D32F2F",
    fontStyle: "italic",
    marginVertical: 2,
  },
  actionButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default OrderCard;