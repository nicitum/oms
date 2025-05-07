import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SearchProductModal from '../IndentPage/nestedPage/searchProductModal';
import moment from 'moment';
import { checkTokenAndRedirect } from '../../services/auth';
import { ipAddress } from '../../urls';

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

const UpdateOrderScreen = () => {
    const navigation = useNavigation();
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [customerDetails, setCustomerDetails] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isOrderUpdated, setIsOrderUpdated] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteLoadingIndex, setDeleteLoadingIndex] = useState(null);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [orderDeleteLoading, setOrderDeleteLoading] = useState(false);
    const [orderDeleteLoadingId, setOrderDeleteLoadingId] = useState(null);
    const [selectedOrderCustomerId, setSelectedOrderCustomerId] = useState(null);
    const [quantityInputs, setQuantityInputs] = useState({});
    const [originalOrderAmounts, setOriginalOrderAmounts] = useState({});

    useEffect(() => {
        fetchAdminOrders();
    }, []);

    const fetchAdminOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("No authentication token found");
    
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;
    
            const todayFormatted = moment().format("YYYY-MM-DD");
            const url = `http://${ipAddress}:8091/get-admin-orders/${adminId}?date=${todayFormatted}`;
            console.log("[DEBUG] Fetching admin orders from:", url);
    
            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            };
    
            const ordersResponse = await fetch(url, { headers });
    
            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                throw new Error(`Failed to fetch admin orders: ${ordersResponse.status}, ${errorText}`);
            }
    
            const ordersData = await ordersResponse.json();
            if (!ordersData.success) {
                throw new Error(ordersData.message || "Failed to fetch admin orders");
            }
    
            console.log("[DEBUG] Fetched orders data:", ordersData);
    
            setOrders(ordersData.orders);
        } catch (fetchOrdersError) {
            const errorMessage = fetchOrdersError.message || "Failed to fetch admin orders.";
            setError(errorMessage);
            Toast.show({
                type: 'error',
                text1: 'Fetch Error',
                text2: errorMessage
            });
            console.error("[ERROR] Error fetching admin orders:", fetchOrdersError);
        } finally {
            setLoading(false);
        }
    };

    
    const fetchOrderProducts = async (orderIdToFetch) => {
        setLoading(true);
        setError(null);
        setIsOrderUpdated(false);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const url = `http://${ipAddress}:8091/order-products?orderId=${orderIdToFetch}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            const productsResponse = await fetch(url, { headers });

            if (!productsResponse.ok) {
                const errorText = await productsResponse.text();
                const message = `Failed to fetch order products. Status: ${productsResponse.status}, Text: ${errorText}`;
                console.error("FETCH ORDER PRODUCTS - Error Response Text:", errorText);
                if (productsResponse.status !== 404) {
                    throw new Error(message);
                } else {
                    console.log("FETCH ORDER PRODUCTS - No products found for this order, initializing empty product list.");
                    setProducts([]);
                    setSelectedOrderId(orderIdToFetch);
                    const selectedOrder = orders.find(order => order.id === orderIdToFetch);
                    if (selectedOrder) {
                        setSelectedOrderCustomerId(selectedOrder.customer_id);
                    }
                    return;
                }
            }

            const productsData = await productsResponse.json();
            console.log("FETCH ORDER PRODUCTS - Response Data:", productsData);
            setProducts(productsData);
            setSelectedOrderId(orderIdToFetch);
            const selectedOrder = orders.find(order => order.id === orderIdToFetch);
            if (selectedOrder) {
                setSelectedOrderCustomerId(selectedOrder.customer_id);
            }

        } catch (error) {
            console.error("FETCH ORDER PRODUCTS - Fetch Error:", error);
            setError(error.message || "Failed to fetch order products.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: error.message || "Failed to fetch order products." });
            setProducts([]);
            setSelectedOrderId(null);
            setSelectedOrderCustomerId(null);
        } finally {
            setLoading(false);
        }
    };

    const handleProductQuantityChange = (index, text) => {
        if (isOrderUpdated) return;
        const newProducts = [...products];
        newProducts[index].quantity = parseInt(text, 10) || 0;
        setProducts(newProducts);
    };

    const handleDeleteProductItem = async (indexToDelete) => {
        if (isOrderUpdated) return;

        const productToDelete = products[indexToDelete];
        if (!productToDelete || !productToDelete.order_id) {
            console.error("Order Product ID missing for deletion.");
            Toast.show({ type: 'error', text1: 'Deletion Error', text2: "Could not delete product item. Order Product ID missing." });
            return;
        }

        setDeleteLoading(true);
        setDeleteLoadingIndex(indexToDelete);
        setError(null);

        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const orderProductIdToDelete = productToDelete.product_id;
            console.log(orderProductIdToDelete);

            const url = `http://${ipAddress}:8091/delete_order_product/${orderProductIdToDelete}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };
            const deleteResponse = await fetch(url, {
                method: 'DELETE',
                headers: headers,
            });

            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                const message = `Failed to delete order product. Status: ${deleteResponse.status}, Text: ${errorText}`;
                console.error("DELETE ORDER PRODUCT - Error Response Status:", deleteResponse.status, "Status Text:", deleteResponse.statusText);
                console.error("DELETE ORDER PRODUCT - Full Error Response:", errorText);
                throw new Error(message);
            }

            const deleteData = await deleteResponse.json();
            console.log("DELETE ORDER PRODUCT - Response Data:", deleteData);

            if (products.length === 1) {
                await handleDeleteOrder(selectedOrderId);
            } else {
                const updatedProducts = products.filter((_, index) => index !== indexToDelete);
                setProducts(updatedProducts);
                Toast.show({
                    type: 'success',
                    text1: 'Product Item Deleted',
                    text2: deleteData.message || "Product item deleted successfully from order."
                });
            }
            setIsOrderUpdated(false);

        } catch (deleteError) {
            console.error("DELETE ORDER PRODUCT - Error:", deleteError);
            setError(deleteError.message || "Failed to delete order product.");
            Toast.show({ type: 'error', text1: 'Deletion Error', text2: deleteError.message || "Failed to delete product item." });
        } finally {
            setDeleteLoading(false);
            setDeleteLoadingIndex(null);
        }
    };

    const checkCreditLimit = async () => {
        try {
            const userAuthToken = await checkTokenAndRedirect(navigation);
            if (!userAuthToken) {
                Toast.show({
                    type: 'error',
                    text1: 'Authentication Error',
                    text2: "Authorization token missing."
                });
                return null;
            }
            const decodedToken = jwtDecode(userAuthToken);
            const customerId = decodedToken.id;

            const creditLimitResponse = await fetch(`http://${ipAddress}:8091/credit-limit?customerId=${customerId}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${userAuthToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (creditLimitResponse.ok) {
                const creditData = await creditLimitResponse.json();
                return parseFloat(creditData.creditLimit);
            } else if (creditLimitResponse.status === 404) {
                console.log("Credit limit not found for customer, proceeding without limit check.");
                return Infinity;
            } else {
                console.error("Error fetching credit limit:", creditLimitResponse.status, creditLimitResponse.statusText);
                Toast.show({
                    type: 'error',
                    text1: 'Credit Limit Error',
                    text2: "Failed to fetch credit limit."
                });
                return null;
            }

        } catch (error) {
            console.error("Error checking credit limit:", error);
            Toast.show({
                type: 'error',
                text1: 'Credit Limit Error',
                text2: "Error checking credit limit."
            });
            return null;
        }
    };

    const handleUpdateOrder = async () => {
        if (!selectedOrderId) {
            Alert.alert("Error", "Please select an order to update.");
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const token = await AsyncStorage.getItem("userAuthToken");

            let calculatedTotalAmount = 0;
            const productsToUpdate = products.map(product => ({
                order_id: selectedOrderId,
                product_id: product.product_id,
                name: product.name,
                category: product.category,
                price: product.price,
                quantity: product.quantity,
                gst_rate:product.gst_rate
            }));

            productsToUpdate.forEach(product => {
                calculatedTotalAmount += product.quantity * product.price;
            });

            const creditLimit = await checkCreditLimit();
            if (creditLimit === null) {
                setLoading(false);
                return;
            }

            if (creditLimit !== Infinity && calculatedTotalAmount > creditLimit) {
                setLoading(false);
                const exceededAmount = (calculatedTotalAmount - creditLimit).toFixed(2);
                Toast.show({
                    type: 'error',
                    text1: 'Credit Limit Reached',
                    text2: `Updated order amount exceeds credit limit by ₹${exceededAmount}. Please adjust quantities.`
                });
                return;
            }

            const url = `http://${ipAddress}:8091/order_update`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };
            const requestBody = {
                orderId: selectedOrderId,
                products: productsToUpdate,
                totalAmount: calculatedTotalAmount,
                total_amount: calculatedTotalAmount
            };

            console.log("UPDATE ORDER - Request URL (Admin App):", url);
            console.log("UPDATE ORDER - Request Headers (Admin App):", headers);
            console.log("UPDATE ORDER - Request Body (Admin App):", JSON.stringify(requestBody, null, 2));

            const updateResponse = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            console.log("UPDATE ORDER - Response Status (Admin App):", updateResponse.status);
            console.log("UPDATE ORDER - Response Status Text (Admin App):", updateResponse.statusText);

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                const message = `Failed to update order products and total amount. Status: ${updateResponse.status}, Text: ${errorText}`;
                console.error("UPDATE ORDER - Error Response Text (Admin App):", errorText);
                throw new Error(message);
            }

            const updateData = await updateResponse.json();
            console.log("UPDATE ORDER - Response Data (Admin App):", updateData);

            if (updateResponse.status === 200) {
                const originalOrder = orders.find(order => order.id === selectedOrderId);

                if (originalOrder) {
                    const originalTotalAmount = originalOrder.total_amount;
                    const amountDifference = calculatedTotalAmount - originalTotalAmount;
                    const customerId = originalOrder.customer_id;

                    console.log("DEBUG - handleUpdateOrder (Admin App): originalTotalAmount:", originalTotalAmount);
                    console.log("DEBUG - handleUpdateOrder (Admin App): calculatedTotalAmount:", calculatedTotalAmount);
                    console.log("DEBUG - handleUpdateOrder (Admin App): amountDifference:", amountDifference);
                    console.log("DEBUG - handleUpdateOrder (Admin App): customerId:", customerId);

                    if (amountDifference > 0) {
                        const deductCreditOptions = {
                            method: 'POST',
                            url: `http://${ipAddress}:8091/credit-limit/deduct`,
                            data: {
                                customerId: customerId,
                                amountChange: amountDifference,
                            },
                            headers: { 'Content-Type': 'application/json' },
                        };

                        try {
                            const deductCreditResponse = await axios(deductCreditOptions);
                            if (deductCreditResponse.status !== 200) {
                                console.error("Error deducting credit limit on order update (Admin App):", deductCreditResponse.status, deductCreditResponse.statusText, deductCreditResponse.data);
                                Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error deducting credit. Please contact support." });
                            } else {
                                console.log("Credit limit DEDUCTED successfully on order update (Admin App):", deductCreditResponse.data);
                            }
                        } catch (deductCreditError) {
                            console.error("Error calling /credit-limit/deduct API (on order update - Admin App):", deductCreditError);
                            Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating credit. Please contact support." });
                        }
                    } else if (amountDifference < 0) {
                        const increaseCreditOptions = {
                            method: 'POST',
                            url: `http://${ipAddress}:8091/increase-credit-limit`,
                            data: {
                                customerId: customerId,
                                amountToIncrease: Math.abs(amountDifference),
                            },
                            headers: { 'Content-Type': 'application/json' },
                        };

                        try {
                            const increaseCreditResponse = await axios(increaseCreditOptions);
                            if (increaseCreditResponse.status !== 200) {
                                console.error("Error increasing credit limit on order update (Admin App):", increaseCreditResponse.status, increaseCreditResponse.statusText, increaseCreditResponse.data);
                                Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error refunding credit. Please contact support." });
                            } else {
                                console.log("Credit limit INCREASED successfully on order update (Admin App):", increaseCreditResponse.data);
                            }
                        } catch (increaseCreditError) {
                            console.error("Error calling /increase-credit-limit API (on order update - Admin App):", increaseCreditError);
                            Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating credit. Please contact support." });
                        }
                    } else {
                        console.log("Order amount unchanged, no credit limit adjustment needed. (Admin App)");
                    }

                    const updateAmountDueOptions = {
                        method: 'POST',
                        url: `http://${ipAddress}:8091/credit-limit/update-amount-due-on-order`,
                        data: {
                            customerId: customerId,
                            totalOrderAmount: calculatedTotalAmount,
                            originalOrderAmount: originalTotalAmount,
                        },
                        headers: { 'Content-Type': 'application/json' },
                    };

                    console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - Request URL:", updateAmountDueOptions.url);
                    console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - Request Headers:", updateAmountDueOptions.headers);
                    console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - Request Body:", JSON.stringify(updateAmountDueOptions.data, null, 2));
                    console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - calculatedTotalAmount BEFORE API call:", calculatedTotalAmount);

                    try {
                        const updateAmountDueResponse = await axios(updateAmountDueOptions);
                        console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - Response Status:", updateAmountDueResponse.status);
                        console.log("DEBUG - handleUpdateOrder (Admin App): Amount Due API - Response Data:", JSON.stringify(updateAmountDueResponse.data, null, 2));

                        if (updateAmountDueResponse.status == 200) {
                            console.log("Amount Due updated successfully on order update (Admin App):", updateAmountDueResponse.data);
                        } else {
                            console.error("Failed to update Amount Due on order update (Admin App):", updateAmountDueResponse.status, updateAmountDueResponse.statusText, updateAmountDueResponse.data);
                            Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating amount due." });
                        }
                    } catch (updateAmountDueError) {
                        console.error("Error calling /credit-limit/update-amount-due-on-order API (on order update - Admin App):", updateAmountDueError);
                        Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating amount due." });
                    }

                    Toast.show({
                        type: 'success',
                        text1: 'Order Updated & Credit Updated',
                        text2: updateData.message || "Order updated and credit limit adjusted successfully!"
                    });
                } else {
                    console.warn("Original order details not found in 'orders' state, cannot adjust credit limit on update (Admin App).");
                    Toast.show({ type: 'warning', text1: 'Order Updated', text2: "Order updated, but credit limit adjustment might not be complete. Please contact support." });
                }

                await fetchAdminOrders();
                setSelectedOrderId(null);
                setProducts([]);
                setIsOrderUpdated(false);

            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Order Update Failed',
                    text2: updateData.message || "Failed to update order."
                });
                setError(updateData.message || "Failed to update order.");
            }

        } catch (error) {
            console.error("UPDATE ORDER - Error (Admin App):", error);
            setError(error.message || "Failed to update order.");
            Toast.show({ type: 'error', text1: 'Update Error', text2: error.message || "Failed to update order." });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (orderIdToDelete) => {
        console.log("handleDeleteOrder CALLED - Admin Order Screen - Order ID:", orderIdToDelete);

        setOrderDeleteLoading(true);
        setOrderDeleteLoadingId(orderIdToDelete);
        setError(null);

        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            const deleteOrderResponse = await fetch(
                `http://${ipAddress}:8091/cancel_order/${orderIdToDelete}`,
                { method: "POST", headers }
            );

            if (!deleteOrderResponse.ok) {
                const errorText = await deleteOrderResponse.text();
                throw new Error(
                    `Failed to delete order. Status: ${deleteOrderResponse.status}, Text: ${errorText}`
                );
            }

            const deleteOrderData = await deleteOrderResponse.json();
            if (!deleteOrderData.success) {
                throw new Error(deleteOrderData.message || "Failed to cancel the order.");
            }

            const cancelledOrder = orders.find(order => order.id === orderIdToDelete);

            if (cancelledOrder) {
                const cancelledOrderAmount = cancelledOrder.total_amount;
                const customerId = cancelledOrder.customer_id;

                console.log("DEBUG - handleDeleteOrder (Admin Screen): cancelledOrder:", cancelledOrder);
                console.log("DEBUG - handleDeleteOrder (Admin Screen): cancelledOrderAmount:", cancelledOrderAmount);
                console.log("DEBUG - handleDeleteOrder (Admin Screen): customerId:", customerId);

                if (customerId && cancelledOrderAmount !== undefined && cancelledOrderAmount !== null) {
                    const requestBodyIncreaseCL = {
                        customerId: customerId,
                        amountToIncrease: cancelledOrderAmount,
                    };
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): increaseCreditLimit Request Body:", JSON.stringify(requestBodyIncreaseCL));

                    const creditLimitIncreaseResponse = await fetch(
                        `http://${ipAddress}:8091/increase-credit-limit`,
                        {
                            method: "POST",
                            headers,
                            body: JSON.stringify(requestBodyIncreaseCL),
                        }
                    );

                    console.log("DEBUG - handleDeleteOrder (Admin Screen): increaseCreditLimit Response Status:", creditLimitIncreaseResponse.status);
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): increaseCreditLimit Response Status Text:", creditLimitIncreaseResponse.statusText);

                    if (!creditLimitIncreaseResponse.ok) {
                        console.error("Failed to increase credit limit after order cancellation (Admin Screen).");
                    } else {
                        const creditLimitIncreaseData = await creditLimitIncreaseResponse.json();
                        console.log("Credit limit increased successfully (Admin Screen):", creditLimitIncreaseData);
                    }
                } else {
                    console.warn("DEBUG - handleDeleteOrder (Admin Screen): customerId or cancelledOrderAmount missing or invalid, cannot increase credit limit.");
                }
            } else {
                console.warn("DEBUG - handleDeleteOrder (Admin Screen): Cancelled order not found in orders array, cannot get details for credit limit increase.");
            }

            if (cancelledOrder) {
                const originalTotalAmount = cancelledOrder.total_amount;
                const customerIdForAmountDueUpdate = cancelledOrder.customer_id;

                const updateAmountDueOptions = {
                    method: 'POST',
                    url: `http://${ipAddress}:8091/credit-limit/update-amount-due-on-order`,
                    data: {
                        customerId: customerIdForAmountDueUpdate,
                        totalOrderAmount: 0,
                        originalOrderAmount: originalTotalAmount,
                    },
                    headers: { 'Content-Type': 'application/json' },
                };

                console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request URL:", updateAmountDueOptions.url);
                console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request Headers:", updateAmountDueOptions.headers);
                console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request Body:", JSON.stringify(updateAmountDueOptions.data, null, 2));
                console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - totalOrderAmount BEFORE API call: 0");

                try {
                    const updateAmountDueResponse = await axios(updateAmountDueOptions);
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Response Status:", updateAmountDueResponse.status);
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Response Data:", JSON.stringify(updateAmountDueResponse.data, null, 2));

                    if (updateAmountDueResponse.status !== 200) {
                        console.error("Amount Due Update Failed on order cancellation (Admin Screen):", updateAmountDueResponse.status, updateAmountDueResponse.statusText, updateAmountDueResponse.data);
                        Toast.show({ type: "error", text1: "Credit Update Error", text2: "Error updating amount due on cancellation." });
                    } else {
                        console.log("Amount Due updated successfully on order cancellation! (Admin Screen)");
                    }
                } catch (updateAmountDueError) {
                    console.error("Error calling /credit-limit/update-amount-due-on-order API (on order cancellation - Admin Screen):", updateAmountDueError);
                    Toast.show({ type: "error", text1: "Credit Update Error", text2: "Error updating amount due on cancellation." });
                }
            } else {
                console.warn("DEBUG - handleDeleteOrder (Admin Screen): Cancelled order details not found again before Amount Due API call. This should not happen.");
                Toast.show({ type: 'warning', text1: 'Order Cancelled', text2: "Order cancelled, but amount due update might be incomplete. Please contact support." });
            }

            setSelectedOrderId(null);
            setProducts([]);
            await fetchAdminOrders();

            Toast.show({
                type: "success",
                text1: "Order Cancelled",
                text2: deleteOrderData.message || `Order ID ${orderIdToDelete} cancelled successfully.`,
            });
        } catch (error) {
            console.error("DELETE ORDER - Admin Screen - Error:", error);
            setError(error.message || "Failed to cancel order.");
            Toast.show({
                type: "error",
                text1: "Cancellation Error",
                text2: error.message || "Failed to cancel the order.",
            });
        } finally {
            setOrderDeleteLoading(false);
            setOrderDeleteLoadingId(null);
        }
    };

    const handleAddProductToOrder = async (productToAdd) => {
        if (!selectedOrderId) return Alert.alert("Error", "Please select an order.");
        if (products.some(p => p.product_id === productToAdd.id)) {
            Toast.show({ type: 'info', text1: 'Product Already Added', text2: 'Update quantity instead.' });
            setShowSearchModal(false);
            return;
        }
    
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const orderToCheck = orders.find(order => order.id === selectedOrderId);
            if (!orderToCheck) {
                Toast.show({ type: 'error', text1: 'Order Not Found', text2: "The selected order no longer exists. Please select or create a new order." });
                setSelectedOrderId(null);
                setProducts([]);
                await fetchAdminOrders();
                return;
            }
            
    
            console.log("Raw productToAdd from SearchProductModal:", productToAdd);
    
            // Determine price: Check customer-specific price first, then fallback to productToAdd.price or latest price
            let priceToUse = productToAdd.price; // Default price
            if (selectedOrderCustomerId) { // Ensure customer ID is available
                const customerPriceCheckUrl = `http://${ipAddress}:8091/customer_price_check?customer_id=${selectedOrderCustomerId}`;
                const customerPriceResponse = await fetch(customerPriceCheckUrl, {
                    method: 'GET',
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
                });
    
                if (customerPriceResponse.ok) {
                    const customerPrices = await customerPriceResponse.json();
                    const specificPrice = customerPrices.find(item => item.product_id === productToAdd.id);
                    if (specificPrice && specificPrice.customer_price !== undefined && specificPrice.customer_price !== null) {
                        priceToUse = specificPrice.customer_price;
                        console.log(`Using customer-specific price: ₹${priceToUse} for product ${productToAdd.id}`);
                    }
                } else {
                    console.log("No customer-specific price found or fetch failed, falling back to default.");
                }
            }
    
            // If priceToUse is still invalid, fetch from /latest-product-price
            if (priceToUse === undefined || priceToUse === null || isNaN(priceToUse)) {
                const priceResponse = await fetch(`http://${ipAddress}:8091/latest-product-price?productId=${productToAdd.id}`, {
                    method: 'GET',
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
                });
                if (priceResponse.ok) {
                    const priceData = await priceResponse.json();
                    priceToUse = priceData.price;
                    console.log(`Using latest price from order_products: ₹${priceToUse} for product ${productToAdd.id}`);
                } else {
                    const errorText = await priceResponse.text();
                    console.log("Failed to fetch latest price:", errorText);
                    priceToUse = 0; // Final fallback if all else fails
                    console.log(`Falling back to price: ₹${priceToUse} for product ${productToAdd.id}`);
                }
            }
    
            const gstRateToUse = productToAdd.gst_rate !== undefined ? productToAdd.gst_rate : 0;
    
            const payload = {
                orderId: selectedOrderId,
                productId: productToAdd.id,
                quantity: 1,
                price: priceToUse,
                name: productToAdd.name,
                category: productToAdd.category,
                gst_rate: gstRateToUse
            };
            console.log("Payload being sent to add-product-to-order:", payload);
    
            const response = await fetch(`http://${ipAddress}:8091/add-product-to-order`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log("Error Response from server:", errorText);
                throw new Error(`Failed to add product: ${response.status}, ${errorText}`);
            }
    
            const addProductData = await response.json();
            if (addProductData.success) {
                Toast.show({ type: 'success', text1: 'Product Added', text2: `${productToAdd.name} added with price ₹${priceToUse}.` });
                fetchOrderProducts(selectedOrderId);
                setShowSearchModal(false);
            } else {
                throw new Error(addProductData.message || "Failed to add product.");
            }
        } catch (error) {
            setError(error.message || "Failed to add product.");
            Toast.show({ type: 'error', text1: 'Add Product Error', text2: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityInputChange = (index, text) => {
        const newQuantityInputs = { ...quantityInputs };
        newQuantityInputs[index] = text;
        setQuantityInputs(newQuantityInputs);
    };

    const handleQuantityBlur = (index) => {
        const newQuantityInputs = { ...quantityInputs };
        const value = newQuantityInputs[index];
        if (value === "" || isNaN(value) || parseInt(value) < 0) {
            newQuantityInputs[index] = products[index].quantity.toString();
                } else {
            newQuantityInputs[index] = Math.min(parseInt(value), 9999).toString();
        }
        setQuantityInputs(newQuantityInputs);
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.orderCard,
                selectedOrderId === item.id && styles.selectedOrderCard
            ]}
            onPress={() => fetchOrderProducts(item.id)}
        >
            <View style={styles.orderCardContent}>
                <View style={styles.orderInfo}>
                    <View style={styles.orderHeader}>
                        <Text style={styles.orderIdText}>Order #{item.id}</Text>
                        {item.loading_slip === "Yes" && (
                            <View style={styles.processedBadge}>
                                <Icon name="check-circle" size={14} color={COLORS.success} />
                                <Text style={styles.processedText}>Processed</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.orderDetails}>
                        <View style={styles.orderDetail}>
                            <Icon name="calendar-today" size={14} color={COLORS.text.secondary} />
                            <Text style={styles.orderDetailText}>
                                {formatDate(item.placed_on)}
                        </Text>
                    </View>
                        <View style={styles.orderDetail}>
                            <Icon 
                                name={item.order_type === "AM" ? "wb-sunny" : "nights-stay"} 
                                size={14} 
                                color={COLORS.text.secondary} 
                            />
                            <Text style={styles.orderDetailText}>{item.order_type} Shift</Text>
                </View>
                    </View>
                </View>
                <View style={styles.orderAmountContainer}>
                    <Text style={styles.orderAmountText}>
                        {formatCurrency(item.total_amount)}
                    </Text>
                <TouchableOpacity
                        style={[
                            styles.deleteOrderButton,
                            item.loading_slip === "Yes" && styles.disabledDeleteButton
                        ]}
                    onPress={() => handleDeleteOrder(item.id)}
                        disabled={orderDeleteLoading || item.loading_slip === "Yes"}
                >
                    {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
                            <ActivityIndicator size="small" color={COLORS.text.light} />
                    ) : (
                            <Icon name="delete" size={20} color={COLORS.text.light} />
                    )}
                </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderProductItem = ({ item, index }) => {
        const selectedOrder = orders.find((order) => order.id === selectedOrderId);
        const totalAmount = (Number.parseInt(quantityInputs[index] || item.quantity, 10) || 0) * item.price;

        return (
            <View style={styles.productCard}>
                <View style={styles.productInfoContainer}>
                <View style={styles.productHeader}>
                        <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
                            {item.name}
                        </Text>
                        <View style={styles.gstBadge}>
                            <Text style={styles.gstRateText}>GST {item.gst_rate}%</Text>
                    </View>
                </View>
                    <View style={styles.productDetailsContainer}>
                    <View style={styles.quantityContainer}>
                            <Text style={styles.quantityLabel}>Quantity</Text>
                            <TextInput
                                style={styles.quantityInput}
                                value={quantityInputs[index] || ""}
                                onChangeText={(text) => handleQuantityInputChange(index, text)}
                                onBlur={() => handleQuantityBlur(index)}
                                keyboardType="numeric"
                                maxLength={4}
                                editable={!loading && !(selectedOrder && selectedOrder.loading_slip === "Yes")}
                                placeholder="0"
                                placeholderTextColor={COLORS.text.tertiary}
                            />
                    </View>

                    <View style={styles.priceContainer}>
                            <Text style={styles.priceLabel}>Price</Text>
                            <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                    </View>

                    <View style={styles.totalContainer}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.productTotal}>{formatCurrency(totalAmount)}</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteProductItem(index)}
                            disabled={deleteLoading || (selectedOrder && selectedOrder.loading_slip === "Yes")}
                        >
                            {deleteLoading && deleteLoadingIndex === index ? (
                                <ActivityIndicator size="small" color={COLORS.error} />
                            ) : (
                                <Icon
                                    name="delete"
                                    size={20}
                                    color={selectedOrder && selectedOrder.loading_slip === "Yes" ? COLORS.text.tertiary : COLORS.error}
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const selectedOrder = orders.find((order) => order.id === selectedOrderId);
    const totalAmount = products.reduce((sum, product) => {
        const quantity = Number.parseInt(quantityInputs[products.indexOf(product)] || product.quantity, 10) || 0;
        return sum + quantity * product.price;
    }, 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerText}>Update Orders</Text>
                    <TouchableOpacity onPress={fetchAdminOrders} style={styles.refreshButton}>
                        <Icon name="refresh" size={24} color={COLORS.text.light} />
                    </TouchableOpacity>
                </View>
            </View>
            
            {loading && !selectedOrderId && (
                <View style={styles.fullScreenLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading your orders...</Text>
                </View>
            )}

                {error && (
                    <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={24} color={COLORS.text.light} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
    
            <ScrollView 
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.ordersContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Orders</Text>
                        <View style={styles.orderCountBadge}>
                            <Text style={styles.orderCountText}>
                                {orders.length} order{orders.length !== 1 ? "s" : ""}
                            </Text>
                        </View>
                    </View>

                    {orders.length === 0 && !loading ? (
                        <View style={styles.emptyContainer}>
                            <Icon name="shopping-basket" size={48} color={COLORS.text.tertiary} />
                            <Text style={styles.emptyText}>No orders for today</Text>
                            <Text style={styles.emptySubtext}>Your orders will appear here</Text>
                        </View>
                    ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOrderItem}
                            scrollEnabled={false}
                    contentContainerStyle={styles.orderList}
                            ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
                        />
                    )}
                </View>

                {selectedOrderId && selectedOrder && (
                    <View style={styles.editContainer}>
                        <View style={styles.orderDetailsCard}>
                            <View style={styles.orderDetailRow}>
                                <View style={styles.orderDetailItem}>
                                    <Icon name="calendar-today" size={16} color={COLORS.text.secondary} />
                                    <Text style={styles.orderDetailText}>
                                        {formatDate(selectedOrder.placed_on)}
                                    </Text>
                                </View>
                                <View style={styles.orderDetailItem}>
                                    <Icon 
                                        name={selectedOrder.order_type === "AM" ? "wb-sunny" : "nights-stay"} 
                                        size={16} 
                                        color={COLORS.text.secondary} 
                                    />
                                    <Text style={styles.orderDetailText}>{selectedOrder.order_type} Shift</Text>
                                </View>
                            </View>
                            <View style={styles.orderStatusContainer}>
                                <Icon 
                                    name={selectedOrder.loading_slip === "Yes" ? "check-circle" : "pending"} 
                                    size={16} 
                                    color={selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning} 
                                />
                                <Text style={[
                                    styles.orderStatusText,
                                    { color: selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning }
                                ]}>
                                    {selectedOrder.loading_slip === "Yes" ? "Processed" : "Pending"}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.editHeader}>
                            <Text style={styles.sectionTitle}>Edit Order #{selectedOrderId}</Text>
                            <TouchableOpacity
                                style={[
                                    styles.addProductButton,
                                    selectedOrder.loading_slip === "Yes" && styles.disabledButton
                                ]}
                                onPress={() => setShowSearchModal(true)}
                                disabled={selectedOrder.loading_slip === "Yes"}
                            >
                                <Icon name="add" size={20} color={COLORS.text.light} />
                                <Text style={styles.addProductButtonText}>Add Product</Text>
                            </TouchableOpacity>
                        </View>

                        {products.length === 0 ? (
                            <View style={styles.emptyProductsContainer}>
                                <Icon name="box-open" size={48} color={COLORS.text.tertiary} />
                                <Text style={styles.emptyProductsText}>No products in this order</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.addProductsButton,
                                        selectedOrder.loading_slip === "Yes" && styles.disabledButton
                                    ]}
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
                                        <Text style={styles.summaryAmount}>
                                            {formatCurrency(totalAmount)}
                                        </Text>
                                    </View>
                                </View>
                                    </>
                                )}

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[
                                    styles.updateButton,
                                    selectedOrder.loading_slip === "Yes" && styles.disabledButton
                                ]}
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
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        paddingBottom: 16,
    },
    headerContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    headerText: {
        fontSize: 24,
        fontWeight: "700",
        color: COLORS.text.light,
    },
    refreshButton: {
        backgroundColor: "rgba(255,255,255,0.2)",
        padding: 8,
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    ordersContainer: {
        padding: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.text.primary,
    },
    orderCountBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    orderCountText: {
        color: COLORS.text.light,
        fontSize: 14,
        fontWeight: "600",
    },
    orderList: {
        paddingBottom: 12,
    },
    orderCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
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
    selectedOrderCard: {
        borderWidth: 2,
        borderColor: COLORS.primary,
        backgroundColor: "#e6f0ff",
    },
    orderCardContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    orderInfo: {
        flex: 1,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    orderIdText: {
        fontSize: 16,
        fontWeight: "600",
        color: COLORS.text.primary,
    },
    processedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E6FFED",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    processedText: {
        color: COLORS.success,
        fontSize: 12,
        fontWeight: "600",
        marginLeft: 4,
    },
    orderDetails: {
        flexDirection: "row",
        alignItems: "center",
    },
    orderDetail: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 16,
    },
    orderDetailText: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginLeft: 6,
    },
    orderAmountContainer: {
        alignItems: "flex-end",
    },
    orderAmountText: {
        fontSize: 18,
        fontWeight: "700",
        color: COLORS.text.primary,
        marginBottom: 8,
    },
    deleteOrderButton: {
        backgroundColor: COLORS.error,
        padding: 8,
        borderRadius: 8,
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    disabledDeleteButton: {
        backgroundColor: COLORS.text.tertiary,
    },
    orderSeparator: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 8,
    },
    editContainer: {
        backgroundColor: COLORS.surface,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
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
    orderDetailsCard: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    orderDetailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    orderDetailItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    orderStatusContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    orderStatusText: {
        fontSize: 14,
        fontWeight: "600",
        marginLeft: 6,
    },
    editHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    addProductButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    addProductButtonText: {
        color: COLORS.text.light,
        marginLeft: 6,
        fontSize: 14,
        fontWeight: "600",
    },
    disabledButton: {
        backgroundColor: COLORS.text.tertiary,
    },
    productCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
    },
    productInfoContainer: {
        flex: 1,
    },
    productHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    productName: {
        fontSize: 16,
        fontWeight: "600",
        color: COLORS.text.primary,
        flex: 1,
        marginRight: 12,
    },
    gstBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    gstRateText: {
        fontSize: 12,
        color: COLORS.text.secondary,
        fontWeight: "500",
    },
    productDetailsContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    quantityContainer: {
        flex: 1,
    },
    quantityLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 4,
    },
    quantityInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 8,
        width: 60,
        textAlign: "center",
        borderRadius: 8,
        fontSize: 14,
        backgroundColor: COLORS.surface,
    },
    priceContainer: {
        flex: 1,
        alignItems: "center",
    },
    priceLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text.primary,
    },
    totalContainer: {
        flex: 1,
        alignItems: "center",
    },
    totalLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 4,
    },
    productTotal: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.primary,
    },
    deleteButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    productSeparator: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 8,
    },
    summaryContainer: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text.primary,
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: "700",
        color: COLORS.primary,
    },
    footer: {
        marginTop: 16,
    },
    updateButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    updateButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: "600",
    },
    emptyContainer: {
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginTop: 12,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.card.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    emptyText: {
        fontSize: 18,
        fontWeight: "600",
        color: COLORS.text.primary,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginTop: 8,
        textAlign: "center",
    },
    emptyProductsContainer: {
        justifyContent: "center",
        alignItems: "center",
        padding: 30,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        marginVertical: 12,
    },
    emptyProductsText: {
        fontSize: 16,
        color: COLORS.text.secondary,
        marginVertical: 12,
    },
    addProductsButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    addProductsButtonText: {
        color: COLORS.text.light,
        fontSize: 14,
        fontWeight: "600",
    },
    fullScreenLoading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.9)",
    },
    loadingText: {
        fontSize: 16,
        color: COLORS.text.primary,
        marginTop: 16,
    },
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.error,
        padding: 12,
        margin: 16,
        borderRadius: 8,
    },
    errorText: {
        color: COLORS.text.light,
        marginLeft: 8,
        fontSize: 14,
    },
});

export default UpdateOrderScreen;