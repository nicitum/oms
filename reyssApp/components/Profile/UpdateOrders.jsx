import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { View, Text, TextInput, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/FontAwesome';
import SearchProductModalAdmin from './searchProductModalAdmin';
import moment from 'moment';
import { checkTokenAndRedirect } from '../../services/auth';

import { ipAddress } from '../../urls';

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
    const [showSearchModal, setShowSearchModal] = useState(false); // State for modal visibility
    const [orderDeleteLoading, setOrderDeleteLoading] = useState(false);
    const [orderDeleteLoadingId, setOrderDeleteLoadingId] = useState(null);

    const [selectedOrderCustomerId, setSelectedOrderCustomerId] = useState(null);


    useEffect(() => {
        fetchAdminOrders();
    }, []);

    const fetchAdminOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;

            const url = `http://${ipAddress}:8090/get-admin-orders/${adminId}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            console.log("FETCH ADMIN ORDERS - Request URL:", url);
            console.log("FETCH ADMIN ORDERS - Request Headers:", headers);

            const ordersResponse = await fetch(url, { headers });

            console.log("FETCH ADMIN ORDERS - Response Status:", ordersResponse.status);
            console.log("FETCH ADMIN ORDERS - Response Status Text:", ordersResponse.statusText);

            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                const message = `Failed to fetch admin orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
                console.error("FETCH ADMIN ORDERS - Error Response Text:", errorText);
                throw new Error(message);
            }

            const ordersData = await ordersResponse.json();
            console.log("FETCH ADMIN ORDERS - Response Data:", ordersData);
            let fetchedOrders = ordersData.orders;

            // **FILTER ORDERS FOR TODAY (Epoch Seconds & CORRECT FORMAT & .unix()):**
            const todayFormatted = moment().format("YYYY-MM-DD"); // Corrected format to YYYY-MM-DD (more standard)
            console.log("DEBUG: Today's Formatted Date (YYYY-MM-DD):", todayFormatted); // DEBUG LOG

            const todaysOrders = fetchedOrders.filter(order => {
                if (!order.placed_on) {
                    console.log("DEBUG: order.placed_on is missing for order ID:", order.id); // DEBUG LOG
                    return false; // Skip if placed_on is missing or invalid
                }

                console.log("DEBUG: Raw order.placed_on value:", order.placed_on, typeof order.placed_on); // DEBUG LOG - Raw value and type

                const parsedEpochSeconds = parseInt(order.placed_on, 10); // Still parse to integer
                console.log("DEBUG: Parsed Epoch Timestamp (parseInt) - Seconds:", parsedEpochSeconds, typeof parsedEpochSeconds); // DEBUG LOG - Parsed integer (seconds)

                // **Use moment.unix() to parse epoch seconds:**
                const orderDateMoment = moment.unix(parsedEpochSeconds); // **Use moment.unix()**
                console.log("DEBUG: Moment Object from Epoch (Seconds using .unix()):", orderDateMoment); // DEBUG LOG - Moment object (parsed as seconds)
                console.log("DEBUG: Moment Object valueOf (Epoch in ms AFTER .unix()):", orderDateMoment.valueOf()); // DEBUG LOG - Epoch value from Moment (in ms)

                const orderDateFormatted = orderDateMoment.format("YYYY-MM-DD"); // Corrected format to YYYY-MM-DD
                console.log("DEBUG: Formatted Order Date (YYYY-MM-DD):", orderDateFormatted); // DEBUG LOG - Formatted date

                return orderDateFormatted === todayFormatted; // Compare formatted dates
            });

            setOrders(todaysOrders); 
            console.log('todayssss order',todaysOrders)// Set the filtered orders

        } catch (fetchOrdersError) {
            console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
            setError(fetchOrdersError.message || "Failed to fetch admin orders.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: fetchOrdersError.message || "Failed to fetch admin orders." });
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
            const url = `http://${ipAddress}:8090/order-products?orderId=${orderIdToFetch}`;
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
                    // Find the order to set customer ID
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
            // Set customer ID when products are fetched
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
            console.log(orderProductIdToDelete)

            const url = `http://${ipAddress}:8090/delete_order_product/${orderProductIdToDelete}`;
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

            // Check if this was the last product
            if (products.length === 1) {
                // Call handleDeleteOrder to cancel the entire order
                await handleDeleteOrder(selectedOrderId);
            } else {
                // Only the product item was deleted, update product list
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
                    return null; // Indicate error
                }
                const decodedToken = jwtDecode(userAuthToken);
                const customerId = decodedToken.id;
    
                const creditLimitResponse = await fetch(`http://${ipAddress}:8090/credit-limit?customerId=${customerId}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${userAuthToken}`,
                        'Content-Type': 'application/json',
                    },
                });
    
                if (creditLimitResponse.ok) {
                    const creditData = await creditLimitResponse.json();
                    return parseFloat(creditData.creditLimit); // Parse to float for comparison
                } else if (creditLimitResponse.status === 404) {
                    console.log("Credit limit not found for customer, proceeding without limit check.");
                    return Infinity; // Treat as no credit limit or very high limit, allow order (adjust logic if needed)
                } else {
                    console.error("Error fetching credit limit:", creditLimitResponse.status, creditLimitResponse.statusText);
                    Toast.show({
                        type: 'error',
                        text1: 'Credit Limit Error',
                        text2: "Failed to fetch credit limit."
                    });
                    return null; // Indicate error
                }
    
            } catch (error) {
                console.error("Error checking credit limit:", error);
                Toast.show({
                    type: 'error',
                    text1: 'Credit Limit Error',
                    text2: "Error checking credit limit."
                });
                return null; // Indicate error
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
                }));
        
                productsToUpdate.forEach(product => {
                    calculatedTotalAmount += product.quantity * product.price;
                });
        
                // **--- 1. Credit Limit Check BEFORE Order Update ---**
                const creditLimit = await checkCreditLimit(); // Assuming checkCreditLimit is accessible here
                if (creditLimit === null) {
                    setLoading(false); // Stop loading in case of credit check failure
                    return; // Do not proceed if credit limit check failed
                }
        
                if (creditLimit !== Infinity && calculatedTotalAmount > creditLimit) {
                    setLoading(false); // Stop loading before showing Toast
                    const exceededAmount = (calculatedTotalAmount - creditLimit).toFixed(2);
                    Toast.show({
                        type: 'error',
                        text1: 'Credit Limit Reached',
                        text2: `Updated order amount exceeds credit limit by ₹${exceededAmount}. Please adjust quantities.`
                    });
                    return; // Prevent order update due to credit limit
                }
                // **--- END: Credit Limit Check ---**
        
        
                const url = `http://${ipAddress}:8090/order_update`;
                const headers = {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                };
                const requestBody = {
                    orderId: selectedOrderId,
                    products: productsToUpdate, // Use the updated productsToUpdate array
                    totalAmount: calculatedTotalAmount,
                    total_amount: calculatedTotalAmount // Duplicated key, might want to remove one in backend if possible
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
        
        
                // --- 2. & 3. Credit Deduct/Increase and 4. Amount Due Update Logic ---
                if (updateResponse.status === 200) {
                    const originalOrder = orders.find(order => order.id === selectedOrderId); // **Assuming 'orders' state is available and up-to-date**
        
                    if (originalOrder) {
                        const originalTotalAmount = originalOrder.total_amount;
                        const amountDifference = calculatedTotalAmount - originalTotalAmount;
                        const customerId = originalOrder.customer_id;
        
        
                        console.log("DEBUG - handleUpdateOrder (Admin App): originalTotalAmount:", originalTotalAmount);
                        console.log("DEBUG - handleUpdateOrder (Admin App): calculatedTotalAmount:", calculatedTotalAmount);
                        console.log("DEBUG - handleUpdateOrder (Admin App): amountDifference:", amountDifference);
                        console.log("DEBUG - handleUpdateOrder (Admin App): customerId:", customerId);
        
        
                        // --- 3a. Credit Deduct/Increase based on amountDifference ---
                        if (amountDifference > 0) {
                            // Order amount increased, deduct credit
                            const deductCreditOptions = {
                                method: 'POST',
                                url: `http://${ipAddress}:8090/credit-limit/deduct`,
                                data: {
                                    customerId: customerId,
                                    amountChange: amountDifference, // Deduct the INCREASE in amount
                                },
                                headers: { 'Content-Type': 'application/json' }, // Authorization header if needed for /credit-limit/deduct
                            };
        
                            try {
                                const deductCreditResponse = await axios(deductCreditOptions);
                                if (deductCreditResponse.status !== 200) {
                                    console.error("Error deducting credit limit on order update (Admin App):", deductCreditResponse.status, deductCreditResponse.statusText, deductCreditResponse.data);
                                    Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error deducting credit. Please contact support." });
                                    // Consider rollback or more specific error handling here if needed
                                } else {
                                    console.log("Credit limit DEDUCTED successfully on order update (Admin App):", deductCreditResponse.data);
                                }
                            } catch (deductCreditError) {
                                console.error("Error calling /credit-limit/deduct API (on order update - Admin App):", deductCreditError);
                                Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating credit. Please contact support." });
                                // Consider rollback or more specific error handling here if needed
                            }
        
        
                        } else if (amountDifference < 0) {
                            // Order amount decreased, increase credit (refund)
                            const increaseCreditOptions = {
                                method: 'POST',
                                url: `http://${ipAddress}:8090/increase-credit-limit`,
                                data: {
                                    customerId: customerId,
                                    amountToIncrease: Math.abs(amountDifference), // Increase by the ABSOLUTE value of decrease
                                },
                                headers: { 'Content-Type': 'application/json' }, // Authorization header if needed for /increase-credit-limit
                            };
        
                            try {
                                const increaseCreditResponse = await axios(increaseCreditOptions);
                                if (increaseCreditResponse.status !== 200) {
                                    console.error("Error increasing credit limit on order update (Admin App):", increaseCreditResponse.status, increaseCreditResponse.statusText, increaseCreditResponse.data);
                                    Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error refunding credit. Please contact support." });
                                    // Consider rollback or more specific error handling here if needed
                                } else {
                                    console.log("Credit limit INCREASED successfully on order update (Admin App):", increaseCreditResponse.data);
                                }
                            } catch (increaseCreditError) {
                                console.error("Error calling /increase-credit-limit API (on order update - Admin App):", increaseCreditError);
                                Toast.show({ type: 'error', text1: 'Credit Update Error', text2: "Error updating credit. Please contact support." });
                                // Consider rollback or more specific error handling here if needed
                            }
                        } else {
                            console.log("Order amount unchanged, no credit limit adjustment needed. (Admin App)");
                        }
        
        
                        // --- 4. Update Amount Due API Call -  INTEGRATED for ADMIN APP ---
                        const updateAmountDueOptions = {
                            method: 'POST',
                            url: `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
                            data: {
                                customerId: customerId,
                                totalOrderAmount: calculatedTotalAmount, // **Use the NEW calculatedTotalAmount**
                                originalOrderAmount: originalTotalAmount, // Pass original amount for backend calculation - VERY IMPORTANT for updates!
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
        
        
                    await fetchAdminOrders(); // Refresh admin orders after successful update
                    setSelectedOrderId(null);
                    setProducts([]);
                    setIsOrderUpdated(false);
        
        
                } else { // if (updateResponse.status !== 200)
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
            console.log("handleDeleteOrder CALLED - Admin Order Screen - Order ID:", orderIdToDelete); // DEBUGGING - Admin Screen
        
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
                    `http://${ipAddress}:8090/cancel_order/${orderIdToDelete}`,
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
        
                // **--- START: Credit Limit Increase Logic (Admin Screen) ---**
                // **Find the cancelled order in the `orders` state array**
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
                            `http://${ipAddress}:8090/increase-credit-limit`,
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
                // **--- END: Credit Limit Increase Logic (Admin Screen) ---**
        
        
                // ====================== Amount Due Update Logic for Order Cancellation - INTEGRATED HERE for ADMIN APP ==========================
                if (cancelledOrder) { // Re-check if cancelledOrder exists, just to be safe
                    const originalTotalAmount = cancelledOrder.total_amount; // Get original order amount
                    const customerIdForAmountDueUpdate = cancelledOrder.customer_id; // Get customerId
        
                    const updateAmountDueOptions = {
                        method: 'POST',
                        url: `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
                        data: {
                            customerId: customerIdForAmountDueUpdate,
                            totalOrderAmount: 0, // **Set totalOrderAmount to 0 on cancellation**
                            originalOrderAmount: originalTotalAmount, // Pass original amount for backend calculation (if needed)
                        },
                        headers: { 'Content-Type': 'application/json' },
                    };
        
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request URL:", updateAmountDueOptions.url);
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request Headers:", updateAmountDueOptions.headers);
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - Request Body:", JSON.stringify(updateAmountDueOptions.data, null, 2));
                    console.log("DEBUG - handleDeleteOrder (Admin Screen): Amount Due API - totalOrderAmount BEFORE API call: 0"); // Total amount is now 0
        
        
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
                // ====================== END: Amount Due Update Logic for Order Cancellation - INTEGRATED for ADMIN APP ==========================
        
        
                // Clear selections and refresh order list
                setSelectedOrderId(null);
                setProducts([]);
                await fetchAdminOrders(); // Refresh admin order list
        
                Toast.show({
                    type: "success",
                    text1: "Order Cancelled",
                    text2: deleteOrderData.message || `Order ID ${orderIdToDelete} cancelled successfully.`,
                });
            } catch (error) {
                console.error("DELETE ORDER - Admin Screen - Error:", error); // DEBUGGING - Admin Screen
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

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.orderItemTouchable}
            onPress={() => {
                if (selectedOrderId === item.id) {
                    setSelectedOrderId(null);
                    setProducts([]);
                } else {
                    setSelectedOrderId(item.id);
                    fetchOrderProducts(item.id);
                }
            }}
        >
            <View style={styles.orderItemContainer}>
                <Text style={styles.orderIdText}>Order ID: {item.id}</Text>
              
                <Text style={styles.orderAmountText}>Total Amount: {item.total_amount ? parseFloat(item.total_amount).toFixed(2) : 0.0}</Text>
                <Text style={styles.customerNameText}>
                    Cancelled ?: {item.cancelled ? item.cancelled : 'No'}
                </Text>
                <TouchableOpacity
                    style={styles.deleteOrderButton}
                    onPress={() => handleDeleteOrder(item.id)}
                    disabled={orderDeleteLoading}
                >
                    {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Icon name="time" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );


    const handleAddProductToOrder = async (productToAdd) => {
        if (!selectedOrderId) {
            Alert.alert("Error", "Please select an order before adding products.");
            return;
        }

        const isProductAlreadyAdded = products.some(p => p.product_id === productToAdd.id);
        if (isProductAlreadyAdded) {
            Toast.show({
                type: 'info',
                text1: 'Product Already Added',
                text2: 'This product is already in the order. Please update quantity instead.'
            });
            setShowSearchModal(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const url = `http://${ipAddress}:8090/add-product-to-order`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };
            const requestBody = {
                orderId: selectedOrderId,
                productId: productToAdd.id,
                quantity: 1,
                price: productToAdd.price,
                name: productToAdd.name, 
                category: productToAdd.category, // Include product category
            };

            console.log("ADD PRODUCT TO ORDER - Request URL:", url);
            console.log("ADD PRODUCT TO ORDER - Request Headers:", headers);
            console.log("ADD PRODUCT TO ORDER - Request Body:", JSON.stringify(requestBody, null, 2));

            const addProductResponse = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            console.log("ADD PRODUCT TO ORDER - Response Status:", addProductResponse.status);
            console.log("ADD PRODUCT TO ORDER - Response Status Text:", addProductResponse.statusText);

            if (!addProductResponse.ok) {
                const errorText = await addProductResponse.text();
                const message = `Failed to add product to order. Status: ${addProductResponse.status}, Text: ${errorText}`;
                console.error("ADD PRODUCT TO ORDER - Error Response Text:", errorText);
                throw new Error(message);
            }

            const addProductData = await addProductResponse.json();
            console.log("ADD PRODUCT TO ORDER - Response Data:", addProductData);

            if (addProductData.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Product Added to Order',
                    text2: addProductData.message || `${productToAdd.name} has been added to the order.`
                });
                setShowSearchModal(false);
                fetchOrderProducts(selectedOrderId);
                setIsOrderUpdated(false);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Failed to Add Product',
                    text2: addProductData.message || "Failed to add product to order."
                });
                setError(addProductData.message || "Failed to add product to order.");
            }

        } catch (error) {
            console.error("ADD PRODUCT TO ORDER - Error:", error);
            setError(error.message || "Failed to add product to order.");
            Toast.show({ type: 'error', text1: 'Add Product Error', text2: error.message || "Failed to add product to order." });
        } finally {
            setLoading(false);
        }
    };


    const renderProductItem = ({ item, index }) => {
        const totalAmount = item.quantity * item.price;
        return (
            <View style={styles.productItemContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={styles.productNameText}>{item.name} </Text>
                        <Text style={styles.productCategoryText}>({item.category})</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteProductItem(index)}
                        disabled={deleteLoading}
                    >
                        {deleteLoading && deleteLoadingIndex === index ? (
                            <ActivityIndicator size="small" color="#d9534f" />
                        ) : (
                            <Icon name="trash" size={20} color="#d9534f" />
                        )}
                    </TouchableOpacity>
                </View>
                <View style={styles.inputContainer}>
                    <Text style={styles.quantityLabel}>Quantity:</Text>
                    {isOrderUpdated ? (
                        <Text style={styles.viewModeQuantity}>{item.quantity}</Text>
                    ) : (
                        <TextInput
                            style={styles.quantityInput}
                            placeholder="Quantity"
                            keyboardType="number-pad"
                            value={String(item.quantity)}
                            onChangeText={(text) => handleProductQuantityChange(index, text)}
                        />
                    )}
                </View>
                <Text style={styles.amountText}>Amount: ₹{totalAmount.toFixed(2)}</Text>
                {index === products.length - 1 && (
                    <View style={styles.totalSumContainer}>
                        <Text style={styles.totalSumText}>
                            Total Order Amount: ₹
                            {products.reduce((sum, product) => sum + (product.quantity * product.price), 0).toFixed(2)}
                        </Text>
                    </View>
                )}
            </View>
        );
    };


    return (
        <View style={styles.container}>
            <Text style={styles.headerText}>Order Update/Edit Page</Text>
            {loading && <Text style={styles.loadingText}>Loading Orders...</Text>}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Select Order to Update</Text>
            </View>

            <FlatList
                data={orders}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderOrderItem}
                ListEmptyComponent={() => <Text style={{ textAlign: 'center', marginTop: 10 }}>No orders found.</Text>}
            />

            {selectedOrderId && !isOrderUpdated && (
                <View style={styles.orderDetailsSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={styles.sectionHeaderText}>Order ID: {selectedOrderId} - Product Details</Text>
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={() => setShowSearchModal(true)}
                        >
                            <Icon name="search" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                        <FlatList
                            data={products}
                            keyExtractor={(_item, index) => index.toString()}
                            renderItem={renderProductItem}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        />
                    </View>
    
                    <View style={styles.bottomContainer}>
                        <View style={styles.totalSumContainer}>
                            <Text style={styles.totalSumText}>
                                Total Order Amount: ₹
                                {products.reduce((sum, product) => sum + (product.quantity * product.price), 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={styles.actionButtonsContainer}>
                            <Button
                                title="Update Order"
                                onPress={handleUpdateOrder}
                                disabled={loading}
                            />
                        </View>
                    </View>
                </View>
            )}

            <Toast ref={(ref) => Toast.setRef(ref)} />
            <SearchProductModalAdmin
                isVisible={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onAddProduct={handleAddProductToOrder}
                currentCustomerId={selectedOrderCustomerId} // Pass the customer ID of the selected order
                selectedOrderId={selectedOrderId} // Pass selected order ID if needed
            />
        </View>
    )};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f4f8',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        padding: 10,
        backgroundColor: '#fff',
        textAlign: 'center',
        color: '#333',
    },
    loadingText: {
        textAlign: 'center',
        padding: 5,
        color: '#555',
    },
    errorText: {
        color: 'red',
        padding: 5,
        textAlign: 'center',
    },
    sectionHeader: {
        padding: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    sectionHeaderText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    orderItemTouchable: {
        backgroundColor: '#fff',
        padding: 8,
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 4,
        elevation: 1,
    },
    orderItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    orderIdText: {
        fontSize: 14,
        fontWeight: 'bold',
        flex: 1,
    },
    orderAmountText: {
        fontSize: 14,
        flex: 1,
    },
    customerNameText: {
        fontSize: 14,
        flex: 1,
    },
    orderDetailsSection: {
        flex: 1,
        marginTop: 5,
        backgroundColor: '#fff',
    },
    productItemContainer: {
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    productNameText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    productCategoryText: {
        fontSize: 12,
        color: '#666',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    quantityLabel: {
        fontSize: 14,
        width: 70,
    },
    quantityInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 4,
        width: 60,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        elevation: 3,
    },
    actionButtonsContainer: {
        padding: 10,
    },
    actionButtonsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        elevation: 3,
    },
    searchButton: {
        padding: 8,
        backgroundColor: '#FFD700',
        borderRadius: 4,
    },
    deleteOrderButton: {
        backgroundColor: '#FFD700',
        padding: 8,
        borderRadius: 4,
    },
    totalSumContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    totalSumText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    // New button styles
    button: {
        backgroundColor: '#FFD700',
        padding: 10,
        borderRadius: 4,
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default UpdateOrderScreen;