import React, { useState, useEffect } from "react"
import { View, ScrollView, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from "react-native"
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
      const response = await fetch(`http://${ipAddress}:8091/allUsers/`, {
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

      if (responseData.status) {
        const filteredUsers = responseData.data.filter(user => user.role === "user");
        setAssignedUsers(filteredUsers);
        filteredUsers.forEach((user) => {
          fetchOrderStatuses(user.customer_id);
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
      let apiUrl = `http://${ipAddress}:8091/most-recent-order?customerId=${customerId}`
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

      const response = await fetch(`http://${ipAddress}:8091/on-behalf`, {
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
      {/* Modern Header */}
      <View style={styles.headerShadowWrap}>
        <View style={styles.headerModern}>
          <Icon name="account-group" size={32} color="#fff" style={{ marginRight: 12 }} />
          <Text style={styles.headerTitleModern}>Auto Order Management</Text>
        </View>
      </View>

      {/* Bulk Actions Card */}
      <View style={styles.bulkActionsWrap}>
        <Card style={styles.bulkActionsCardModern}>
          <Card.Content>
            <View style={styles.selectAllRow}>
              <Checkbox 
                status={selectAll ? "checked" : "unchecked"} 
                onPress={handleSelectAllCheckbox}
                color="#003366"
              />
              <Text style={styles.selectAllTextModern}>Select All Users</Text>
            </View>
            <View style={styles.bulkButtonsRow}>
              <Button
                mode="contained"
                onPress={() => handleBulkPlaceOrder("AM")}
                style={[styles.bulkButton, styles.amButtonModern]}
                labelStyle={styles.bulkButtonLabel}
                disabled={selectedUsers.length === 0 || placingOrder["AM"]}
                loading={placingOrder["AM"]}
                icon="weather-sunny"
              >
                {placingOrder["AM"] ? "Processing..." : "Place AM Orders"}
              </Button>
              <Button
                mode="contained"
                onPress={() => handleBulkPlaceOrder("PM")}
                style={[styles.bulkButton, styles.pmButtonModern]}
                labelStyle={styles.bulkButtonLabel}
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

      {/* Error Snackbar */}
      {error && (
        <Card style={styles.errorCardModern}>
          <Card.Content>
            <View style={styles.errorContentModern}>
              <Icon name="alert-circle" size={20} color="#dc3545" />
              <Text style={styles.errorTextModern}>{error}</Text>
            </View>
          </Card.Content>
        </Card>
      )}
      {successMessage && (
        <Snackbar
          visible={snackbarVisible}
          onDismiss={onDismissSnackbar}
          duration={3000}
          style={styles.snackbarModern}
          theme={{ colors: { surface: '#003366', accent: '#fff' } }}
        >
          <View style={styles.snackbarContentModern}>
            <Icon name="check-circle" size={20} color="#fff" />
            <Text style={styles.snackbarTextModern}>{successMessage}</Text>
          </View>
        </Snackbar>
      )}

      {/* Loading State */}
      {(loadingToken || loadingUsers) ? (
        <View style={styles.loadingContainerModern}>
          <ActivityIndicator size="large" color="#003366" />
          <Text style={styles.loadingTextModern}>Loading user data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollViewModern}>
          {/* Empty State */}
          {assignedUsers.length === 0 && !error && (
            <Card style={styles.emptyCardModern}>
              <Card.Content style={styles.emptyContentModern}>
                <Icon name="account-question" size={44} color="#003366" />
                <Text style={styles.emptyTextModern}>No users assigned to you</Text>
                <Text style={styles.emptySubtextModern}>Contact support if this is unexpected</Text>
              </Card.Content>
            </Card>
          )}

          {/* User Cards */}
          {assignedUsers.map((user) => {
            const statuses = orderStatuses[user.customer_id] || {}
            const amOrderStatus = statuses.am
            const pmOrderStatus = statuses.pm
            const isUserSelected = selectedUsers.includes(user.customer_id)
            return (
              <Card 
                key={user.customer_id} 
                style={[
                  styles.userCardModern,
                  isUserSelected && styles.selectedCardModern
                ]}
              >
                <Card.Content>
                  <View style={styles.userCardHeaderRow}>
                    <Checkbox
                      status={isUserSelected ? "checked" : "unchecked"}
                      onPress={() => handleCheckboxChange(user.customer_id)}
                      color="#003366"
                    />
                    <View style={styles.userInfoModern}>
                      <Text style={styles.customerIdModern}>Customer ID: {user.customer_id}</Text>
                      {placementError[user.customer_id] && (
                        <View style={styles.userErrorModern}>
                          <Icon name="alert" size={16} color="#dc3545" />
                          <Text style={styles.userErrorTextModern}>{placementError[user.customer_id]}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.orderInfoModern}>
                    {/* AM Order Section */}
                    <View style={styles.orderSectionModern}>
                      <View style={styles.orderHeaderModern}>
                        <Icon name="weather-sunny" size={22} color="#FFA500" style={{ marginRight: 6 }} />
                        <Text style={styles.orderTypeModern}>AM Order</Text>
                      </View>
                      <Text style={styles.orderStatusModern}>{getOrderStatusDisplay(amOrderStatus)}</Text>
                      <View style={[
                        styles.todayStatusModern,
                        getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" 
                          ? styles.statusSuccessModern 
                          : styles.statusErrorModern
                      ]}>
                        <Icon 
                          name={getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" ? "check" : "close"} 
                          size={16} 
                          color={getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" ? "#28a745" : "#dc3545"} 
                        />
                        <Text style={styles.todayStatusTextModern}>
                          Today: {getHasOrderTodayDisplay(amOrderStatus, "AM")}
                        </Text>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.customer_id, "AM")}
                        style={styles.orderButtonModern}
                        labelStyle={styles.orderButtonLabelModern}
                        disabled={placingOrder[user.customer_id]}
                        loading={placingOrder[user.customer_id]}
                        icon="send"
                      >
                        Place AM Order
                      </Button>
                    </View>
                    <Divider style={styles.dividerModern} />
                    {/* PM Order Section */}
                    <View style={[styles.orderSectionModern, { marginTop: 10 }]}>
                      <View style={styles.orderHeaderModern}>
                        <Icon name="weather-night" size={22} color="#003366" style={{ marginRight: 6 }} />
                        <Text style={styles.orderTypeModern}>PM Order</Text>
                      </View>
                      <Text style={styles.orderStatusModern}>{getOrderStatusDisplay(pmOrderStatus)}</Text>
                      <View style={[
                        styles.todayStatusModern,
                        getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" 
                          ? styles.statusSuccessModern 
                          : styles.statusErrorModern
                      ]}>
                        <Icon 
                          name={getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" ? "check" : "close"} 
                          size={16} 
                          color={getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" ? "#28a745" : "#dc3545"} 
                        />
                        <Text style={styles.todayStatusTextModern}>
                          Today: {getHasOrderTodayDisplay(pmOrderStatus, "PM")}
                        </Text>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.customer_id, "PM")}
                        style={styles.orderButtonModern}
                        labelStyle={styles.orderButtonLabelModern}
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

// Modernized Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerShadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003366',
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerTitleModern: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  bulkActionsWrap: {
    marginTop: 18,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bulkActionsCardModern: {
    borderRadius: 14,
    backgroundColor: '#fff',
    elevation: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllTextModern: {
    marginLeft: 8,
    fontSize: 17,
    color: '#003366',
    fontWeight: '600',
  },
  bulkButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  bulkButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    marginHorizontal: 2,
  },
  amButtonModern: {
    backgroundColor: '#FFA500',
  },
  pmButtonModern: {
    backgroundColor: '#003366',
  },
  bulkButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  errorCardModern: {
    backgroundColor: '#fde8e8',
    marginHorizontal: 16,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#dc3545',
    borderRadius: 10,
    elevation: 2,
  },
  errorContentModern: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorTextModern: {
    color: '#dc3545',
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  snackbarModern: {
    backgroundColor: '#003366',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  snackbarContentModern: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snackbarTextModern: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainerModern: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 30,
  },
  loadingTextModern: {
    marginTop: 18,
    color: '#003366',
    fontSize: 17,
    fontWeight: '600',
  },
  scrollViewModern: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  emptyCardModern: {
    backgroundColor: '#fff',
    borderRadius: 14,
    margin: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
  },
  emptyContentModern: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextModern: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#003366',
    textAlign: 'center',
  },
  emptySubtextModern: {
    marginTop: 8,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  userCardModern: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    elevation: 3,
  },
  selectedCardModern: {
    borderColor: '#003366',
    borderWidth: 2.5,
  },
  userCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfoModern: {
    flex: 1,
    marginLeft: 12,
  },
  customerIdModern: {
    fontSize: 17,
    fontWeight: '700',
    color: '#003366',
  },
  userErrorModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userErrorTextModern: {
    color: '#dc3545',
    fontSize: 13,
    marginLeft: 5,
    fontWeight: '600',
  },
  orderInfoModern: {
    gap: 18,
    flexDirection: 'column',
    marginTop: 2,
  },
  orderSectionModern: {
    flex: 1,
    gap: 8,
    paddingRight: 6,
  },
  orderHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderTypeModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003366',
  },
  orderStatusModern: {
    fontSize: 14,
    color: '#555',
    marginLeft: 28,
    fontWeight: '500',
  },
  todayStatusModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginLeft: 28,
    gap: 7,
  },
  todayStatusTextModern: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusSuccessModern: {
    backgroundColor: '#e6f7ed',
  },
  statusErrorModern: {
    backgroundColor: '#fde8e8',
  },
  orderButtonModern: {
    marginTop: 10,
    borderColor: '#003366',
    borderRadius: 8,
    marginLeft: 28,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  orderButtonLabelModern: {
    color: '#003366',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerModern: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
})

export default AutoOrderPage;