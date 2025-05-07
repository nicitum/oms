import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import moment from "moment";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";

const { width } = Dimensions.get('window');

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirm = (date) => {
    hideDatePicker();
    setSelectedDate(date);
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) throw new Error("Authentication token missing");

      const decodedToken = jwtDecode(token);
      const custId = decodedToken.id;
      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
      
      const response = await axios.get(
        `http://${ipAddress}:8091/get-orders/${custId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { date: formattedDate },
        }
      );

      if (response.data.status) {
        setOrders(response.data.orders);
      } else {
        throw new Error(response.data.message || "Failed to fetch orders");
      }
    } catch (error) {
      console.error("Error fetching order history:", error);
      Alert.alert("Error", "Failed to fetch orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchOrderProducts = async (orderId) => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) throw new Error("No authorization token found.");

      const response = await axios.get(
        `http://${ipAddress}:8091/order-products`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { orderId },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching order products:", error);
      Alert.alert("Error", "Failed to fetch order details.");
      return [];
    }
  };

  const handleOrderDetailsPress = async (orderId) => {
    if (expandedOrderDetailsId === orderId) {
      setExpandedOrderDetailsId(null);
    } else {
      setExpandedOrderDetailsId(orderId);
      if (!orderDetails[orderId]) {
        const products = await fetchOrderProducts(orderId);
        setOrderDetails(prev => ({ ...prev, [orderId]: products }));
      }
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      delivered: { bg: '#E8F5E9', text: '#2E7D32' },
      shipped: { bg: '#E3F2FD', text: '#1565C0' },
      processing: { bg: '#FFF3E0', text: '#EF6C00' },
      cancelled: { bg: '#FFEBEE', text: '#C62828' },
      pending: { bg: '#F5F5F5', text: '#616161' }
    };
    return statusColors[status?.toLowerCase()] || statusColors.pending;
  };

  const renderOrderDetails = (orderId) => {
    const products = orderDetails[orderId];
    if (!expandedOrderDetailsId || expandedOrderDetailsId !== orderId || !products) {
      return null;
    }

    return (
      <View style={styles.orderDetailsContainer}>
        <View style={styles.orderDetailsHeader}>
          <MaterialIcons name="shopping-bag" size={20} color="#003366" />
          <Text style={styles.orderDetailsTitle}>Order Items</Text>
        </View>
        
        {products.length > 0 ? (
          products.map((product, index) => (
            <View key={`${orderId}-${product.product_id}-${index}`} style={styles.productItem}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productQuantity}>Qty: {product.quantity}</Text>
              </View>
              <Text style={styles.productPrice}>₹{product.price}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyProductsContainer}>
            <MaterialIcons name="inbox" size={24} color="#666" />
            <Text style={styles.noProductsText}>No products found</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#003366" barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={showDatePicker}
        >
          <MaterialIcons name="event" size={20} color="#FFFFFF" />
          <Text style={styles.dateText}>
            {moment(selectedDate).format("MMM D")}
          </Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
        date={selectedDate}
      />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-outlined" size={64} color="#003366" />
            <Text style={styles.emptyStateTitle}>No Orders Found</Text>
            <Text style={styles.emptyStateSubtitle}>
              We couldn't find any orders for {moment(selectedDate).format("MMMM D, YYYY")}
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.orderDate}>
                    {moment.unix(order.placed_on).format("MMM D, YYYY [at] h:mm A")}
                  </Text>
                </View>
                <View style={[
                  styles.statusContainer,
                  { backgroundColor: getStatusColor(order.delivery_status).bg }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(order.delivery_status).text }
                  ]}>
                    {(order.delivery_status || "pending").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.orderSummary}>
                <View style={styles.totalContainer}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalAmount}>₹{order.total_amount}</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => handleOrderDetailsPress(order.id)}
                >
                  <Text style={styles.detailsButtonText}>
                    {expandedOrderDetailsId === order.id ? "Hide Details" : "View Details"}
                  </Text>
                  <MaterialIcons
                    name={expandedOrderDetailsId === order.id ? "expand-less" : "expand-more"}
                    size={20}
                    color="#003366"
                  />
                </TouchableOpacity>
              </View>

              {renderOrderDetails(order.id)}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    backgroundColor: "#003366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: 8,
    borderRadius: 8,
  },
  dateText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#003366",
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
  },
  orderDate: {
    fontSize: 13,
    color: "#666666",
    marginTop: 4,
  },
  statusContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderSummary: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: "#666666",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003366",
    marginTop: 2,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  detailsButtonText: {
    color: "#003366",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  orderDetailsContainer: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  orderDetailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orderDetailsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
    marginLeft: 8,
  },
  productItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  productInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "500",
  },
  productQuantity: {
    fontSize: 13,
    color: "#666666",
    marginTop: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#003366",
  },
  emptyProductsContainer: {
    alignItems: "center",
    padding: 24,
  },
  noProductsText: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
  },
});

export default OrdersPage;