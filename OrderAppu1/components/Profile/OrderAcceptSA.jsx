import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { Checkbox, Card, Button, Searchbar } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../../urls";
import moment from "moment";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  primary: '#003366',
  secondary: '#004d99',
  accent: '#0066cc',
  background: '#f5f7fa',
  surface: '#ffffff',
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    light: '#ffffff',
  },
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  status: {
    pending: '#ff9800',
    accepted: '#4caf50',
    altered: '#2196f3',
  }
};

const OrderAcceptSA = () => {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState({});
  const [selectAllOrders, setSelectAllOrders] = useState(false);
  const [token, setToken] = useState(null);
  const [processingOrderIds, setProcessingOrderIds] = useState({});

  // Memoized AM and PM orders with explicit dependency on orders
  const amOrders = useMemo(() => 
    orders.filter(order => order.order_type === "AM"),
    [orders]
  );
  
  const pmOrders = useMemo(() => 
    orders.filter(order => order.order_type === "PM"),
    [orders]
  );

  // Get token once and cache it
  const getToken = useCallback(async () => {
    if (token) return token;
    
    const storedToken = await AsyncStorage.getItem("userAuthToken");
    if (!storedToken) {
      throw new Error("Authentication token not found. Please log in.");
    }
    setToken(storedToken);
    return storedToken;
  }, [token]);

  // Fetch all users
  const fetchAllUsers = useCallback(async () => {
    try {
      const authToken = await getToken();
      const url = `http://${ipAddress}:8091/allUsers/`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const responseJson = await response.json();
      return responseJson?.data?.length ? responseJson.data : [];
    } catch (fetchError) {
      throw new Error(fetchError.message || "Failed to fetch users.");
    }
  }, [getToken]);

  // Fetch all orders
  const fetchAllOrders = useCallback(async () => {
    try {
      const authToken = await getToken();
      const todayFormatted = moment().format("YYYY-MM-DD");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await axios.get(
        `http://${ipAddress}:8091/get-orders-sa?date=${todayFormatted}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.data?.status) {
        throw new Error(response.data?.message || "No valid data received");
      }
      
      return response.data.orders || [];
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch orders");
    }
  }, [getToken]);

  // Combined fetch function
  const fetchData = useCallback(async (showFullLoading = true) => {
    if (showFullLoading) setLoading(true);
    setError(null);
    
    try {
      const [fetchedUsers, fetchedOrders] = await Promise.all([
        fetchAllUsers(),
        fetchAllOrders()
      ]);
      
      setUsers(fetchedUsers);
      setOrders(fetchedOrders);
      setSelectedOrderIds({});
      setSelectAllOrders(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message,
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAllUsers, fetchAllOrders]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  // Fetch data on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
      return () => {
        setOrders([]);
        setUsers([]);
      };
    }, [fetchData])
  );

  // Handle select all orders
  useEffect(() => {
    if (selectAllOrders && orders.length > 0) {
      const allOrderIds = orders.reduce((acc, order) => {
        acc[order.id] = true;
        return acc;
      }, {});
      setSelectedOrderIds(allOrderIds);
    } else if (!selectAllOrders) {
      setSelectedOrderIds({});
    }
  }, [selectAllOrders, orders]);

  // Update order status in state
  const updateOrderStatusInState = useCallback((orderId, status) => {
    setOrders(prevOrders => {
      const newOrders = prevOrders.map(order => 
        order.id === orderId ? { ...order, approve_status: status } : order
      );
      return [...newOrders]; // Ensure new array reference
    });
    
    setProcessingOrderIds(prev => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });
  }, []);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((orderId, isSelected) => {
    setSelectedOrderIds(prev => {
      const updated = { ...prev };
      if (isSelected) {
        updated[orderId] = true;
      } else {
        delete updated[orderId];
      }
      return updated;
    });
  }, []);

  // Handle single order approval
  const handleSingleApprove = useCallback(async (orderId) => {
    try {
      setProcessingOrderIds(prev => ({ ...prev, [orderId]: true }));
      
      const authToken = await getToken();
      const response = await fetch(`http://${ipAddress}:8091/update-order-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: orderId, approve_status: "Accepted" }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        updateOrderStatusInState(orderId, "Accepted");
        
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Order approved successfully",
          position: "bottom",
        });
      } else {
        throw new Error(result.message || "Failed to approve order");
      }
    } catch (err) {
      console.error(`Error approving order ${orderId}:`, err);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: `Failed to approve order #${orderId}`,
        position: "bottom",
      });
      
      setProcessingOrderIds(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
    }
  }, [getToken, updateOrderStatusInState]);

  // Handle bulk approve
  const handleBulkApprove = useCallback(async () => {
    const orderIdsToApprove = Object.keys(selectedOrderIds).map(id => parseInt(id));
    if (orderIdsToApprove.length === 0) {
      Alert.alert("No Orders Selected", "Please select orders to approve.");
      return;
    }

    setLoading(true);
    
    const processingIds = orderIdsToApprove.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    setProcessingOrderIds(processingIds);
    
    try {
      const authToken = await getToken();
      const batchSize = 5;
      for (let i = 0; i < orderIdsToApprove.length; i += batchSize) {
        const batch = orderIdsToApprove.slice(i, i + batchSize);
        
        const results = await Promise.all(
          batch.map(orderId => 
            fetch(`http://${ipAddress}:8091/update-order-status`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: orderId, approve_status: "Accepted" }),
            })
            .then(res => res.json())
            .then(data => ({ id: orderId, success: data.success }))
            .catch(err => ({ id: orderId, success: false, error: err }))
          )
        );
        
        results.forEach(result => {
          if (result.success) {
            updateOrderStatusInState(result.id, "Accepted");
          } else {
            console.error(`Failed to approve order ${result.id}:`, result.error);
            setProcessingOrderIds(prev => {
              const updated = { ...prev };
              delete updated[result.id];
              return updated;
            });
          }
        });
      }

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Selected orders approved successfully",
        position: "bottom",
      });
      
      setSelectedOrderIds({});
      setSelectAllOrders(false);
    } catch (err) {
      console.error("Error bulk approving orders:", err);
      Alert.alert("Error", "Failed to approve some orders. Please try again.");
      setProcessingOrderIds({});
    } finally {
      setLoading(false);
    }
  }, [selectedOrderIds, getToken, updateOrderStatusInState]);

  // Get user orders
  const getUserOrders = useCallback((userId) => {
    const userAMOrders = amOrders.filter(order => order.customer_id === userId);
    const userPMOrders = pmOrders.filter(order => order.customer_id === userId);
    return { userAMOrders, userPMOrders };
  }, [amOrders, pmOrders]);

  // Enhanced UserCard component
  const UserCard = ({ user }) => {
    const { userAMOrders, userPMOrders } = getUserOrders(user.customer_id);
    const [expanded, setExpanded] = useState(true);

    if (userAMOrders.length === 0 && userPMOrders.length === 0) {
      return null;
    }

    return (
      <Card style={styles.userCard}>
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Card.Content style={styles.userHeader}>
            <View style={styles.userInfo}>
              <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.userMeta}>
                  <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.userRoute}>{user.route}</Text>
                </View>
              </View>
            </View>
            <MaterialCommunityIcons 
              name={expanded ? "chevron-down" : "chevron-right"} 
              size={24} 
              color={COLORS.primary} 
            />
          </Card.Content>
        </TouchableOpacity>

        {expanded && (
          <Card.Content style={styles.ordersContainer}>
            {userAMOrders.length > 0 && (
              <View style={styles.orderTypeSection}>
                <View style={styles.orderTypeHeader}>
                  <MaterialCommunityIcons name="weather-sunny" size={20} color={COLORS.warning} />
                  <Text style={styles.orderTypeTitle}>AM Orders</Text>
                </View>
                {userAMOrders.map(order => (
                  <OrderItem key={order.id} order={order} />
                ))}
              </View>
            )}

            {userPMOrders.length > 0 && (
              <View style={styles.orderTypeSection}>
                <View style={styles.orderTypeHeader}>
                  <MaterialCommunityIcons name="weather-night" size={20} color={COLORS.primary} />
                  <Text style={styles.orderTypeTitle}>PM Orders</Text>
                </View>
                {userPMOrders.map(order => (
                  <OrderItem key={order.id} order={order} />
                ))}
              </View>
            )}
          </Card.Content>
        )}
      </Card>
    );
  };

  // Enhanced OrderItem component
  const OrderItem = ({ order }) => {
    const isProcessing = processingOrderIds[order.id];
    const isApproved = order.approve_status === "Accepted";

    return (
      <Card style={styles.orderCard}>
        <Card.Content>
          <View style={styles.orderRow}>
            <Checkbox
              status={selectedOrderIds[order.id] ? "checked" : "unchecked"}
              onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
              color={COLORS.primary}
              disabled={isApproved || isProcessing}
            />
            <View style={styles.orderDetails}>
              <View style={styles.orderMeta}>
                <Text style={styles.orderLabel}>Order ID:</Text>
                <Text style={styles.orderValue}>#{order.id}</Text>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderLabel}>Date:</Text>
                <Text style={styles.orderValue}>
                  {moment.unix(order.placed_on).format("DD MMM YYYY")}
                </Text>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderLabel}>Amount:</Text>
                <Text style={styles.orderValue}>
                  ₹{order.total_amount || order.amount || "N/A"}
                </Text>
              </View>
            </View>
            
            <View style={styles.orderStatus}>
              {order.altered === "Yes" ? (
                <View style={[styles.statusBadge, { backgroundColor: `${COLORS.status.altered}20` }]}>
                  <Text style={[styles.statusText, { color: COLORS.status.altered }]}>Altered</Text>
                </View>
              ) : isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: `${isApproved ? COLORS.status.accepted : COLORS.status.pending}20` }
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      { color: isApproved ? COLORS.status.accepted : COLORS.status.pending }
                    ]}>
                      {isApproved ? "Accepted" : "Pending"}
                    </Text>
                  </View>
                  {!isApproved && (
                    <TouchableOpacity 
                      style={styles.quickApproveButton}
                      onPress={() => handleSingleApprove(order.id)}
                    >
                      <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Memoized list of users with orders
  const usersWithOrders = useMemo(() => {
    return users.filter(user => {
      const { userAMOrders, userPMOrders } = getUserOrders(user.customer_id);
      return userAMOrders.length > 0 || userPMOrders.length > 0;
    });
  }, [users, getUserOrders]);

  return (
    <View style={styles.container}>
      <Animated.View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="clipboard-check" size={28} color={COLORS.text.light} />
          <Text style={styles.headerTitle}>Order Approvals</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => fetchData()}
            disabled={loading}
          >
            <MaterialCommunityIcons name="refresh" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.contentContainer}>
        <Card style={styles.bulkActionsCard}>
          <Card.Content>
            <View style={styles.bulkActionsContainer}>
              <View style={styles.selectAllContainer}>
                <Checkbox
                  status={selectAllOrders ? "checked" : "unchecked"}
                  onPress={() => setSelectAllOrders(!selectAllOrders)}
                  color={COLORS.primary}
                  disabled={!orders.length || loading}
                />
                <Text style={[styles.selectAllText, (!orders.length || loading) && styles.disabledText]}>
                  Select All Orders
                </Text>
              </View>
              <Button
                mode="contained"
                onPress={handleBulkApprove}
                style={[
                  styles.bulkApproveButton,
                  (!Object.keys(selectedOrderIds).length || loading) && styles.disabledButton
                ]}
                labelStyle={styles.bulkApproveButtonLabel}
                disabled={!Object.keys(selectedOrderIds).length || loading}
                icon="check-circle"
                loading={loading && Object.keys(selectedOrderIds).length > 0}
              >
                {loading && Object.keys(selectedOrderIds).length > 0 ? "Processing..." : "Approve Selected"}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Card style={styles.errorCard}>
              <Card.Content>
                <View style={styles.errorContent}>
                  <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </Card.Content>
            </Card>
            <Button
              mode="contained"
              onPress={() => fetchData()}
              style={styles.retryButton}
              labelStyle={styles.retryButtonText}
            >
              Retry
            </Button>
          </View>
        ) : orders.length > 0 ? (
          <FlatList
            data={usersWithOrders}
            keyExtractor={(item) => item.customer_id.toString()}
            renderItem={({ item }) => <UserCard user={item} />}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[COLORS.primary]} 
              />
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons name="inbox" size={40} color={COLORS.text.secondary} />
              <Text style={styles.emptyText}>No orders found</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh</Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: 40,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text.light,
    marginLeft: 10,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  bulkActionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  bulkActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectAllContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectAllText: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "500",
  },
  disabledText: {
    color: COLORS.text.secondary,
  },
  bulkApproveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: `${COLORS.primary}50`,
  },
  bulkApproveButtonLabel: {
    color: COLORS.text.light,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 16,
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  userRoute: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  ordersContainer: {
    marginTop: 8,
  },
  orderTypeSection: {
    marginBottom: 16,
  },
  orderTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderTypeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginLeft: 8,
  },
  orderCard: {
    backgroundColor: `${COLORS.primary}05`,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderDetails: {
    flex: 1,
    marginLeft: 8,
  },
  orderMeta: {
    flexDirection: "row",
    marginBottom: 4,
  },
  orderLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    width: 70,
  },
  orderValue: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: "500",
  },
  orderStatus: {
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickApproveButton: {
    marginLeft: 8,
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  errorCard: {
    backgroundColor: `${COLORS.error}10`,
    width: "100%",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  errorText: {
    color: COLORS.error,
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.text.light,
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 24,
    elevation: 2,
    alignItems: "center",
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },
});

export default OrderAcceptSA;