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
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { ipAddress } from "../../urls"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { checkTokenAndRedirect } from "../../services/auth"
import { jwtDecode } from "jwt-decode"
import { Linking } from "react-native"

// Color Constants - Light Theme with Dark Blue Accents
const COLORS = {
    primary: "#0F2C59",
    secondary: "#E8EDF5",
    accent: "#3E6FCC",
    accentLight: "#5D87D6",
    text: "#0F2C59",
    textMuted: "#6B7C98",
    background: "#FFFFFF",
    cardBackground: "#FFFFFF",
    cardBackgroundAlt: "#F5F8FC",
    textPrimary: "#0F2C59",
    textSecondary: "#6B7C98",
    border: "#E1E7F0",
    error: "#FF6B6B",
    success: "#4CAF50",
    warning: "#FFC107",
    highlight: "#3E6FCC",
    shadow: "#1A3A6C",
    inputBackground: "#F5F8FC",
}

// Helper function to format epoch time
const formatDate = (epochTime) => {
  if (!epochTime) return "N/A"
  const date = new Date(epochTime * 1000)
  return date.toLocaleDateString()
}

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [lastOrderDetails, setLastOrderDetails] = useState(null)
  const [creditLimit, setCreditLimit] = useState(null)
  const [pendingAmount, setPendingAmount] = useState("0")
  const [isPendingAmountLoading, setIsPendingAmountLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false) // Modal visibility
  const [partialAmount, setPartialAmount] = useState("") // Partial payment input
  const navigation = useNavigation()

  const [isAdmin, setIsAdmin] = useState(false)

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
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert("Invalid Amount", "Please enter a positive number.")
      return
    }
    setModalVisible(false)
    setPartialAmount("") // Reset input
    navigation.navigate("Payments", { amount: parsedAmount })
  }

  const { customerName, customerID, route } = userDetails || {}
  const { lastIndentDate, totalAmount, orderType, quantity } = lastOrderDetails || {}

  return (
    <>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        )}

        {!isLoading && (
          <View style={styles.innerContainer}>
            {/* Profile Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons
                  name={isAdmin ? "admin-panel-settings" : "account-circle"}
                  size={32}
                  color={COLORS.accent}
                  style={styles.headerIcon}
                />
                <Text style={styles.cardTitle}>{isAdmin ? "Admin Profile" : "Customer Profile"}</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name:</Text>
                  <Text style={styles.detailValue}>{customerName || "N/A"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ID:</Text>
                  <Text style={styles.detailValue}>{customerID || "N/A"}</Text>
                </View>

                {!isAdmin && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Route:</Text>
                      <Text style={styles.detailValue}>{route || "N/A"}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Credit Limit:</Text>
                      <Text style={styles.detailValue}>
                        {creditLimit !== null
                          ? creditLimit === Number.POSITIVE_INFINITY
                            ? "N/A (No Limit)"
                            : `₹ ${creditLimit}`
                          : "Fetching..."}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL("tel:9008828409")}>
                      <MaterialIcons name="call" size={18} color={'#fff'} />
                      <Text style={styles.callText}>Call Us</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Amount Pending Card */}
            {!isAdmin && (
              <View style={[styles.card, Number.parseFloat(pendingAmount) > 5000 ? styles.highPendingAmount : null]}>
                <View style={styles.cardHeader}>
                  <MaterialIcons
                    name="pending-actions"
                    size={32}
                    color={Number.parseFloat(pendingAmount) > 5000 ? COLORS.warning : COLORS.accent}
                    style={styles.headerIcon}
                  />
                  <Text style={styles.cardTitle}>Amount Pending</Text>
                </View>

                <View style={styles.amountContainer}>
                  {isPendingAmountLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Text
                      style={[
                        styles.amountText,
                        Number.parseFloat(pendingAmount) > 5000 ? styles.highAmountText : null,
                      ]}
                    >
                      ₹ {pendingAmount === "Error" ? "Error" : pendingAmount}
                    </Text>
                  )}

                  <TouchableOpacity style={styles.payButton} onPress={() => setModalVisible(true)}>
                    <Text style={styles.payButtonText}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Last Order Details Card */}
            {!isAdmin && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="history" size={32} color={COLORS.accent} style={styles.headerIcon} />
                  <Text style={styles.cardTitle}>Last Order</Text>
                </View>

                <View style={styles.cardContent}>
                  {lastOrderDetails && lastOrderDetails.lastIndentDate ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order Type:</Text>
                        <Text style={styles.detailValue}>{orderType || "N/A"}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantity:</Text>
                        <Text style={styles.detailValue}>{quantity || "N/A"}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>{formatDate(lastIndentDate)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount:</Text>
                        <Text style={styles.detailValue}>₹ {totalAmount || "0"}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.noOrdersContainer}>
                      <MaterialIcons name="shopping-cart" size={36} color={COLORS.textSecondary} />
                      <Text style={styles.noOrdersText}>No Orders Placed Yet</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

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
                    <Text style={styles.modalTitle}>Choose Payment Option</Text>
                    <MaterialIcons name="payments" size={24} color={COLORS.accent} />
                  </View>

                  <TouchableOpacity style={styles.modalOptionButton} onPress={handleFullPayment}>
                    <MaterialIcons name="check-circle" size={20} color={'#fff'} />
                    <Text style={styles.modalOptionText}>Full Payment (₹ {pendingAmount})</Text>
                  </TouchableOpacity>

                  <View style={styles.modalDivider} />

                  <Text style={styles.modalSubtitle}>Partial Payment</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter amount"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    value={partialAmount}
                    onChangeText={(text) => setPartialAmount(text.replace(/[^0-9.]/g, ""))}
                  />

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalPayButton} onPress={handlePartialPayment}>
                      <Text style={styles.modalButtonText}>Pay</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => {
                        setModalVisible(false)
                        setPartialAmount("")
                      }}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:'#fff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  innerContainer: {
    flex: 1,
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.secondary,
  },
  headerIcon: {
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: "right",
  },
  callButton: {
    backgroundColor:'#003366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: '#fff',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  callText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: '#fff',
  },
  highPendingAmount: {
    backgroundColor: COLORS.cardBackgroundAlt,
  },
  amountContainer: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountText: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.text,
  },
  highAmountText: {
    color: COLORS.warning,
  },
  payButton: {
    backgroundColor: '#003366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: "600",
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
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(7, 19, 48, 0.8)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(7, 19, 48, 0.8)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 350,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.secondary,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
    marginHorizontal: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  modalOptionButton: {
    backgroundColor: '#003366',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionText: {
    color:'#fff',
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalInput: {
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  modalPayButton: {
    backgroundColor: '#003366',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: 'red',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderRadius: 10,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: "600",
  },
})

export default HomePage

