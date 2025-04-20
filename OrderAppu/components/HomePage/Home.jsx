"use client"

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
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { ipAddress } from "../../urls"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { checkTokenAndRedirect } from "../../services/auth"
import { jwtDecode } from "jwt-decode"
import { Linking } from "react-native"

// Color Constants - Deep Blue Theme
const COLORS = {
  primary: "#003366",
  primaryDark: "#002244",
  primaryLight: "#004488",
  secondary: "#003366",
  accent: "#003366",
  background: "#F8FAFD",
  cardBackground: "#FFFFFF",
  cardBackgroundAlt: "#F0F5FF",
  textPrimary: "#003366",
  textSecondary: "#5A7184",
  textLight: "#FFFFFF",
  border: "#E1E7F0",
  error: "#FF3B30",
  success: "#34C759",
  warning: "#FF9500",
  highlight: "#3E6FCC",
  shadow: "#1A3A6C",
  inputBackground: "#F5F8FC",
}

// Helper function to format epoch time
const formatDate = (epochTime) => {
  if (!epochTime) return "N/A"
  const date = new Date(epochTime * 1000)
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// Get screen dimensions
const { width } = Dimensions.get("window")
const isSmallScreen = width < 375

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

      const creditLimitResponse = await fetch(`http://${ipAddress}:8090/credit-limit?customerId=${customerId}`, {
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

      const amountDueResponse = await fetch(`http://${ipAddress}:8090/collect_cash?customerId=${customerId}`, {
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
      const response = await fetch(`http://${ipAddress}:8090/userDetails`, {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <Image source={require("../../assets/logo.jpg")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerTitle}>{isAdmin ? "Admin Dashboard" : "Customer Dashboard"}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={24} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.innerContainer}>
            {/* Welcome Banner */}
            <View style={styles.welcomeBanner}>
              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{customerName || "User"}</Text>
              </View>
              <View style={styles.iconContainer}>
                <MaterialIcons
                  name={isAdmin ? "admin-panel-settings" : "account-circle"}
                  size={40}
                  color={COLORS.textLight}
                />
              </View>
            </View>

            {/* Quick Actions */}
            {!isAdmin && (
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("PlaceOrder")}>
                  <MaterialIcons name="shopping-cart" size={24} color={COLORS.primary} />
                  <Text style={styles.actionText}>Place Order</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)}>
                  <MaterialIcons name="payment" size={24} color={COLORS.primary} />
                  <Text style={styles.actionText}>Make Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => Linking.openURL("tel:9008828409")}>
                  <MaterialIcons name="call" size={24} color={COLORS.primary} />
                  <Text style={styles.actionText}>Call Support</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Profile Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="person" size={22} color={COLORS.textLight} />
                <Text style={styles.cardTitle}>Profile Information</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{customerName || "N/A"}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer ID</Text>
                  <Text style={styles.detailValue}>{customerID || "N/A"}</Text>
                </View>

                {!isAdmin && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Route</Text>
                    <Text style={styles.detailValue}>{route || "N/A"}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Credit Limit Card */}
            {!isAdmin && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="account-balance-wallet" size={22} color={COLORS.textLight} />
                  <Text style={styles.cardTitle}>Financial Information</Text>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Credit Limit</Text>
                    <Text style={styles.detailValue}>
                      {creditLimit !== null
                        ? creditLimit === Number.POSITIVE_INFINITY
                          ? "Unlimited"
                          : `₹${creditLimit.toLocaleString("en-IN")}`
                        : "Fetching..."}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pending Amount</Text>
                    <View style={styles.pendingAmountContainer}>
                      {isPendingAmountLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Text style={[styles.detailValue, isPendingAmountHigh && styles.highAmountText]}>
                          ₹
                          {pendingAmount === "Error"
                            ? "Error"
                            : Number.parseFloat(pendingAmount).toLocaleString("en-IN")}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {isPendingAmountHigh && (
                  <View style={styles.warningBanner}>
                    <MaterialIcons name="warning" size={20} color={COLORS.warning} />
                    <Text style={styles.warningText}>Your pending amount is high</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.cardButton} onPress={() => setModalVisible(true)}>
                  <Text style={styles.cardButtonText}>Pay Now</Text>
                  <MaterialIcons name="arrow-forward" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            )}

            {/* Last Order Details Card */}
            {!isAdmin && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="history" size={22} color={COLORS.textLight} />
                  <Text style={styles.cardTitle}>Last Order</Text>
                </View>

                <View style={styles.cardContent}>
                  {lastOrderDetails && lastOrderDetails.lastIndentDate ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order Type</Text>
                        <Text style={styles.detailValue}>{orderType || "N/A"}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantity</Text>
                        <Text style={styles.detailValue}>{quantity || "N/A"}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{formatDate(lastIndentDate)}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount</Text>
                        <Text style={styles.detailValue}>
                          ₹{totalAmount ? Number.parseFloat(totalAmount).toLocaleString("en-IN") : "0"}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.noOrdersContainer}>
                      <MaterialIcons name="shopping-cart" size={36} color={COLORS.textSecondary} />
                      <Text style={styles.noOrdersText}>No Orders Placed Yet</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.cardButton} onPress={() => navigation.navigate("OrderHistory")}>
                  <Text style={styles.cardButtonText}>View Order History</Text>
                  <MaterialIcons name="arrow-forward" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            )}

            {/* Admin Quick Links */}
            {isAdmin && (
              <View style={styles.adminLinksContainer}>
                <Text style={styles.adminLinksTitle}>Quick Actions</Text>

                <View style={styles.adminLinksGrid}>
                  <TouchableOpacity style={styles.adminLinkCard} onPress={() => navigation.navigate("ManageUsers")}>
                    <MaterialIcons name="people" size={32} color={COLORS.primary} />
                    <Text style={styles.adminLinkText}>Manage Users</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.adminLinkCard} onPress={() => navigation.navigate("ManageOrders")}>
                    <MaterialIcons name="shopping-bag" size={32} color={COLORS.primary} />
                    <Text style={styles.adminLinkText}>Manage Orders</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.adminLinkCard} onPress={() => navigation.navigate("Reports")}>
                    <MaterialIcons name="bar-chart" size={32} color={COLORS.primary} />
                    <Text style={styles.adminLinkText}>Reports</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.adminLinkCard} onPress={() => navigation.navigate("Settings")}>
                    <MaterialIcons name="settings" size={32} color={COLORS.primary} />
                    <Text style={styles.adminLinkText}>Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Support Section */}
            <View style={styles.supportSection}>
              <Text style={styles.supportTitle}>Need Help?</Text>
              <TouchableOpacity style={styles.supportButton} onPress={() => Linking.openURL("tel:9008828409")}>
                <MaterialIcons name="headset-mic" size={24} color={COLORS.textLight} />
                <Text style={styles.supportButtonText}>Contact Support</Text>
              </TouchableOpacity>
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
              <Text style={styles.modalTitle}>Payment Options</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.paymentSummary}>
                <Text style={styles.paymentSummaryLabel}>Total Pending</Text>
                <Text style={styles.paymentSummaryAmount}>
                  ₹{pendingAmount === "Error" ? "Error" : Number.parseFloat(pendingAmount).toLocaleString("en-IN")}
                </Text>
              </View>

              <TouchableOpacity style={styles.fullPaymentButton} onPress={handleFullPayment}>
                <MaterialIcons name="check-circle" size={22} color={COLORS.textLight} />
                <Text style={styles.fullPaymentText}>Pay Full Amount</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <Text style={styles.partialPaymentLabel}>Or Pay Partial Amount</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={partialAmount}
                  onChangeText={(text) => setPartialAmount(text.replace(/[^0-9.]/g, ""))}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.partialPaymentButton,
                  (!partialAmount || Number.parseFloat(partialAmount) <= 0) && styles.disabledButton,
                ]}
                onPress={handlePartialPayment}
                disabled={!partialAmount || Number.parseFloat(partialAmount) <= 0}
              >
                <Text style={styles.partialPaymentText}>Proceed to Payment</Text>
                <MaterialIcons name="arrow-forward" size={18} color={COLORS.textLight} />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textLight,
    flex: 1,
    marginLeft: 12,
  },
  refreshButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  innerContainer: {
    flex: 1,
    width: "100%",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  welcomeBanner: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textLight,
    opacity: 0.9,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textLight,
    marginTop: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },
  actionText: {
    color: COLORS.textPrimary,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.primary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textLight,
    marginLeft: 8,
  },
  cardContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  pendingAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  highAmountText: {
    color: COLORS.error,
    fontWeight: "700",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  warningText: {
    color: COLORS.warning,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  cardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    padding: 14,
    marginTop: 8,
  },
  cardButtonText: {
    color: COLORS.textLight,
    fontWeight: "600",
    marginRight: 8,
  },
  noOrdersContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  noOrdersText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  adminLinksContainer: {
    marginBottom: 20,
  },
  adminLinksTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  adminLinksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  adminLinkCard: {
    width: "48%",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    elevation: 2,
  },
  adminLinkText: {
    color: COLORS.textPrimary,
    marginTop: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  supportSection: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
    elevation: 2,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  supportButtonText: {
    color: COLORS.textLight,
    marginLeft: 8,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    elevation: 5,
  },
  modalHeader: { rderTopRightRadius: 20, overflow: "hidden", elevation: 5 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  modalBody: {
    padding: 16,
  },
  paymentSummary: {
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  paymentSummaryAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  fullPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  fullPaymentText: {
    color: COLORS.textLight,
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  partialPaymentLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  partialPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  partialPaymentText: {
    color: COLORS.textLight,
    fontWeight: "600",
    marginRight: 8,
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.7,
  },
})

export default HomePage
