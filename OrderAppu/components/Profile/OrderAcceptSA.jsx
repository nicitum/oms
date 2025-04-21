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
} from "react-native";
import { Checkbox, Card, Button } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../../urls";
import moment from "moment";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import Icon from "react-native-vector-icons/MaterialIcons";

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
      const url = `http://${ipAddress}:8090/allUsers/`;
      
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
        `http://${ipAddress}:8090/get-orders-sa?date=${todayFormatted}`,
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
      const response = await fetch(`http://${ipAddress}:8090/update-order-status`, {
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
            fetch(`http://${ipAddress}:8090/update-order-status`, {
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

  // Render order item
  const renderOrderItem = useCallback(({ order }) => {
    const isProcessing = processingOrderIds[order.id];
    const isApproved = order.approve_status === "Accepted";
    
    return (
      <Card key={order.id} style={styles.orderCard}>
        <Card.Content>
          <View style={styles.orderRow}>
            <Checkbox
              status={selectedOrderIds[order.id] ? "checked" : "unchecked"}
              onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
              color="#003366"
              disabled={isApproved || isProcessing}
            />
            <View style={styles.orderDetails}>
              <View style={styles.orderMeta}>
                <Text style={styles.orderLabel}>Order ID:</Text>
                <Text style={styles.orderValue}>{order.id}</Text>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderLabel}>Date:</Text>
                <Text style={styles.orderValue}>
                  {moment.unix(order.placed_on).format("DD MMM")}
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
                <Text style={styles.alteredStatus}>Altered</Text>
              ) : isProcessing ? (
                <ActivityIndicator size="small" color="#003366" />
              ) : (
                <>
                  <Text
                    style={isApproved ? styles.acceptedStatus : styles.pendingStatus}
                  >
                    {isApproved ? "Accepted" : "Pending"}
                  </Text>
                  {!isApproved && (
                    <TouchableOpacity 
                      style={styles.quickApproveButton}
                      onPress={() => handleSingleApprove(order.id)}
                    >
                      <Icon name="check-circle" size={20} color="#28a745" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  }, [selectedOrderIds, processingOrderIds, handleCheckboxChange, handleSingleApprove]);

  // Render user card
  const renderUserCard = useCallback(({ item }) => {
    const { userAMOrders, userPMOrders } = getUserOrders(item.customer_id);
    
    if (userAMOrders.length === 0 && userPMOrders.length === 0) {
      return null;
    }
    
    return (
      <Card style={styles.userCard} key={item.customer_id}>
        <Card.Content>
          <View style={styles.userHeader}>
            <Icon name="person" size={24} color="#003366" />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <View style={styles.userMeta}>
                <Icon name="place" size={14} color="#666" />
                <Text style={styles.userRoute}>{item.route}</Text>
              </View>
            </View>
          </View>

          <View style={styles.ordersContainer}>
            {userAMOrders.length > 0 && (
              <View style={styles.orderTypeSection}>
                <View style={styles.orderTypeHeader}>
                  <Icon name="wb-sunny" size={18} color="#FFA500" />
                  <Text style={styles.orderTypeTitle}>AM Orders</Text>
                </View>
                {userAMOrders.map(order => renderOrderItem({ order }))}
              </View>
            )}

            {userPMOrders.length > 0 && (
              <View style={styles.orderTypeSection}>
                <View style={styles.orderTypeHeader}>
                  <Icon name="nights-stay" size={18} color="#003366" />
                  <Text style={styles.orderTypeTitle}>PM Orders</Text>
                </View>
                {userPMOrders.map(order => renderOrderItem({ order }))}
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  }, [getUserOrders, renderOrderItem]);

  // Memoized list of users with orders
  const usersWithOrders = useMemo(() => {
    return users.filter(user => {
      const { userAMOrders, userPMOrders } = getUserOrders(user.customer_id);
      return userAMOrders.length > 0 || userPMOrders.length > 0;
    });
  }, [users, getUserOrders]);

  // Render content
  const renderContent = () => {
    const hasOrders = orders.length > 0;
    const hasSelectedOrders = Object.keys(selectedOrderIds).length > 0;
    
    return (
      <View style={styles.contentContainer}>
        <Card style={styles.bulkActionsCard}>
          <Card.Content>
            <View style={styles.bulkActionsContainer}>
              <View style={styles.selectAllContainer}>
                <Checkbox
                  status={selectAllOrders ? "checked" : "unchecked"}
                  onPress={() => setSelectAllOrders(!selectAllOrders)}
                  color="#003366"
                  disabled={!hasOrders || loading}
                />
                <Text style={[styles.selectAllText, (!hasOrders || loading) && styles.disabledText]}>
                  Select All Orders
                </Text>
              </View>
              <Button
                mode="contained"
                onPress={handleBulkApprove}
                style={[
                  styles.bulkApproveButton,
                  (!hasSelectedOrders || loading) && styles.disabledButton
                ]}
                labelStyle={styles.bulkApproveButtonLabel}
                disabled={!hasSelectedOrders || loading}
                icon="check-circle"
                loading={loading && hasSelectedOrders}
              >
                {loading && hasSelectedOrders ? "Processing..." : "Approve Selected"}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {hasOrders ? (
          <FlatList
            data={usersWithOrders}
            keyExtractor={(item) => item.customer_id.toString()}
            renderItem={renderUserCard}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#003366"]} />
            }
            ListEmptyComponent={
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyContent}>
                  <Icon name="inbox" size={40} color="#003366" />
                  <Text style={styles.emptyText}>No orders found</Text>
                  <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                </Card.Content>
              </Card>
            }
          />
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Icon name="inbox" size={40} color="#003366" />
              <Text style={styles.emptyText}>No orders found</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh</Text>
            </Card.Content>
          </Card>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Icon name="group" size={28} color="#fff" />
          <Text style={styles.headerTitle}>Order Approvals</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => fetchData()}
            disabled={loading}
          >
            <Icon name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003366" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Card.Content>
              <View style={styles.errorContent}>
                <Icon name="error" size={24} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Card.Content>
          </Card>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        renderContent()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#003366",
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
    color: "#fff",
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
    backgroundColor: "#fff",
    borderRadius: 10,
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
    color: "#003366",
    fontWeight: "500",
  },
  disabledText: {
    color: "#aaa",
  },
  bulkApproveButton: {
    backgroundColor: "#003366",
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  bulkApproveButtonLabel: {
    color: "#fff",
    fontWeight: "500",
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 16,
    elevation: 2,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#003366",
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  userRoute: {
    fontSize: 14,
    color: "#666",
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
    color: "#003366",
    marginLeft: 8,
  },
  orderCard: {
    backgroundColor: "#f9f9f9",
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
    color: "#666",
    width: 70,
  },
  orderValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  orderStatus: {
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pendingStatus: {
    color: "#FFA500",
    fontWeight: "bold",
  },
  acceptedStatus: {
    color: "#28a745",
    fontWeight: "bold",
  },
  alteredStatus: {
    color: "#007bff",
    fontWeight: "bold",
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
    color: "#003366",
  },
  errorContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  errorCard: {
    backgroundColor: "#fde8e8",
    width: "100%",
    borderLeftWidth: 4,
    borderLeftColor: "#dc3545",
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  errorText: {
    color: "#dc3545",
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#003366",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
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
    color: "#003366",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
});

export default OrderAcceptSA;