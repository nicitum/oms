import React, { useState, useEffect } from "react"
import { View, ScrollView, Text, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl, Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { jwtDecode } from "jwt-decode"
import { Checkbox, Button, Card, Searchbar } from "react-native-paper"
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Animated } from 'react-native';
import { ipAddress } from "../../urls"

// Color Constants
const COLORS = {
    primary: '#003366', // Deep Blue
    primaryLight: '#004488',
    primaryDark: '#002244',
    secondary: '#10B981', // Emerald
    accent: '#F59E0B', // Amber
    success: '#059669', // Green
    error: '#DC2626', // Red
    warning: '#D97706', // Yellow
    background: '#F3F4F6', // Light Gray
    surface: '#FFFFFF', // White
    text: {
        primary: '#111827', // Almost Black
        secondary: '#4B5563', // Gray
        tertiary: '#9CA3AF', // Light Gray
        light: '#FFFFFF', // White
    },
    border: '#E5E7EB',
    divider: '#F3F4F6',
    card: {
        background: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
    },
};

const PlaceOrderAdmin = () => {
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
    const [refreshing, setRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [filteredUsers, setFilteredUsers] = useState([])
    const scrollY = new Animated.Value(0)

    // Header animation values
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [120, 80],
        extrapolate: 'clamp',
    });

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.8],
        extrapolate: 'clamp',
    });

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

    useEffect(() => {
        if (searchQuery) {
            const filtered = assignedUsers.filter(user =>
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.route.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(assignedUsers);
        }
    }, [searchQuery, assignedUsers]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchAssignedUsers().finally(() => setRefreshing(false));
    }, []);

  const fetchAssignedUsers = async () => {
    setLoadingUsers(true)
    setError(null)
    try {
      const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const message = `Failed to fetch assigned users. Status: ${response.status}`
        throw new Error(message)
      }

      const responseData = await response.json()
      console.log("Assigned Users Response:", responseData)

      if (responseData.success) {
        setAssignedUsers(responseData.assignedUsers)
                setFilteredUsers(responseData.assignedUsers)
        responseData.assignedUsers.forEach((user) => {
          fetchOrderStatuses(user.cust_id)
        })
      } else {
        setError(responseData.message || "Failed to fetch assigned users.")
        Toast.show({
          type: 'error',
          text1: 'Fetch Users Failed',
          text2: responseData.message || "Failed to fetch assigned users."
        });
      }
    } catch (err) {
      console.error("Error fetching assigned users:", err)
      setError("Error fetching assigned users. Please try again.")
      Toast.show({
        type: 'error',
        text1: 'Fetch Users Error',
        text2: "Error fetching assigned users. Please try again."
      });
    } finally {
      setLoadingUsers(false)
    }
  }

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
      const allUserIds = assignedUsers.map((user) => user.cust_id)
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

    const renderUserCard = (user) => {
            const statuses = orderStatuses[user.cust_id] || {}
            const amOrderStatus = statuses.am
            const pmOrderStatus = statuses.pm
            const isUserSelected = selectedUsers.includes(user.cust_id)

            return (
              <Card 
                key={user.cust_id} 
                style={[
                  styles.userCard,
                  isUserSelected && styles.selectedCard
                ]}
              >
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Checkbox
                      status={isUserSelected ? "checked" : "unchecked"}
                      onPress={() => handleCheckboxChange(user.cust_id)}
                            color={COLORS.primary}
                    />
                    <View style={styles.userInfo}>
                            <View style={styles.userHeader}>
                                <View style={styles.userAvatar}>
                                    <Icon name="account-circle" size={32} color={COLORS.primary} />
                                </View>
                                <View style={styles.userDetails}>
                                    <Text style={styles.userName}>{user.name}</Text>
                                    <View style={styles.userMeta}>
                                        <Icon name="map-marker" size={16} color={COLORS.text.secondary} />
                                        <Text style={styles.userRoute}>{user.route}</Text>
                                    </View>
                                </View>
                            </View>
                      {placementError[user.cust_id] && (
                                <View style={styles.errorContainer}>
                                    <Icon name="alert" size={16} color={COLORS.error} />
                                    <Text style={styles.errorText}>{placementError[user.cust_id]}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                    <View style={styles.orderSections}>
                    <View style={styles.orderSection}>
                      <View style={styles.orderHeader}>
                                <Icon name="weather-sunny" size={20} color={COLORS.accent} />
                        <Text style={styles.orderType}>AM Order</Text>
                      </View>
                            <View style={styles.orderStatusContainer}>
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
                                        color={getHasOrderTodayDisplay(amOrderStatus, "AM") === "Yes" ? COLORS.success : COLORS.error} 
                        />
                        <Text style={styles.todayStatusText}>
                          Today: {getHasOrderTodayDisplay(amOrderStatus, "AM")}
                        </Text>
                                </View>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.cust_id, "AM")}
                        style={styles.orderButton}
                        labelStyle={styles.orderButtonLabel}
                        disabled={placingOrder[user.cust_id]}
                        loading={placingOrder[user.cust_id]}
                        icon="send"
                      >
                        Place AM Order
                      </Button>
                    </View>

                        <View style={styles.divider} />

                    <View style={styles.orderSection}>
                      <View style={styles.orderHeader}>
                                <Icon name="weather-night" size={20} color={COLORS.primary} />
                        <Text style={styles.orderType}>PM Order</Text>
                      </View>
                            <View style={styles.orderStatusContainer}>
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
                                        color={getHasOrderTodayDisplay(pmOrderStatus, "PM") === "Yes" ? COLORS.success : COLORS.error} 
                        />
                        <Text style={styles.todayStatusText}>
                          Today: {getHasOrderTodayDisplay(pmOrderStatus, "PM")}
                        </Text>
                                </View>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => placeAdminOrder(user.cust_id, "PM")}
                        style={styles.orderButton}
                        labelStyle={styles.orderButtonLabel}
                        disabled={placingOrder[user.cust_id]}
                        loading={placingOrder[user.cust_id]}
                        icon="send"
                      >
                        Place PM Order
                      </Button>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )
    }

    const renderContent = () => {
        return (
            <View style={styles.contentContainer}>
                <Card style={styles.bulkActionsCard}>
                    <Card.Content>
                        <View style={styles.bulkActionsContainer}>
                            <View style={styles.selectAllContainer}>
                                <Checkbox
                                    status={selectAll ? "checked" : "unchecked"}
                                    onPress={handleSelectAllCheckbox}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.selectAllText}>Select All Users</Text>
                            </View>
                            <View style={styles.bulkActionButtons}>
                                <Button
                                    mode="contained"
                                    onPress={() => handleBulkPlaceOrder("AM")}
                                    style={[styles.bulkActionButton, styles.amButton]}
                                    labelStyle={styles.bulkActionButtonLabel}
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
                                    labelStyle={styles.bulkActionButtonLabel}
                                    disabled={selectedUsers.length === 0 || placingOrder["PM"]}
                                    loading={placingOrder["PM"]}
                                    icon="weather-night"
                                >
                                    {placingOrder["PM"] ? "Processing..." : "Place PM Orders"}
                                </Button>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                <Searchbar
                    placeholder="Search users..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    iconColor={COLORS.primary}
                    inputStyle={styles.searchInput}
                />

                <ScrollView 
                    style={styles.scrollView}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                    scrollEventThrottle={16}
                >
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map(user => renderUserCard(user))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Icon name="account-question" size={48} color={COLORS.primary} />
                                <Text style={styles.emptyText}>No users found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'No users assigned to you'}
                                </Text>
                            </Card.Content>
                        </Card>
                    )}
        </ScrollView>
            </View>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
                <View style={styles.headerContent}>
                    <Icon name="account-group" size={28} color={COLORS.text.light} />
                    <Text style={styles.headerTitle}>Order Management</Text>
                </View>
            </Animated.View>

            {loadingToken || loadingUsers ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading user data...</Text>
                </View>
            ) : error ? (
                <Card style={styles.errorCard}>
                    <Card.Content>
                        <View style={styles.errorContent}>
                            <Icon name="alert-circle" size={24} color={COLORS.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    </Card.Content>
                </Card>
            ) : (
                renderContent()
      )}
      <Toast />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
        backgroundColor: COLORS.background,
  },
  header: {
        backgroundColor: COLORS.primary,
    padding: 16,
        paddingTop: Platform.OS === 'ios' ? 40 : 16,
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
  },
  headerTitle: {
        fontSize: 24,
    fontWeight: '600',
        color: COLORS.text.light,
        marginLeft: 12,
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
        gap: 16,
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    marginLeft: 8,
    fontSize: 16,
        color: COLORS.primary,
    fontWeight: '500',
  },
    bulkActionButtons: {
    flexDirection: 'row',
        gap: 12,
  },
  bulkActionButton: {
    flex: 1,
    borderRadius: 8,
  },
  amButton: {
        backgroundColor: COLORS.accent,
  },
  pmButton: {
        backgroundColor: COLORS.primary,
  },
    bulkActionButtonLabel: {
        color: COLORS.text.light,
    fontWeight: '500',
    },
    searchBar: {
        marginBottom: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        elevation: 2,
    },
    searchInput: {
        color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
        backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
        elevation: 2,
  },
  selectedCard: {
        borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
  },
  userInfo: {
    flex: 1,
        marginLeft: 12,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userDetails: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18,
    fontWeight: '600',
        color: COLORS.text.primary,
  },
    userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
    userRoute: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginLeft: 4,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#FEE2E2',
        padding: 8,
        borderRadius: 8,
    },
    errorText: {
        color: COLORS.error,
    fontSize: 12,
    marginLeft: 4,
  },
    orderSections: {
    gap: 16,
  },
  orderSection: {
        gap: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderType: {
    fontSize: 16,
    fontWeight: '600',
        color: COLORS.text.primary,
        marginLeft: 8,
    },
    orderStatusContainer: {
        marginLeft: 28,
        gap: 8,
  },
  orderStatus: {
    fontSize: 14,
        color: COLORS.text.secondary,
  },
  todayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
        borderRadius: 12,
    alignSelf: 'flex-start',
  },
  todayStatusText: {
    fontSize: 14,
    fontWeight: '500',
        marginLeft: 4,
  },
  statusSuccess: {
        backgroundColor: '#D1FAE5',
  },
  statusError: {
        backgroundColor: '#FEE2E2',
  },
  orderButton: {
        marginLeft: 28,
        borderColor: COLORS.primary,
    borderRadius: 8,
  },
  orderButtonLabel: {
        color: COLORS.primary,
        fontSize: 14,
  },
  divider: {
    height: 1,
        backgroundColor: COLORS.divider,
  },
  errorCard: {
        backgroundColor: '#FEE2E2',
        margin: 16,
    borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
        color: COLORS.primary,
  },
  emptyCard: {
        backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
        elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
        color: COLORS.text.primary,
        marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
        fontSize: 14,
        color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
})

export default PlaceOrderAdmin