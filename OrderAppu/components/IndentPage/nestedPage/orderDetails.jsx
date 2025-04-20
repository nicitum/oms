import React from "react";
import { View, Text, StyleSheet } from "react-native";

const OrderDetails = ({ orderDetails, selectedDate, shift }) => { // Removed isEditable prop
    // Safety check: Ensure orderDetails and orderDetails.order are defined
    if (!orderDetails || !orderDetails.order) {
        return null; // Or return a message like <Text>No Order Details Available</Text>
    }

    const total_amount = orderDetails.order.total_amount;

    return (
        <View style={styles.orderInfoContainer}>
            {/* Order ID is always hidden as per your previous comment */}
            {/* {orderDetails.order.id && (
                <Text style={styles.orderText}>Order ID: {orderDetails.order.id}</Text>
            )} */}

            {/* <Text style={styles.orderText}>Delivery Date: {selectedDate}</Text> */}
            <Text style={styles.orderText}>Shift: {shift}</Text>

            {/* Total Amount is now always visible */}
            <Text style={styles.orderText}>Total Amount: ₹{total_amount}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    orderInfoContainer: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 15,
        margin: 10,
    },
    orderText: {
        fontSize: 16,
        marginVertical: 2,
    },
});

export default OrderDetails;