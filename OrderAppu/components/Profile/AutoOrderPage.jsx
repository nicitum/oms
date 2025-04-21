import React, { useState, useEffect } from "react"
import { View, ScrollView, Text, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { jwtDecode } from "jwt-decode"
import { Checkbox, Button, Snackbar, Card, Divider } from "react-native-paper"
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ipAddress } from "../../urls"

const AutoOrderPage = () => {
  const [assignedUsers, setAssignedUsers] = useState([])
  const [error, setError] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userAuthToken, setUserAuthToken] = useState(null)
  const [currentAdminId, setCurrentAdminId] = useState(null)
  const [loadingToken, setLoadingToken] = useState(true)
  const [orderStatuses, setOrderStatuses] = useState({})
  const [placingOrder, setPlacingOrder] = useState({})
  const [placementError, setPlacementError] = useState({})
  const [recentOrderIds, setRecentOrderIds] = useState({})
  const [selectAll, setSelectAll] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [successMessage, setSuccessMessage] = useState(null)
  const [snackbarVisible, setSnackbarVisible] = useState(false)

  const fetchAssignedUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch(`http://${ipAddress}:8090/allUsers/`, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const message = `Failed to fetch assigned users. Status: ${response.status}`;
        throw new Error(message);
      }

      const responseData = await response.json();
      console.log("Assigned Users Response:", responseData);

      if (responseData.status) { // Changed from responseData.success
        setAssignedUsers(responseData.data); // Changed from responseData.assignedUsers
        responseData.data.forEach((user) => { // Changed from responseData.assignedUsers
          fetchOrderStatuses(user.customer_id); // Assuming customer_id is the correct field
        });
      } else {
        setError(responseData.message || "Failed to fetch assigned users.");
        Toast.show({
          type: 'error',
          text1: 'Fetch Users Failed',
          text2: responseData.message || "Failed to fetch assigned users."
        });
      }
    } catch (err) {
      console.error("Error fetching assigned users:", err);
      setError("Error fetching assigned users. Please try again.");
      Toast.show({
        type: 'error',
        text1: 'Fetch Users Error',
        text2: "Error fetching assigned users. Please try again."
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMostRecentOrder = async (customerId, orderType) => {
    try {
      let apiUrl = `http://${ipAddress}:8090/most-recent-order?customerId=${customerId}`
      if (orderType && (orderType === "AM" || orderType === "PM")) {
        apiUrl += `&orderType=${orderType}`
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      })
      if (!response.ok) {
        if (response.status === 400 && response.url.includes("/most-recent-order")) {
          console.warn(`No recent ${orderType || "any"} order found for customer ${customerId}. Status: ${response.status}`)
          return null
        }
        const message = `Failed to fetch recent ${orderType || "any"} order for customer ${customerId}. Status: ${response.status}`
        throw new Error(message)
      }
      const responseData = await response.json()
      return responseData.order
    } catch (error) {
      console.error(`Error fetching most recent ${orderType || "any"} order for customer ${customerId}:`, error)
      return null
    }
  }

  const fetchOrderStatuses = async (customerId) => {
    try {
      const amOrder = await fetchMostRecentOrder(customerId, "AM")
      const pmOrder = await fetchMostRecentOrder(customerId, "PM")

      setOrderStatuses((prevStatuses) => ({
        ...prevStatuses,
        [customerId]: {
          am: amOrder || null,
          pm: pmOrder || null,
        },
      }))
    } catch (err) {
      console.error("Error fetching order statuses:", err)
    }
  }

  const handleSelectAllCheckbox = () => {
    setSelectAll(!selectAll)
    if (!selectAll) {
      const allUserIds = assignedUsers.map((user) => user.customer_id)
      setSelectedUsers(allUserIds)
    } else {
      setSelectedUsers([])
    }
  }

  const handleCheckboxChange = (customerId) => {
    setSelectedUsers((prevSelected) => {
      if (prevSelected.includes(customerId)) {
        return prevSelected.filter((id) => id !== customerId)
      } else {
        return [...prevSelected, customerId]
      }
    })
  }

  const handleBulkPlaceOrder = async (orderType) => {
    setPlacingOrder((prevPlacing) => ({ ...prevPlacing, [orderType]: true }));
    setPlacementError((prevErrors) => ({ ...prevErrors, [orderType]: null }));

    let bulkOrderSuccess = true;
    let individualOrderResults = [];
    let hasAnySuccess = false;

    console.log(`Starting bulk ${orderType} order. Selected users:`, selectedUsers);

    try {
      const orderPromises = selectedUsers.map(async (customerId) => {
        try {
          await placeAdminOrder(customerId, orderType);
          hasAnySuccess = true;
          return { customerId, success: true };
        } catch (error) {
          bulkOrderSuccess = false;
          console.log(`Individual ${orderType} order FAILED for Customer ID: ${customerId}. Error:`, error);
          return { customerId, success: false, error: error.message };
        }
      });

      individualOrderResults = await Promise.all(orderPromises);
      console.log("Bulk order promises resolved. Results:", individualOrderResults);

      selectedUsers.forEach((customerId) => fetchOrderStatuses(customerId));

      setSelectedUsers([]);
      setSelectAll(false);

      console.log(`Bulk ${orderType} order processing finished. bulkOrderSuccess:`, bulkOrderSuccess, "hasAnySuccess:", hasAnySuccess);

      if (bulkOrderSuccess && hasAnySuccess) {
        const successMessageText = `Successfully placed ${orderType} orders for ALL selected users.`;
        setSuccessMessage(successMessageText);
        setSnackbarVisible(true);
        Toast.show({
          type: 'success',
          text1: 'Bulk Order Success',
          text2: successMessageText,
        });
      } else if (!bulkOrderSuccess && hasAnySuccess) {
          const partialSuccessMessage = `Bulk ${orderType} orders partially placed. Some orders failed. See user cards for details.`;
          setError(partialSuccessMessage);
          Toast.show({
              type: 'error',
              text1: 'Bulk Order Partially Failed',
              text2: partialSuccessMessage,
          });
      }
      else {
        const errorMessageText = `Failed to place ${orderType} orders for ALL selected users. See details in user cards.`;
        setError(errorMessageText);
        Toast.show({
          type: 'error',
          text1: 'Bulk Order Failed',
          text2: errorMessageText,
        });
        individualOrderResults.forEach(result => {
          if (!result.success) {
            console.error(`Bulk ${orderType} order failed for Customer ID: ${result.customerId}. Error: ${result.error}`);
          }
        });
      }
    } catch (err) {
      console.error(`Error during bulk ${orderType} order processing:`, err);
      setPlacementError((prevErrors) => ({
        ...prevErrors,
        [orderType]: "Bulk order processing error. Please try again.",
      }));
      setError(`Bulk order processing error. Please check console.`);
      Toast.show({
        type: 'error',
        text1: 'Bulk Order Processing Error',
        text2: `Bulk order processing error. Check console.`,
      });
      bulkOrderSuccess = false;
    } finally {
      setPlacingOrder((prevPlacing) => ({ ...prevPlacing, [orderType]: false }));
    }
  };

  const placeAdminOrder = async (customerId, orderType) => {
    setPlacingOrder((prevState) => ({ ...prevState, [customerId]: true }))
    setPlacementError((prevState) => ({ ...prevState, [customerId]: null }))

    try {
      const recentTypeOrder = await fetchMostRecentOrder(customerId, orderType)
      let referenceOrderId = recentTypeOrder ? recentTypeOrder.id : recentOrderIds[customerId]

      if (!referenceOrderId) {
        const errorMsg = `Could not find a recent order to reference for customer ${customerId} to place ${orderType} order.`
        setPlacementError((prevState) => ({ ...prevState, [customerId]: errorMsg }))
        throw new Error(errorMsg)
      }

      const response = await fetch(`http://${ipAddress}:8090/on-behalf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          order_type: orderType,
          reference_order_id: referenceOrderId,
        }),
      })

      if (!response.ok) {
        const message = `Failed to place ${orderType} order for customer ${customerId}. Status: ${response.status}`
        throw new Error(message)
      }

      const responseData = await response.json()
      console.log(`Place ${orderType} Order Response:`, responseData)
      fetchOrderStatuses(customerId)
      const successMessageText = `${orderType} Order placed successfully for Customer ID: ${customerId}`;
      setSuccessMessage(successMessageText)
      setSnackbarVisible(true)
      Toast.show({
        type: 'success',
        text1: 'Order Placed',
        text2: successMessageText
      });
    } catch (err) {
      console.error(`Error placing ${orderType} order for customer ${customerId}:`, err)
      setPlacementError((prevState) => ({
        ...prevState,
        [customerId]: `Error placing ${orderType} order: ${err.message}. Please try again.`,
      }))
      setError(`Failed to place ${orderType} order. Please see customer specific errors.`)
      Toast.show({
        type: 'error',
        text1: 'Order Placement Error',
        text2: `Failed to place ${orderType} order. Please see customer specific errors.`
      });
      throw err;
    } finally {
      setPlacingOrder((prevState) => ({ ...prevState, [customerId]: false }))
    }
  }

  useEffect(() => {
    const loadAdminData = async () => {
      setLoadingToken(true)
      setError(null)

      try {
        const storedToken = await AsyncStorage.getItem("userAuthToken")
        if (!storedToken) {
          setError("User authentication token not found.")
          setLoadingToken(false)
          Toast.show({
            type: 'error',
            text1: 'Authentication Error',
            text2: "User authentication token not found."
          });
          return
        }

        const decodedToken = jwtDecode(storedToken)
        const adminId = decodedToken.id1

        setUserAuthToken(storedToken)
        setCurrentAdminId(adminId)
      } catch (tokenError) {
        console.error("Error fetching or decoding token:", tokenError)
        setError("Failed to authenticate admin. Please try again.")
        Toast.show({
          type: 'error',
          text1: 'Authentication Error',
          text2: "Failed to authenticate admin. Please try again."
        });
      } finally {
        setLoadingToken(false)
      }
    }

    loadAdminData()
  }, [])

  useEffect(() => {
    if (currentAdminId && userAuthToken) {
      fetchAssignedUsers()
    }
  }, [currentAdminId, userAuthToken])

  const getOrderStatusDisplay = (order) => {
    if (order) {
      const placedDate = new Date(order.placed_on * 1000).toLocaleDateString()
      return `Placed on: ${placedDate}`
    } else {
      return "No Order Placed"
    }
  }

  const getHasOrderTodayDisplay = (order, orderType) => {
    const today = new Date()
    const isSameDay = (date1, date2) => {
      return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
      )
    }

    if (order && orderType === "AM" && isSameDay(new Date(order.placed_on * 1000), today)) {
      return "Yes"
    }
    if (order && orderType === "PM" && isSameDay(new Date(order.placed_on * 1000), today)) {
      return "Yes"
    }
    return "No"
  }

  const onDismissSnackbar = () => setSnackbarVisible(false)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Icon name="account-group" size={28} color="#fff" />
          <Text style={styles.headerTitle}>Order Management</Text>
        </View>
        
        {error && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <View style={styles.errorContent}>
                <Icon name="alert-circle" size={20} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Card.Content>
          </Card>
        )}
        
        {successMessage && (
          <Snackbar
            visible={snackbarVisible}
            onDismiss={onDismissSnackbar}
            duration={3000}
            style={styles.snackbar}
            theme={{ colors: { surface: '#003366', accent: '#fff' } }}
          >
            <View style={styles.snackbarContent}>
              <Icon name="check-circle" size={20} color="#fff" />
              <Text style={styles.snackbarText}>{successMessage}</Text>
            </View>
          </Snackbar>
        )}

        <View style={styles.actionsContainer}>
          <Card style={styles.bulkActionsCard}>
            <Card.Content>
              <View style={styles.selectAllContainer}>
                <Checkbox 
                  status={selectAll ? "checked" : "unchecked"} 
                  onPress={handleSelectAllCheckbox}
                  color="#003366"
                />
                <Text style={styles.selectAllText}>Select All Users</Text>
              </View>
              
              <View style={styles.bulkActionsContainer}>
                <Button
                  mode="contained"
                  onPress={() => handleBulkPlaceOrder("AM")}
                  style={[styles.bulkActionButton, styles.amButton]}
                  labelStyle={styles.buttonLabel}
                  disabled={selectedUsers.length === 0 || placingOrder["AM"]}
                  loading={placingOrder["AM"]}
                  icon="weather-sunny"
                >
                  {placingOrder["AM"] ? "Processing..." : "Place AM Orders"}
                </Button>
                
                <Button
                  mode="contained"
                  onPress={() => handleBulkPlaceOrder("PM")}
                  style={[styles.bulkActionButton, styles.pmButton]}
                  labelStyle={styles.buttonLabel}
                  disabled={selectedUsers.length === 0 || placingOrder["PM"]}
                  loading={placingOrder["PM"]}
                  icon="weather-night"
                >
                  {placingOrder["PM"] ? "Processing..." : "Place PM Orders"}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </View>

      {loadingToken || loadingUsers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003366" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {assignedUsers.length === 0 && !error && (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Icon name="account-question" size={40} color="#003366" />
                <Text style={styles.emptyText}>No users assigned to you</Text>
                <Text style={styles.emptySubtext}>Contact support if this is unexpected</Text>
              </Card.Content>
            </Card>
          )}
          
          {assignedUsers.map((user) => {
            const statuses = orderStatuses[user.customer_id] || {}
            const amOrderStatus = statuses.am
            const pmOrderStatus = statuses.pm
            const isUserSelected = selectedUsers.includes(user.customer_id)

            return (
              <Card 
                key={user.customer_id} 
                style={[
                  styles.userCard,
                  isUserSelected && styles.selectedCard
                ]}
              >
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Checkbox
                      status={isUserSelected ? "checked" : "unchecked"}
                      onPress={() => handleCheckboxChange(user.customer_id)}
                      color="#003366"
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.customerId}>Customer ID: {user.customer_id}</Text>
                      {placementError[user.customer_id] && (
                        <View style={styles.userError}>
                          <Icon name="alert" size={16} color="#dc3545" />
                          <Text style={styles.userErrorText}>{placementError[user.customer_id]}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.orderInfo}>
                    <View style={styles.orderSection}>
                      <View style={styles.orderHeader}>
                        <Icon name="weather-sunny" size={20} color="#FFA500" />
                        <Text style={styles.orderType}>AM Order</Text>
                      </View>
                      <Text style={styles.orderStatus}>{getOrderStatusDisplay(amOrderStatus)}</Text>
                      <View style={[
                        styles.todayStatus,
                        getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" 
                          ? styles.statusSuccess 
                          : styles.statusError
                      ]}>
                        <Icon 
                          name={getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" ? "check" : "close"} 
                          size={16} 
                          color={getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" ? "#28a745" : "#dc3545"} 
                        />
                        <Text style={styles.todayStatusText}>
                          Today: {getHasOrderTodayDisplay(amOrderStatus, "AM")}
                        </Text>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.customer_id, "AM")}
                        style={styles.orderButton}
                        labelStyle={styles.orderButtonLabel}
                        disabled={placingOrder[user.customer_id]}
                        loading={placingOrder[user.customer_id]}
                        icon="send"
                      >
                        Place AM Order
                      </Button>
                    </View>

                    <Divider style={styles.divider} />

                    <View style={styles.orderSection}>
                      <View style={styles.orderHeader}>
                        <Icon name="weather-night" size={20} color="#003366" />
                        <Text style={styles.orderType}>PM Order</Text>
                      </View>
                      <Text style={styles.orderStatus}>{getOrderStatusDisplay(pmOrderStatus)}</Text>
                      <View style={[
                        styles.todayStatus,
                        getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" 
                          ? styles.statusSuccess 
                          : styles.statusError
                      ]}>
                        <Icon 
                          name={getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" ? "check" : "close"} 
                          size={16} 
                          color={getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" ? "#28a745" : "#dc3545"} 
                        />
                        <Text style={styles.todayStatusText}>
                          Today: {getHasOrderTodayDisplay(pmOrderStatus, "PM")}
                        </Text>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.customer_id, "PM")}
                        style={styles.orderButton}
                        labelStyle={styles.orderButtonLabel}
                        disabled={placingOrder[user.customer_id]}
                        loading={placingOrder[user.customer_id]}
                        icon="send"
                      >
                        Place PM Order
                      </Button>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )
          })}
        </ScrollView>
      )}
      <Toast />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#003366',
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  actionsContainer: {
    marginTop: 10,
  },
  bulkActionsCard: {
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 3,
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#003366',
    fontWeight: '500',
  },
  bulkActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  bulkActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
  },
  amButton: {
    backgroundColor: '#FFA500',
  },
  pmButton: {
    backgroundColor: '#003366',
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCard: {
    borderColor: '#003366',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  customerId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003366',
  },
  userError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userErrorText: {
    color: '#dc3545',
    fontSize: 12,
    marginLeft: 4,
  },
  orderInfo: {
    gap: 16,
  },
  orderSection: {
    gap: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003366',
  },
  orderStatus: {
    fontSize: 14,
    color: '#555',
    marginLeft: 28,
  },
  todayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginLeft: 28,
    gap: 6,
  },
  todayStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusSuccess: {
    backgroundColor: '#e6f7ed',
  },
  statusError: {
    backgroundColor: '#fde8e8',
  },
  orderButton: {
    marginTop: 8,
    borderColor: '#003366',
    borderRadius: 8,
    marginLeft: 28,
    alignSelf: 'flex-start',
  },
  orderButtonLabel: {
    color: '#003366',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  errorCard: {
    backgroundColor: '#fde8e8',
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc3545',
    marginLeft: 8,
    fontSize: 14,
  },
  snackbar: {
    backgroundColor: '#003366',
    borderRadius: 8,
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snackbarText: {
    color: '#fff',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 16,
    color: '#003366',
    fontSize: 16,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#003366',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
})

export default AutoOrderPage;