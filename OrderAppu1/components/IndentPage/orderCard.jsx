import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import moment from "moment";

const OrderCard = ({ shift, order, selectedDate, onOrderClick }) => {
  const isPastDate = moment(selectedDate, "YYYY-MM-DD").isBefore(
    moment().startOf("day")
  );

  const showArrowButton = order || (!order && !isPastDate);

  const getDeliveryInfo = (shift) => {
    if (shift === "AM") {
      return "Same day delivery";
    } else if (shift === "PM") {
      return "Next day 5AM";
    }
    return "";
  };

  const getShiftIcon = (shift) => {
    if (shift === "AM") {
      return "wb-sunny";
    } else if (shift === "PM") {
      return "nights-stay";
    }
    return "schedule";
  };

  return (
    <TouchableOpacity
      style={[styles.card, !showArrowButton && styles.disabledCard]}
      onPress={() => showArrowButton && onOrderClick(order, shift, selectedDate)}
      disabled={!showArrowButton}
    >
      <View style={styles.cardHeader}>
        <View style={styles.shiftContainer}>
          <MaterialIcons
            name={getShiftIcon(shift)}
            size={24}
            color="#003366"
            style={styles.shiftIcon}
          />
          <Text style={styles.shiftText}>{shift}</Text>
        </View>
        <View style={styles.deliveryBadge}>
          <MaterialIcons name="local-shipping" size={16} color="#003366" />
          <Text style={styles.deliveryText}>{getDeliveryInfo(shift)}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.dateContainer}>
          <MaterialIcons name="event" size={20} color="#666666" />
          <Text style={styles.dateText}>
            {moment(selectedDate, "YYYY-MM-DD").format("DD MMM YYYY")}
          </Text>
        </View>

        {order ? (
          <View style={styles.orderDetails}>
            <View style={styles.orderIdContainer}>
              <MaterialIcons name="receipt" size={20} color="#666666" />
              <Text style={styles.orderId}>Order #{order.orderId}</Text>
            </View>
            <View style={styles.orderInfo}>
              <View style={styles.infoItem}>
                <MaterialIcons name="shopping-cart" size={20} color="#666666" />
                <Text style={styles.infoText}>Qty: {order.quantity}</Text>
              </View>
              <View style={styles.infoItem}>
                
                <Text style={styles.infoText}>₹{order.totalAmount}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noOrderContainer}>
            <MaterialIcons name="add-shopping-cart" size={24} color="#666666" />
            <Text style={styles.noOrderText}>No Order Placed</Text>
          </View>
        )}
      </View>

      {showArrowButton && (
        <View style={styles.actionContainer}>
          <MaterialIcons name="arrow-forward" size={24} color="#003366" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#003366",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  shiftContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  shiftIcon: {
    marginRight: 8,
  },
  shiftText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#003366",
  },
  deliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  deliveryText: {
    fontSize: 14,
    color: "#003366",
    marginLeft: 4,
    fontWeight: "500",
  },
  cardContent: {
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 8,
  },
  orderDetails: {
    gap: 12,
  },
  orderIdContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderId: {
    fontSize: 16,
    color: "#333333",
    marginLeft: 8,
    fontWeight: "500",
  },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#333333",
    marginLeft: 8,
    fontWeight: "500",
  },
  noOrderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 8,
  },
  noOrderText: {
    fontSize: 16,
    color: "#666666",
    marginLeft: 8,
    fontStyle: "italic",
  },
  actionContainer: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: [{ translateY: -12 }],
  },
});

export default OrderCard;