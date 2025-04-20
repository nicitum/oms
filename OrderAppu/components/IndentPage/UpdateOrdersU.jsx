"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  LogBox,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Toast from "react-native-toast-message"
import { jwtDecode } from "jwt-decode"
import Icon from "react-native-vector-icons/FontAwesome"
import SearchProductModal from "../IndentPage/nestedPage/searchProductModal"
import { checkTokenAndRedirect } from "../../services/auth"
import moment from "moment"
import { ipAddress } from "../../urls"

// Ignore specific warnings
LogBox.ignoreLogs(["Possible Unhandled Promise Rejection"])

const showToast = (message, type = "info") => {
  Toast.show({
    type,
    text1: type === "info" ? "Order Information" : type === "error" ? "Error" : "Success",
    text2: message,
    position: "top",
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 50,
    propsOverride: { text2Style: { flexWrap: "wrap", width: "100%", fontSize: 14 } },
  })
}

const UpdateOrdersU = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteLoadingIndex, setDeleteLoadingIndex] = useState(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [orderDeleteLoading, setOrderDeleteLoading] = useState(false)
  const [orderDeleteLoadingId, setOrderDeleteLoadingId] = useState(null)
  const [originalOrderAmounts, setOriginalOrderAmounts] = useState({})
  const [quantityInputs, setQuantityInputs] = useState({})

  useEffect(() => {
    const initialize = async () => {
      console.log("[DEBUG] Initializing component")
      setLoading(true)
      const { order } = route.params || {}
      console.log("[DEBUG] Orders from route params:", order)
      const orderId = order?.orderId

      await fetchUsersOrders()

      if (orderId) {
        setSelectedOrderId(orderId)
        await fetchOrderProducts(orderId)
      }
      setLoading(false)
    }
    initialize()
  }, [route.params])

  const fetchUsersOrders = async (selectedDate = null) => {
    console.log("[DEBUG] Fetching user orders")
    setLoading(true)
    setError(null)
    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const decodedToken = jwtDecode(token)
      const custId = decodedToken.id

      // Construct the URL with optional date query parameter
      let url = `http://${ipAddress}:8090/get-orders/${custId}`
      if (selectedDate) {
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          throw new Error("Invalid date format. Use YYYY-MM-DD")
        }
        url += `?date=${selectedDate}`
      }
      console.log("[DEBUG] Fetching orders from:", url)

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const response = await axios.get(url, { headers, timeout: 10000 })

      console.log("[DEBUG] Orders response:", response.data)

      const ordersData = response.data
      if (!ordersData.status) {
        throw new Error(ordersData.message || "Failed to fetch orders")
      }

      const todayFormatted = moment().format("YYYY-MM-DD")

      // Filter orders for today and future dates if no specific date is provided
      const filteredOrders = selectedDate
        ? ordersData.orders // Use all orders for the selected date
        : ordersData.orders.filter((order) => {
            if (!order.placed_on) return false
            const parsedEpochSeconds = Number.parseInt(order.placed_on, 10)
            const orderDateFormatted = moment.unix(parsedEpochSeconds).format("YYYY-MM-DD")
            return orderDateFormatted >= todayFormatted
          })

      setOrders(filteredOrders)
      const amountsMap = {}
      filteredOrders.forEach((order) => (amountsMap[order.id] = order.total_amount))
      setOriginalOrderAmounts(amountsMap)
    } catch (error) {
      console.error("[ERROR] Failed to fetch orders:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch customer orders."
      setError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderProducts = async (orderIdToFetch) => {
    if (!orderIdToFetch) {
      showToast("Invalid order ID.", "error")
      return
    }

    console.log("[DEBUG] Fetching order products for order:", orderIdToFetch)
    setLoading(true)
    setError(null)

    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const url = `http://${ipAddress}:8090/order-products?orderId=${orderIdToFetch}`
      console.log("[DEBUG] Fetching products from:", url)

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const response = await axios.get(url, { headers, timeout: 10000 })

      console.log("[DEBUG] Products response:", response.data)

      const productsData = response.data
      if (!Array.isArray(productsData)) {
        throw new Error("Invalid products data received from server.")
      }

      setProducts(productsData)
      setSelectedOrderId(orderIdToFetch)

      const inputs = {}
      productsData.forEach((product, index) => {
        inputs[index] = product.quantity.toString()
      })
      setQuantityInputs(inputs)
    } catch (error) {
      console.error("[ERROR] Failed to fetch products:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch order products."
      setError(errorMsg)
      showToast(errorMsg, "error")
      setProducts([])
      setSelectedOrderId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityInputChange = (index, text) => {
    const cleanValue = text.replace(/[^0-9]/g, "")
    setQuantityInputs((prev) => ({
      ...prev,
      [index]: cleanValue === "" ? "" : cleanValue,
    }))
  }

  const handleQuantityBlur = (index) => {
    const rawQuantity = quantityInputs[index] || "0"
    const quantity = Number.parseInt(rawQuantity, 10)
    if (isNaN(quantity)) {
      showToast("Invalid quantity. Resetting to previous value.", "error")
      setQuantityInputs((prev) => ({
        ...prev,
        [index]: products[index].quantity.toString(),
      }))
      return
    }

    const newProducts = [...products]
    newProducts[index].quantity = quantity
    setProducts(newProducts)
    setQuantityInputs((prev) => ({
      ...prev,
      [index]: quantity.toString(),
    }))
  }

  const handleDeleteProductItem = async (indexToDelete) => {
    const productToDelete = products[indexToDelete]
    if (!productToDelete || !productToDelete.order_id) {
      showToast("Could not delete product item. Order Product ID missing.", "error")
      return
    }

    console.log("[DEBUG] Deleting product item:", indexToDelete)
    setDeleteLoading(true)
    setDeleteLoadingIndex(indexToDelete)
    setError(null)

    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const orderToCheck = orders.find((order) => order.id === productToDelete.order_id)
      if (orderToCheck?.loading_slip === "Yes") {
        showToast("Loading slip already generated for this order.", "error")
        return
      }

      const url = `http://${ipAddress}:8090/delete_order_product/${productToDelete.product_id}`
      console.log("[DEBUG] Deleting product at:", url)

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const response = await axios.delete(url, { headers, timeout: 10000 })

      console.log("[DEBUG] Delete response:", response.data)

      if (products.length === 1) {
        await handleDeleteOrder(selectedOrderId)
      } else {
        const updatedProducts = products.filter((_, index) => index !== indexToDelete)
        setProducts(updatedProducts)

        const newQuantityInputs = {}
        updatedProducts.forEach((product, newIndex) => {
          newQuantityInputs[newIndex] = product.quantity.toString()
        })
        setQuantityInputs(newQuantityInputs)

        showToast(response.data.message || "Product item deleted successfully.", "success")
      }
    } catch (error) {
      console.error("[ERROR] Failed to delete product:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to delete order product."
      setError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setDeleteLoading(false)
      setDeleteLoadingIndex(null)
    }
  }

  const checkCreditLimit = async () => {
    try {
      console.log("[DEBUG] Checking credit limit")
      const userAuthToken = await checkTokenAndRedirect(navigation)
      if (!userAuthToken) {
        showToast("Authorization token missing.", "error")
        return null
      }

      const decodedToken = jwtDecode(userAuthToken)
      const customerId = decodedToken.id
      const url = `http://${ipAddress}:8090/credit-limit?customerId=${customerId}`

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })

      if (response.data?.creditLimit !== undefined) {
        return Number.parseFloat(response.data.creditLimit)
      }

      showToast("Failed to fetch credit limit.", "error")
      return null
    } catch (error) {
      console.error("[ERROR] Credit limit check failed:", error)
      showToast("Error checking credit limit.", "error")
      return null
    }
  }

  const handleUpdateOrder = async () => {
    if (!selectedOrderId) {
      Alert.alert("Error", "Please select an order to update.")
      return
    }
    if (products.length === 0) {
      showToast("Cannot update an order with no products.", "error")
      return
    }

    console.log("[DEBUG] Updating order:", selectedOrderId)
    setLoading(true)
    setError(null)

    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const orderToCheck = orders.find((order) => order.id === selectedOrderId)
      if (orderToCheck?.loading_slip === "Yes") {
        showToast("Loading slip already generated for this order.", "error")
        return
      }

      // Make sure we're using the latest quantity values from the inputs
      const updatedProducts = products.map((product, index) => {
        const quantity = Number.parseInt(quantityInputs[index] || product.quantity, 10) || 0
        return {
          ...product,
          quantity,
        }
      })

      const productsToUpdate = updatedProducts.map((product) => ({
        order_id: selectedOrderId,
        product_id: product.product_id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity: Number.parseInt(product.quantity, 10) || 0,
        gst_rate: product.gst_rate,
      }))

      const validProducts = productsToUpdate.filter((p) => p.quantity > 0)
      if (validProducts.length === 0) {
        showToast("All products have zero quantity.", "error")
        return
      }

      const calculatedTotalAmount = validProducts.reduce((sum, product) => sum + product.quantity * product.price, 0)

      const originalOrderAmount = originalOrderAmounts[selectedOrderId] || 0
      const orderAmountDifference = calculatedTotalAmount - originalOrderAmount

      const creditLimit = await checkCreditLimit()
      if (creditLimit === null) throw new Error("Unable to verify credit limit")
      if (calculatedTotalAmount > creditLimit) {
        showToast(
          `Order amount (₹${calculatedTotalAmount.toFixed(2)}) exceeds your credit limit (₹${creditLimit.toFixed(2)})`,
          "error",
        )
        return
      }

      const url = `http://${ipAddress}:8090/order_update`
      console.log("[DEBUG] Updating order at:", url, {
        orderId: selectedOrderId,
        products: validProducts,
        totalAmount: calculatedTotalAmount,
      })

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const response = await axios.post(
        url,
        {
          orderId: selectedOrderId,
          products: validProducts,
          totalAmount: calculatedTotalAmount,
        },
        { headers, timeout: 15000 },
      )

      console.log("[DEBUG] Update response:", response.data)

      if (response.status === 200) {
        const customerIdForCreditUpdate = jwtDecode(token).id

        // Update credit limit
        try {
          if (orderAmountDifference > 0) {
            await axios.post(
              `http://${ipAddress}:8090/credit-limit/deduct`,
              { customerId: customerIdForCreditUpdate, amountChange: orderAmountDifference },
              { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, timeout: 10000 },
            )
          } else if (orderAmountDifference < 0) {
            await axios.post(
              `http://${ipAddress}:8090/increase-credit-limit`,
              { customerId: customerIdForCreditUpdate, amountToIncrease: Math.abs(orderAmountDifference) },
              { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, timeout: 10000 },
            )
          }

          await axios.post(
            `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
            {
              customerId: customerIdForCreditUpdate,
              totalOrderAmount: calculatedTotalAmount,
              originalOrderAmount,
            },
            { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, timeout: 10000 },
          )
        } catch (creditError) {
          console.error("[ERROR] Credit update failed:", creditError)
          // Continue even if credit update fails
        }

        showToast("Order updated successfully!", "success")

        // Refresh the orders list to show the updated data
        await fetchUsersOrders()

        // Refresh the products for the current order to ensure UI is in sync with backend
        if (selectedOrderId) {
          await fetchOrderProducts(selectedOrderId)
        } else {
          setSelectedOrderId(null)
          setProducts([])
          setQuantityInputs({})
        }
      } else {
        throw new Error(response.data.message || "Failed to update order.")
      }
    } catch (error) {
      console.error("[ERROR] Order update failed:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to update order."
      setError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOrder = async (orderIdToDelete) => {
    console.log("[DEBUG] Deleting order:", orderIdToDelete)
    setOrderDeleteLoading(true)
    setOrderDeleteLoadingId(orderIdToDelete)
    setError(null)

    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const orderToCheck = orders.find((order) => order.id === orderIdToDelete)
      if (orderToCheck?.loading_slip === "Yes") {
        showToast("Loading slip already generated for this order.", "error")
        return
      }

      const url = `http://${ipAddress}:8090/cancel_order/${orderIdToDelete}`
      console.log("[DEBUG] Deleting order at:", url)

      const response = await axios.post(url, {}, { headers, timeout: 10000 })
      console.log("[DEBUG] Delete order response:", response.data)

      if (response.data.success) {
        const cancelledOrder = orders.find((order) => order.id === orderIdToDelete)
        if (cancelledOrder) {
          const { customer_id: customerId, total_amount: cancelledOrderAmount } = cancelledOrder
          if (customerId && cancelledOrderAmount !== undefined && cancelledOrderAmount !== null) {
            try {
              await axios.post(
                `http://${ipAddress}:8090/increase-credit-limit`,
                { customerId, amountToIncrease: cancelledOrderAmount },
                { headers, timeout: 10000 },
              )

              await axios.post(
                `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
                {
                  customerId,
                  totalOrderAmount: 0,
                  originalOrderAmount: cancelledOrderAmount,
                },
                { headers, timeout: 10000 },
              )
            } catch (creditError) {
              console.error("[ERROR] Credit update failed:", creditError)
              // Continue even if credit update fails
            }
          }
        }

        setSelectedOrderId(null)
        setProducts([])
        setQuantityInputs({})
        setOriginalOrderAmounts((prev) => {
          const newAmounts = { ...prev }
          delete newAmounts[orderIdToDelete]
          return newAmounts
        })

        await fetchUsersOrders()

        showToast(`Order #${orderIdToDelete} cancelled successfully.`, "success")
      } else {
        throw new Error(response.data.message || "Failed to cancel the order.")
      }
    } catch (error) {
      console.error("[ERROR] Order deletion failed:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to cancel order."
      setError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setOrderDeleteLoading(false)
      setOrderDeleteLoadingId(null)
    }
  }

  const fetchLatestPriceFromOrderProducts = async (productId) => {
    try {
      console.log("[DEBUG] Fetching latest price for product:", productId)
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        return null
      }

      const url = `http://${ipAddress}:8090/latest-product-price?productId=${productId}`
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      })

      return response.data.price
    } catch (error) {
      console.error("[ERROR] Failed to fetch latest price:", error)
      return null
    }
  }

  const handleAddProductToOrder = async (productToAdd) => {
    if (!selectedOrderId) {
      Alert.alert("Error", "Please select an order before adding products.")
      return
    }

    console.log("[DEBUG] Adding product to order:", productToAdd)
    const isProductAlreadyAdded = products.some((p) => p.product_id === productToAdd.id)
    if (isProductAlreadyAdded) {
      showToast("This product is already in the order. Please update quantity instead.", "info")
      setShowSearchModal(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = await AsyncStorage.getItem("userAuthToken")
      if (!token) {
        throw new Error("Authentication token missing")
      }

      const decodedToken = jwtDecode(token)
      const custId = decodedToken.id
      const orderToCheck = orders.find((order) => order.id === selectedOrderId)
      if (orderToCheck?.loading_slip === "Yes") {
        showToast("Loading slip already generated for this order.", "error")
        return
      }

      let priceToUse = productToAdd.price

      try {
        const customerPriceCheckUrl = `http://${ipAddress}:8090/customer_price_check?customer_id=${custId}`
        const customerPriceResponse = await axios.get(customerPriceCheckUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        })

        if (customerPriceResponse.data) {
          const customerPrices = customerPriceResponse.data
          const specificPrice = customerPrices.find((item) => item.product_id === productToAdd.id)
          if (specificPrice?.customer_price !== undefined && specificPrice?.customer_price !== null) {
            priceToUse = specificPrice.customer_price
          } else {
            const latestPrice = await fetchLatestPriceFromOrderProducts(productToAdd.id)
            if (latestPrice !== null) {
              priceToUse = latestPrice
            }
          }
        }
      } catch (priceError) {
        console.error("[ERROR] Customer price check failed:", priceError)
        const latestPrice = await fetchLatestPriceFromOrderProducts(productToAdd.id)
        if (latestPrice !== null) {
          priceToUse = latestPrice
        }
      }

      const url = `http://${ipAddress}:8090/add-product-to-order`
      console.log("[DEBUG] Adding product at:", url, {
        orderId: selectedOrderId,
        productId: productToAdd.id,
        quantity: 1,
        price: priceToUse,
        name: productToAdd.name,
        category: productToAdd.category,
        gst_rate: productToAdd.gst_rate,
      })

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      const response = await axios.post(
        url,
        {
          orderId: selectedOrderId,
          productId: productToAdd.id,
          quantity: 1,
          price: priceToUse,
          name: productToAdd.name,
          category: productToAdd.category,
          gst_rate: productToAdd.gst_rate,
        },
        { headers, timeout: 10000 },
      )

      console.log("[DEBUG] Add product response:", response.data)

      if (response.data.success) {
        showToast(`${productToAdd.name} added for ₹${priceToUse.toFixed(2)}.`, "success")
        setShowSearchModal(false)
        await fetchOrderProducts(selectedOrderId)
      } else {
        throw new Error(response.data.message || "Failed to add product to order.")
      }
    } catch (error) {
      console.error("[ERROR] Failed to add product:", error)
      const errorMsg = error.response?.data?.message || error.message || "Failed to add product to order."
      setError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  // Redesigned render functions
  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.orderItem, selectedOrderId === item.id && styles.selectedOrderItem]}
      onPress={() => fetchOrderProducts(item.id)}
    >
      <View style={styles.orderItemContent}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderIdText}>Order #{item.id}</Text>
          <Text style={styles.orderDateText}>
            {moment.unix(Number.parseInt(item.placed_on, 10)).format("h:mm A, MMM D, YYYY")}
          </Text>
        </View>
        <View style={styles.orderAmountContainer}>
          <Text style={styles.orderAmountText}>
            ₹{item.total_amount ? Number.parseFloat(item.total_amount).toFixed(2) : "0.00"}
          </Text>
          {item.loading_slip === "Yes" && (
            <View style={styles.loadingSlipBadge}>
              <Text style={styles.loadingSlipText}>Processed</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.deleteOrderButton, item.loading_slip === "Yes" && styles.disabledDeleteButton]}
          onPress={() => handleDeleteOrder(item.id)}
          disabled={orderDeleteLoading || item.loading_slip === "Yes"}
        >
          {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="trash" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  const renderProductItem = ({ item, index }) => {
    const totalAmount = (Number.parseInt(quantityInputs[index] || item.quantity, 10) || 0) * item.price

    return (
      <View style={styles.productItem}>
        <View style={styles.productInfoContainer}>
          <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
            {item.name}
          </Text>
          <Text style={styles.gstRateText}>GST: {item.gst_rate}%</Text>
        </View>

        <View style={styles.productDetailsContainer}>
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Qty</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantityInputs[index] || ""}
              onChangeText={(text) => handleQuantityInputChange(index, text)}
              onBlur={() => handleQuantityBlur(index)}
              keyboardType="numeric"
              maxLength={4}
              editable={!loading && !(selectedOrder && selectedOrder.loading_slip === "Yes")}
              placeholder="0"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.productPrice}>₹{item.price.toFixed(2)}</Text>
          </View>

          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.productTotal}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteProductItem(index)}
            disabled={deleteLoading || (selectedOrder && selectedOrder.loading_slip === "Yes")}
          >
            {deleteLoading && deleteLoadingIndex === index ? (
              <ActivityIndicator size="small" color="#dc3545" />
            ) : (
              <Icon
                name="trash"
                size={18}
                color={selectedOrder && selectedOrder.loading_slip === "Yes" ? "#ccc" : "#dc3545"}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const totalAmount = products.reduce((sum, product) => {
    const quantity = Number.parseInt(quantityInputs[products.indexOf(product)] || product.quantity, 10) || 0
    return sum + quantity * product.price
  }, 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Update Orders</Text>
        <TouchableOpacity onPress={fetchUsersOrders} style={styles.refreshButton}>
          <Icon name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !selectedOrderId && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#003366" />
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Orders</Text>
            <Text style={styles.orderCount}>
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {orders.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Icon name="shopping-basket" size={50} color="#ccc" />
              <Text style={styles.emptyText}>No orders for today</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.orderList}
            />
          )}
        </View>

        {selectedOrderId && selectedOrder && (
          <View style={styles.editContainer}>
            <View style={styles.orderDetails}>
              <View style={styles.orderDetailRow}>
                <View style={styles.orderDetailItem}>
                  <Icon name="calendar" size={16} color="#555" style={styles.detailIcon} />
                  <Text style={styles.orderDetailText}>
                    <Text style={styles.detailLabel}>Order Date: </Text>
                    {moment.unix(Number.parseInt(selectedOrder.placed_on, 10)).format("MMM D, YYYY")}
                  </Text>
                </View>
                <View style={styles.orderDetailItem}>
                  <Icon name="clock-o" size={16} color="#555" style={styles.detailIcon} />
                  <Text style={styles.orderDetailText}>
                    <Text style={styles.detailLabel}>Shift: </Text>
                    {selectedOrder.order_type || "N/A"}
                  </Text>
                </View>
              </View>
              <View style={styles.orderDetailRow}>
                <View style={styles.orderDetailItem}>
                  <Icon name="tag" size={16} color="#555" style={styles.detailIcon} />
                  <Text style={styles.orderDetailText}>
                    <Text style={styles.detailLabel}>Status: </Text>
                    {selectedOrder.loading_slip === "Yes" ? (
                      <Text style={styles.processedText}>Processed</Text>
                    ) : (
                      <Text style={styles.pendingText}>Pending</Text>
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.editHeader}>
              <Text style={styles.sectionTitle}>Edit Order #{selectedOrderId}</Text>
              <TouchableOpacity
                style={[styles.searchButton, selectedOrder.loading_slip === "Yes" && styles.disabledButton]}
                onPress={() => setShowSearchModal(true)}
                disabled={selectedOrder.loading_slip === "Yes"}
              >
                <Icon name="plus" size={18} color="#fff" />
                <Text style={styles.searchButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyProductsContainer}>
                <Icon name="box-open" size={50} color="#ccc" />
                <Text style={styles.emptyProductsText}>No products in this order</Text>
                <TouchableOpacity
                  style={[styles.addProductsButton, selectedOrder.loading_slip === "Yes" && styles.disabledButton]}
                  onPress={() => setShowSearchModal(true)}
                  disabled={selectedOrder.loading_slip === "Yes"}
                >
                  <Text style={styles.addProductsButtonText}>Add Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  data={products}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={renderProductItem}
                  scrollEnabled={false}
                  contentContainerStyle={styles.productList}
                  ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
                />
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Items:</Text>
                    <Text style={styles.summaryValue}>
                      {products.length} item{products.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Amount:</Text>
                    <Text style={styles.summaryAmount}>₹{totalAmount.toFixed(2)}</Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.updateButton, selectedOrder.loading_slip === "Yes" && styles.disabledButton]}
                onPress={handleUpdateOrder}
                disabled={loading || selectedOrder.loading_slip === "Yes"}
              >
                <Text style={styles.updateButtonText}>
                  {selectedOrder.loading_slip === "Yes" ? "Order Processed" : "Update Order"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Toast />
      <SearchProductModal
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddProduct={handleAddProductToOrder}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#003366",
    borderBottomWidth: 1,
    borderBottomColor: "#002244",
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  refreshButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 10,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  errorContainer: {
    margin: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
    padding: 12,
    backgroundColor: "#dc3545",
    fontSize: 14,
  },
  ordersContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#003366",
  },
  orderCount: {
    fontSize: 14,
    color: "#ffffff",
    backgroundColor: "#003366",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 12,
    fontSize: 16,
  },
  orderList: {
    paddingBottom: 12,
  },
  orderItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedOrderItem: {
    borderWidth: 2,
    borderColor: "#003366",
    backgroundColor: "#e6f0ff",
  },
  orderItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  orderInfo: {
    flex: 2,
    paddingRight: 10,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
  },
  orderDateText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  orderAmountContainer: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 10,
  },
  orderAmountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
  },
  loadingSlipBadge: {
    backgroundColor: "#28a745",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  loadingSlipText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  deleteOrderButton: {
    backgroundColor: "#dc3545",
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledDeleteButton: {
    backgroundColor: "#ccc",
  },
  editContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderDetails: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  orderDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailIcon: {
    marginRight: 8,
  },
  orderDetailText: {
    fontSize: 14,
    color: "#333",
  },
  detailLabel: {
    fontWeight: "600",
    color: "#555",
  },
  processedText: {
    color: "#28a745",
    fontWeight: "600",
  },
  pendingText: {
    color: "#003366",
    fontWeight: "600",
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: "#003366",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  searchButtonText: {
    color: "#ffffff",
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyProductsContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginVertical: 12,
  },
  emptyProductsText: {
    textAlign: "center",
    color: "#666",
    marginVertical: 12,
    fontSize: 16,
  },
  addProductsButton: {
    backgroundColor: "#003366",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  addProductsButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  productList: {
    paddingVertical: 8,
  },
  productSeparator: {
    height: 1,
    backgroundColor: "#e9ecef",
    marginVertical: 8,
  },
  productItem: {
    paddingVertical: 12,
  },
  productInfoContainer: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  gstRateText: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  productDetailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  quantityContainer: {
    flex: 1,
  },
  quantityLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: "#ced4da",
    padding: 8,
    width: 60,
    textAlign: "center",
    borderRadius: 6,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  priceContainer: {
    flex: 1,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: "#333",
  },
  totalContainer: {
    flex: 1,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  productTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#003366",
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContainer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: "#e9ecef",
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003366",
  },
  footer: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: "#e9ecef",
  },
  updateButton: {
    backgroundColor: "#003366",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  updateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default UpdateOrdersU
