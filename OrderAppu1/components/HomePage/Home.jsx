import AsyncStorage from "@react-native-async-storage/async-storage"
import { useState, useCallback } from "react"
import {
  BackHandler,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  StatusBar,
  Image,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  Platform,
  Animated,
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { ipAddress } from "../../urls"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { checkTokenAndRedirect } from "../../services/auth"
import { jwtDecode } from "jwt-decode"
import { Linking } from "react-native"

// Modern Color Palette
const COLORS = {
  primary: "#003366", // Deep Blue
  primaryLight: "#004488", // Lighter Blue
  primaryDark: "#002244", // Darker Blue
  secondary: "#10B981", // Emerald
  accent: "#F59E0B", // Amber
  success: "#059669", // Green
  error: "#DC2626", // Red
  warning: "#D97706", // Yellow
  background: "#F3F4F6", // Light Gray
  surface: "#FFFFFF", // White
  text: {
    primary: "#111827", // Almost Black
    secondary: "#4B5563", // Gray
    tertiary: "#9CA3AF", // Light Gray
    light: "#FFFFFF", // White
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
}

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// Format date
const formatDate = (epochTime) => {
  if (!epochTime) return "N/A"
  const date = new Date(epochTime * 1000)
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [lastOrderDetails, setLastOrderDetails] = useState(null)
  const [creditLimit, setCreditLimit] = useState(null)
  const [pendingAmount, setPendingAmount] = useState("0")
  const [isPendingAmountLoading, setIsPendingAmountLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [scrollY] = useState(new Animated.Value(0))
  const navigation = useNavigation()

  const checkUserRole = async () => {
    setIsLoading(true)
    const userAuthToken = await AsyncStorage.getItem("userAuthToken")

    if (userAuthToken) {
      try {
        const decodedToken = jwtDecode(userAuthToken)
        setIsAdmin(decodedToken.role === "admin")
      } catch (error) {
        console.error("Token verification error:", error)
        setIsAdmin(false)
      }
    } else {
      setIsAdmin(false)
    }
  }

  // Function to check credit limit
  const checkCreditLimit = useCallback(async () => {
    try {
      const userAuthToken = await checkTokenAndRedirect(navigation)
      if (!userAuthToken) return null
      const decodedToken = jwtDecode(userAuthToken)
      const customerId = decodedToken.id

      const creditLimitResponse = await fetch(`http://${ipAddress}:8091/credit-limit?customerId=${customerId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${userAuthToken}`, "Content-Type": "application/json" },
      })

      if (creditLimitResponse.ok) {
        const creditData = await creditLimitResponse.json()
        return Number.parseFloat(creditData.creditLimit)
      } else if (creditLimitResponse.status === 404) {
        return Number.POSITIVE_INFINITY
      } else {
        console.error("Error fetching credit limit:", creditLimitResponse.status, creditLimitResponse.statusText)
        return null
      }
    } catch (error) {
      console.error("Error checking credit limit:", error)
      return null
    }
  }, [navigation])

  // Function to fetch pending amount
  const fetchPendingAmount = useCallback(async () => {
    setIsPendingAmountLoading(true)
    try {
      const userAuthToken = await checkTokenAndRedirect(navigation)
      if (!userAuthToken) return
      const decodedToken = jwtDecode(userAuthToken)
      const customerId = decodedToken.id

      const amountDueResponse = await fetch(`http://${ipAddress}:8091/collect_cash?customerId=${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (amountDueResponse.ok) {
        const amountDueData = await amountDueResponse.json()
        setPendingAmount(amountDueData.amountDue !== undefined ? amountDueData.amountDue.toString() : "0")
      } else {
        console.error(
          "Failed to fetch pending amount using /collect_cash:",
          amountDueResponse.status,
          amountDueResponse.statusText,
        )
        setPendingAmount("Error")
      }
    } catch (error) {
      console.error("Error fetching pending amount using /collect_cash:", error)
      setPendingAmount("Error")
    } finally {
      setIsPendingAmountLoading(false)
    }
  }, [navigation])

  // Back button handler
  const handleBackButton = useCallback(() => {
    Alert.alert(
      "Exit App",
      "Do you want to exit?",
      [
        { text: "Cancel", onPress: () => null, style: "cancel" },
        { text: "Exit", onPress: () => BackHandler.exitApp() },
      ],
      { cancelable: false },
    )
    return true
  }, [])

  // Fetch user details from API
  const userDetailsData1 = useCallback(async () => {
    try {
      const token = await checkTokenAndRedirect(navigation)
      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      })
      const userGetResponse = await response.json()
      if (!response.ok || !userGetResponse.status) {
        Alert.alert("Failed", userGetResponse.message || "Something went wrong")
        setIsLoading(false)
        return
      }

      const userDetails = {
        customerName: userGetResponse.user.name,
        customerID: userGetResponse.user.customer_id,
        route: userGetResponse.user.route,
      }
      await AsyncStorage.setItem("default", JSON.stringify(userGetResponse.defaultOrder))

      const latestOrder = userGetResponse.latestOrder
      const lastIndentDate = latestOrder?.placed_on || ""
      const totalAmount = latestOrder?.total_amount || 0
      const orderType = latestOrder?.order_type || ""
      const quantity = latestOrder?.quantity || 0

      return { userDetails, latestOrder: { lastIndentDate, totalAmount, orderType, quantity } }
    } catch (err) {
      console.error("User details fetch error:", err)
      setIsLoading(false)
      Alert.alert("Error", "An error occurred. Please try again.")
    }
  }, [navigation])

  // Fetch data and update state
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const userDetailsData = await userDetailsData1()
    if (userDetailsData) {
      setUserDetails(userDetailsData.userDetails)
      setLastOrderDetails(userDetailsData.latestOrder)
    }
    const creditLimitValue = await checkCreditLimit()
    setCreditLimit(creditLimitValue)
    await fetchPendingAmount()
    setIsLoading(false)
  }, [userDetailsData1, checkCreditLimit, fetchPendingAmount])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  useFocusEffect(
    useCallback(() => {
      const fetchDataAsync = async () => await fetchData()
      fetchDataAsync()
      checkUserRole()

      BackHandler.addEventListener("hardwareBackPress", handleBackButton)

      return () => {
        BackHandler.removeEventListener("hardwareBackPress", handleBackButton)
      }
    }, [fetchData, handleBackButton]),
  )

  // Handle Full Payment
  const handleFullPayment = () => {
    const parsedPending = Number.parseFloat(pendingAmount)
    if (isNaN(parsedPending) || parsedPending <= 0) {
      Alert.alert("Error", "No valid pending amount to pay.")
      return
    }
    setModalVisible(false)
    navigation.navigate("Payments", { amount: parsedPending })
  }

  // Handle Partial Payment
  const handlePartialPayment = () => {
    const parsedAmount = Number.parseFloat(partialAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a positive number.")
      return
    }
    setModalVisible(false)
    setPartialAmount("") // Reset input
    navigation.navigate("Payments", { amount: parsedAmount })
  }

  const { customerName, customerID, route } = userDetails || {}
  const { lastIndentDate, totalAmount, orderType, quantity } = lastOrderDetails || {}

  const isPendingAmountHigh = Number.parseFloat(pendingAmount) > 5000

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [160, 80],
    extrapolate: 'clamp'
  })

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Animated Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerTop}>
          <Image source={require("../../assets/logo.jpg")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.headerTitle}>{isAdmin ? "Admin Dashboard" : "Customer Dashboard"}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <MaterialIcons name="refresh" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
        </View>
        {userDetails && (
          <View style={styles.headerBottom}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{userDetails.customerName || "User"}</Text>
          </View>
        )}
      </Animated.View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]}
            progressBackgroundColor={COLORS.surface}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        bounces={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Financial Overview */}
            {!isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Financial Overview</Text>
                <View style={styles.financialCards}>
                  <View style={[styles.financeCard, styles.creditLimitCard]}>
                    <View style={styles.financeCardHeader}>
                      <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.primary} />
                      <Text style={styles.financeCardTitle}>Credit Limit</Text>
                    </View>
                    <Text style={styles.financeAmount}>
                      {creditLimit !== null
                        ? creditLimit === Number.POSITIVE_INFINITY
                          ? "Unlimited"
                          : formatCurrency(creditLimit)
                        : "Fetching..."}
                    </Text>
                  </View>

                  <View style={[styles.financeCard, styles.pendingAmountCard]}>
                    <View style={styles.financeCardHeader}>
                      <MaterialIcons name="payment" size={20} color={isPendingAmountHigh ? COLORS.error : COLORS.secondary} />
                      <Text style={styles.financeCardTitle}>Pending Amount</Text>
                    </View>
                    {isPendingAmountLoading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={[
                        styles.financeAmount,
                        isPendingAmountHigh && styles.highAmountText
                      ]}>
                        {pendingAmount === "Error"
                          ? "Error"
                          : formatCurrency(Number.parseFloat(pendingAmount))}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Order History Section */}
            {!isAdmin && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Order History</Text>
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate("OrdersPage")}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <MaterialIcons name="chevron-right" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {lastOrderDetails ? (
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View style={styles.orderType}>
                        <MaterialIcons 
                          name={orderType === "AM" ? "wb-sunny" : "nights-stay"} 
                          size={20} 
                          color={COLORS.text.light} 
                        />
                        <Text style={styles.orderTypeText}>{orderType} Shift</Text>
                      </View>
                      <Text style={styles.orderDate}>{formatDate(lastIndentDate)}</Text>
                    </View>

                    <View style={styles.orderDetails}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderInfoLabel}>Quantity</Text>
                        <Text style={styles.orderInfoValue}>{quantity || 0}</Text>
                      </View>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderInfoLabel}>Amount</Text>
                        <Text style={styles.orderInfoValue}>
                          {formatCurrency(totalAmount || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="history" size={48} color={COLORS.text.tertiary} />
                    <Text style={styles.emptyStateText}>No orders yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Your order history will appear here
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Admin Quick Links */}
            {isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.adminGrid}>
                  <TouchableOpacity 
                    style={styles.adminCard}
                    onPress={() => navigation.navigate("AdminAssignedUsers")}
                  >
                    <View style={[styles.adminCardIcon, { backgroundColor: COLORS.primaryLight }]}>
                      <MaterialIcons name="shopping-bag" size={24} color={COLORS.text.light} />
                    </View>
                    <Text style={styles.adminCardTitle}>Order Acceptance</Text>
                    <Text style={styles.adminCardSubtitle}>Manage customer orders</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.adminCard}
                    onPress={() => navigation.navigate("InvoicePage")}
                  >
                    <View style={[styles.adminCardIcon, { backgroundColor: COLORS.secondary }]}>
                      <MaterialIcons name="receipt" size={24} color={COLORS.text.light} />
                    </View>
                    <Text style={styles.adminCardTitle}>Invoice</Text>
                    <Text style={styles.adminCardSubtitle}>Generate & manage invoices</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Support Section */}
            <View style={styles.supportSection}>
              <View style={styles.supportContent}>
                <MaterialIcons name="headset-mic" size={32} color={COLORS.primary} />
                <Text style={styles.supportTitle}>Need Help?</Text>
                <Text style={styles.supportText}>
                  Our support team is available 24/7 to assist you
                </Text>
                <TouchableOpacity 
                  style={styles.supportButton}
                  onPress={() => Linking.openURL("tel:9008828409")}
                >
                  <MaterialIcons name="phone" size={20} color={COLORS.text.light} />
                  <Text style={styles.supportButtonText}>Contact Support</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={COLORS.text.light} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.paymentSummary}>
                <Text style={styles.paymentSummaryLabel}>Total Pending Amount</Text>
                <Text style={styles.paymentSummaryAmount}>
                  {pendingAmount === "Error" 
                    ? "Error" 
                    : formatCurrency(Number.parseFloat(pendingAmount))}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.fullPaymentButton}
                onPress={handleFullPayment}
              >
                <MaterialIcons name="check-circle" size={24} color={COLORS.text.light} />
                <Text style={styles.fullPaymentText}>Pay Full Amount</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <Text style={styles.partialPaymentTitle}>Pay Partial Amount</Text>

              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount"
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="numeric"
                  value={partialAmount}
                  onChangeText={(text) => setPartialAmount(text.replace(/[^0-9.]/g, ""))}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.partialPaymentButton,
                  (!partialAmount || Number.parseFloat(partialAmount) <= 0) && styles.disabledButton
                ]}
                onPress={handlePartialPayment}
                disabled={!partialAmount || Number.parseFloat(partialAmount) <= 0}
              >
                <Text style={styles.partialPaymentButtonText}>Proceed with Payment</Text>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.text.light} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBottom: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.light,
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.text.light,
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text.light,
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    marginRight: 4,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
  },
  orderType: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderTypeText: {
    color: COLORS.text.light,
    marginLeft: 8,
    fontWeight: "600",
  },
  orderDate: {
    color: COLORS.text.light,
    fontSize: 14,
  },
  orderDetails: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderInfo: {
    alignItems: "center",
  },
  orderInfoLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  orderInfoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  adminGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  adminCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  adminCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  adminCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  adminCardSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  supportSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  supportContent: {
    alignItems: "center",
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 16,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  supportButtonText: {
    color: COLORS.text.light,
    marginLeft: 8,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  paymentSummary: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  paymentSummaryAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  fullPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  fullPaymentText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  partialPaymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 18,
    color: COLORS.text.secondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
    paddingVertical: 12,
  },
  partialPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
  },
  partialPaymentButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.text.tertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text.primary,
    fontSize: 16,
    marginTop: 16,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  financialCards: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  financeCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  financeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  financeCardTitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 8,
  },
  financeAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  highAmountText: {
    color: COLORS.error,
  },
})

export default HomePage
