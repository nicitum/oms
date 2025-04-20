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
  ScrollView 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/FontAwesome';
import SearchProductModal from '../IndentPage/nestedPage/searchProductModal';
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
    const [showSearchModal, setShowSearchModal] = useState(false);
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
            if (!token) throw new Error("No authentication token found");
    
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;
    
            const todayFormatted = moment().format("YYYY-MM-DD");
            const url = `http://${ipAddress}:8090/get-admin-orders/${adminId}?date=${todayFormatted}`;
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

            const creditLimitResponse = await fetch(`http://${ipAddress}:8090/credit-limit?customerId=${customerId}`, {
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

            const url = `http://${ipAddress}:8090/order_update`;
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
                            url: `http://${ipAddress}:8090/credit-limit/deduct`,
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
                            url: `http://${ipAddress}:8090/increase-credit-limit`,
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
                        url: `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
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

            if (cancelledOrder) {
                const originalTotalAmount = cancelledOrder.total_amount;
                const customerIdForAmountDueUpdate = cancelledOrder.customer_id;

                const updateAmountDueOptions = {
                    method: 'POST',
                    url: `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
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
                category: productToAdd.category,
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

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.orderCard, selectedOrderId === item.id && styles.selectedOrderCard]}
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
            <View style={styles.orderCardContent}>
                <View style={styles.orderCardLeft}>
                    <Text style={styles.orderText}>Order #{item.id}</Text>
                    <Text style={styles.orderAmount}>₹{item.total_amount ? parseFloat(item.total_amount).toFixed(2) : '0.00'}</Text>
                    <View style={[styles.statusBadge, item.cancelled === 'Yes' ? styles.cancelledBadge : styles.activeBadge]}>
                        <Text style={[styles.statusText, item.cancelled === 'Yes' ? styles.cancelledText : styles.activeText]}>
                            {item.cancelled === 'Yes' ? 'Cancelled' : 'Active'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleDeleteOrder(item.id)}
                    disabled={orderDeleteLoading}
                >
                    {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Icon name="times" size={16} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    const renderProductItem = ({ item, index }) => {
        const totalAmount = (item.quantity * item.price).toFixed(2);
        return (
            <View style={styles.productCard}>
                <View style={styles.productHeader}>
                    <View style={styles.productInfo}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text style={styles.productCategory}>{item.category}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.deleteIcon}
                        onPress={() => handleDeleteProductItem(index)}
                        disabled={deleteLoading}
                    >
                        {deleteLoading && deleteLoadingIndex === index ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Icon name="trash" size={18} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
                <View style={styles.productDetails}>
                    <View style={styles.quantityContainer}>
                        <Text style={styles.quantityLabel}>Quantity:</Text>
                        {isOrderUpdated ? (
                            <Text style={styles.viewModeQuantity}>{item.quantity}</Text>
                        ) : (
                            <TextInput
                                style={styles.quantityInput}
                                value={String(item.quantity)}
                                onChangeText={(text) => handleProductQuantityChange(index, text)}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor="#999"
                            />
                        )}
                    </View>
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>Price:</Text>
                        <Text style={styles.priceValue}>₹{parseFloat(item.price).toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.amountText}>₹{totalAmount}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Admin Orders</Text>
                <Text style={styles.headerSubtitle}>{moment().format('MMMM D, YYYY')}</Text>
            </View>
            
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {loading && <ActivityIndicator size="large" color="#4F46E5" style={styles.loading} />}
                {error && (
                    <View style={styles.errorContainer}>
                        <Icon name="exclamation-circle" size={20} color="#EF4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
    
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOrderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="inbox" size={40} color="#9CA3AF" />
                            <Text style={styles.emptyText}>No orders found for today</Text>
                        </View>
                    }
                    contentContainerStyle={styles.orderList}
                    scrollEnabled={false} // Disable internal scrolling of FlatList
                />
    
                {selectedOrderId && !isOrderUpdated && (
                    <View style={styles.orderDetails}>
                        <View style={styles.orderDetailsHeader}>
                            <Text style={styles.orderDetailsTitle}>Order #{selectedOrderId} Details</Text>
                            <TouchableOpacity style={styles.addButton} onPress={() => setShowSearchModal(true)}>
                                <Icon name="plus" size={16} color="#fff" />
                                <Text style={styles.addButtonText}>Add Product</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={products}
                            keyExtractor={(_, index) => index.toString()}
                            renderItem={renderProductItem}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Icon name="shopping-basket" size={40} color="#9CA3AF" />
                                    <Text style={styles.emptyText}>No products in this order</Text>
                                </View>
                            }
                            contentContainerStyle={styles.productList}
                            scrollEnabled={false} // Disable internal scrolling of FlatList
                        />
                        <View style={styles.footer}>
                            <View style={styles.totalSummary}>
                                <Text style={styles.totalLabel}>Order Total:</Text>
                                <Text style={styles.totalText}>
                                    ₹{products.reduce((sum, p) => sum + p.quantity * p.price, 0).toFixed(2)}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateOrder} disabled={loading}>
                                {loading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Icon name="check" size={16} color="#fff" style={styles.updateIcon} />
                                        <Text style={styles.updateButtonText}>Update Order</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
    
            <SearchProductModal
                isVisible={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onAddProduct={handleAddProductToOrder}
                currentCustomerId={selectedOrderCustomerId}
                selectedOrderId={selectedOrderId}
            />
            <Toast />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        backgroundColor: '#4F46E5',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginTop: 5,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    loading: {
        marginVertical: 20,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 15,
        marginTop: 15,
    },
    errorText: {
        color: '#B91C1C',
        marginLeft: 8,
        flex: 1,
        fontSize: 14,
    },
    orderList: {
        padding: 15,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectedOrderCard: {
        borderColor: '#4F46E5',
        borderWidth: 2,
    },
    orderCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderCardLeft: {
        flex: 1,
    },
    orderText: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    orderAmount: {
        color: '#4F46E5',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    activeBadge: {
        backgroundColor: '#DCFCE7',
    },
    cancelledBadge: {
        backgroundColor: '#FEE2E2',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    activeText: {
        color: '#166534',
    },
    cancelledText: {
        color: '#B91C1C',
    },
    cancelButton: {
        backgroundColor: '#EF4444',
        padding: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        height: 40,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    emptyText: {
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 10,
        fontSize: 16,
    },
    orderDetails: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        margin: 15,
        marginTop: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    orderDetailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    orderDetailsTitle: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '600',
    },
    addButton: {
        flexDirection: 'row',
        backgroundColor: '#4F46E5',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        marginLeft: 5,
        fontWeight: '500',
    },
    productList: {
        paddingBottom: 80,
    },
    productCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    productCategory: {
        color: '#6B7280',
        fontSize: 12,
    },
    deleteIcon: {
        backgroundColor: '#EF4444',
        padding: 8,
        borderRadius: 8,
    },
    productDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        flexWrap: 'wrap',
    },
    quantityContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginRight: 10,
        marginBottom: 5,
    },
    priceContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginRight: 10,
        marginBottom: 5,
    },
    totalContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    quantityLabel: {
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 4,
    },
    priceLabel: {
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 4,
    },
    totalLabel: {
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 4,
    },
    priceValue: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '500',
    },
    quantityInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        width: 70,
        textAlign: 'center',
        color: '#111827',
        fontSize: 14,
    },
    viewModeQuantity: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '500',
    },
    amountText: {
        color: '#4F46E5',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 3,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    totalSummary: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    totalText: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '700',
    },
    updateButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    updateIcon: {
        marginRight: 6,
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default UpdateOrderScreen;