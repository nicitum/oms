import React, { useState, useEffect } from 'react';
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
import axios from 'axios';
import { ipAddress } from '../../urls';
import { memo } from 'react';

const UpdateOrdersSA = () => {
    const navigation = useNavigation();
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
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
            const url = `http://${ipAddress}:8090/get-orders-sa?date=${todayFormatted}`;
            console.log("[DEBUG] Fetching admin orders from:", url);
    
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            });
    
            if (!response.data || !response.data.status) {
                throw new Error(response.data?.message || "No valid data received from server");
            }
            
            console.log("Fetched orders data:", response.data);
            
            setOrders(response.data.orders);
            
        } catch (error) {
            const errorMessage = error.response?.data?.message || 
                               error.message || 
                               "Failed to fetch admin orders";
            setError(errorMessage);
            Toast.show({
                type: 'error',
                text1: 'Fetch Error',
                text2: errorMessage
            });
            console.error("Error fetching admin orders:", error);
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
            const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
            const productsResponse = await fetch(url, { headers });

            if (!productsResponse.ok && productsResponse.status !== 404) {
                throw new Error(`Failed to fetch order products: ${productsResponse.status}`);
            }

            const productsData = productsResponse.status === 404 ? [] : await productsResponse.json();
            setProducts(productsData);
            setSelectedOrderId(orderIdToFetch);
            const selectedOrder = orders.find(order => order.id === orderIdToFetch);
            if (selectedOrder) setSelectedOrderCustomerId(selectedOrder.customer_id);
        } catch (error) {
            setError(error.message || "Failed to fetch order products.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: error.message });
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
        setDeleteLoading(true);
        setDeleteLoadingIndex(indexToDelete);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const url = `http://${ipAddress}:8090/delete_order_product/${productToDelete.product_id}`;
            const deleteResponse = await fetch(url, { method: 'DELETE', headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });

            if (!deleteResponse.ok) throw new Error(`Failed to delete product: ${deleteResponse.status}`);
            if (products.length === 1) {
                await handleDeleteOrder(selectedOrderId);
            } else {
                setProducts(products.filter((_, index) => index !== indexToDelete));
                Toast.show({ type: 'success', text1: 'Product Deleted', text2: "Product removed successfully." });
            }
        } catch (deleteError) {
            setError(deleteError.message || "Failed to delete product.");
            Toast.show({ type: 'error', text1: 'Deletion Error', text2: deleteError.message });
        } finally {
            setDeleteLoading(false);
            setDeleteLoadingIndex(null);
        }
    };

    const checkCreditLimit = async () => {
        try {
            const token = await checkTokenAndRedirect(navigation);
            if (!token) return null;
            const decodedToken = jwtDecode(token);
            const customerId = decodedToken.id;
            const response = await fetch(`http://${ipAddress}:8090/credit-limit?customerId=${customerId}`, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (response.ok) return parseFloat((await response.json()).creditLimit);
            if (response.status === 404) return Infinity;
            throw new Error("Failed to fetch credit limit.");
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Credit Limit Error', text2: error.message });
            return null;
        }
    };

    const handleUpdateOrder = async () => {
        if (!selectedOrderId) return Alert.alert("Error", "Please select an order to update.");
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const productsToUpdate = products.map(product => ({
                order_id: selectedOrderId,
                product_id: product.product_id,
                name: product.name,
                category: product.category,
                price: product.price,
                quantity: product.quantity,
                gst_rate: product.gst_rate
            }));
            const totalAmount = productsToUpdate.reduce((sum, p) => sum + p.quantity * p.price, 0);

            const creditLimit = await checkCreditLimit();
            if (creditLimit !== null && creditLimit !== Infinity && totalAmount > creditLimit) {
                Toast.show({ type: 'error', text1: 'Credit Limit Exceeded', text2: `Order exceeds limit by ₹${(totalAmount - creditLimit).toFixed(2)}` });
                return;
            }

            const response = await fetch(`http://${ipAddress}:8090/order_update`, {
                method: 'POST', headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: selectedOrderId, products: productsToUpdate, totalAmount })
            });

            if (!response.ok) throw new Error(`Failed to update order: ${response.status}`);
            const updateData = await response.json();

            if (response.status === 200) {
                const originalOrder = orders.find(o => o.id === selectedOrderId);
                if (originalOrder) {
                    const amountDifference = totalAmount - originalOrder.total_amount;
                    const customerId = originalOrder.customer_id;

                    if (amountDifference > 0) {
                        await axios.post(`http://${ipAddress}:8090/credit-limit/deduct`, { customerId, amountChange: amountDifference }, { headers: { 'Content-Type': 'application/json' } });
                    } else if (amountDifference < 0) {
                        await axios.post(`http://${ipAddress}:8090/increase-credit-limit`, { customerId, amountToIncrease: Math.abs(amountDifference) }, { headers: { 'Content-Type': 'application/json' } });
                    }

                    await axios.post(`http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`, {
                        customerId, totalOrderAmount: totalAmount, originalOrderAmount: originalOrder.total_amount
                    }, { headers: { 'Content-Type': 'application/json' } });

                    Toast.show({ type: 'success', text1: 'Order Updated', text2: "Order and credit updated successfully!" });
                }
                await fetchAdminOrders();
                setSelectedOrderId(null);
                setProducts([]);
            }
        } catch (error) {
            setError(error.message || "Failed to update order.");
            Toast.show({ type: 'error', text1: 'Update Error', text2: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (orderIdToDelete) => {
        setOrderDeleteLoading(true);
        setOrderDeleteLoadingId(orderIdToDelete);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
            const response = await fetch(`http://${ipAddress}:8090/cancel_order/${orderIdToDelete}`, { method: "POST", headers });

            if (!response.ok) throw new Error(`Failed to delete order: ${response.status}`);
            const deleteData = await response.json();
            if (!deleteData.success) throw new Error(deleteData.message);

            const cancelledOrder = orders.find(order => order.id === orderIdToDelete);
            if (cancelledOrder) {
                const { customer_id: customerId, total_amount: cancelledOrderAmount } = cancelledOrder;
                await fetch(`http://${ipAddress}:8090/increase-credit-limit`, {
                    method: "POST", headers, body: JSON.stringify({ customerId, amountToIncrease: cancelledOrderAmount })
                });
                await axios.post(`http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`, {
                    customerId, totalOrderAmount: 0, originalOrderAmount: cancelledOrderAmount
                }, { headers: { 'Content-Type': 'application/json' } });
            }

            setSelectedOrderId(null);
            setProducts([]);
            await fetchAdminOrders();
            Toast.show({ type: "success", text1: "Order Cancelled", text2: deleteData.message });
        } catch (error) {
            setError(error.message || "Failed to cancel order.");
            Toast.show({ type: "error", text1: "Cancellation Error", text2: error.message });
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
                const customerPriceCheckUrl = `http://${ipAddress}:8090/customer_price_check?customer_id=${selectedOrderCustomerId}`;
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
                const priceResponse = await fetch(`http://${ipAddress}:8090/latest-product-price?productId=${productToAdd.id}`, {
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
    
            const response = await fetch(`http://${ipAddress}:8090/add-product-to-order`, {
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

    const handleIncreaseQuantity = (index) => {
        if (isOrderUpdated) return;
        const newProducts = [...products];
        newProducts[index].quantity = (newProducts[index].quantity || 0) + 1;
        setProducts(newProducts);
    };

    const handleDecreaseQuantity = (index) => {
        if (isOrderUpdated) return;
        const newProducts = [...products];
        newProducts[index].quantity = Math.max(0, (newProducts[index].quantity || 0) - 1);
        setProducts(newProducts);
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
                <Text style={styles.headerTitle}>Super Admin Orders</Text>
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
    
                {selectedOrderId && (
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
        backgroundColor: '#003366',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
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
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    quantityButton: {
        backgroundColor: '#4F46E5',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityValue: {
        paddingHorizontal: 10,
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
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

export default UpdateOrdersSA;