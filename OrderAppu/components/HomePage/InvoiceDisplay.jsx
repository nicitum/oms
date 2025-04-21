import React, { useEffect, useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    SectionList,
    FlatList,
    TextInput,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../urls';
import moment from 'moment';
import axios from 'axios';

const InvoiceDisplay = () => {
    const [allUsers, setAllUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(moment().format('YYYY-MM'));
    const [totalOrderAmount, setTotalOrderAmount] = useState(0);
    const [totalPaidAmount, setTotalPaidTupla] = useState(0);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [expandedOrderProducts, setExpandedOrderProducts] = useState([]);
    const [showInvoice, setShowInvoice] = useState(null);
    const [dailyPaidAmounts, setDailyPaidAmounts] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const fadeAnim = useState(new Animated.Value(0))[0];

    // Fade-in animation for search bar
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    // Helper to get token
    const getToken = async () => {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) throw new Error("Authentication token not found");
        return token;
    };

    // Fetch all users
    const fetchAllUsers = useCallback(async () => {
        try {
            setLoading(true);
            const authToken = await getToken();
            const url = `http://${ipAddress}:8090/allUsers/`;
            
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch users: ${response.status}`);
            }

            const data = await response.json();
            setAllUsers(data.data || []);
            setFilteredUsers(data.data || []);
            setError(null);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err.message);
            setAllUsers([]);
            setFilteredUsers([]);
            Alert.alert("Error", `Failed to load users: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter users based on search query
    const handleSearch = (query) => {
        setSearchQuery(query);
        const filtered = allUsers.filter(user =>
            (user.name || `User ${user.customer_id}`)
                .toLowerCase()
                .includes(query.toLowerCase())
        );
        setFilteredUsers(filtered);
    };

    // Fetch all orders for selected user
    const fetchOrders = async (customerId) => {
        try {
            setLoading(true);
            const token = await getToken();
            const response = await fetch(
                `http://${ipAddress}:8090/get-orders/${customerId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAllOrders(data.orders || []);
            calculateMonthlyOrderData(data.orders || [], selectedMonth);
            fetchTotalPaid(customerId, selectedMonth);
            fetchAllDailyPaidAmounts(customerId, selectedMonth);
            setError(null);
        } catch (err) {
            console.error("Error fetching orders:", err);
            setError(err.message);
            setAllOrders([]);
            Alert.alert("Error", `Failed to load orders: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch total paid amount for the month
    const fetchTotalPaid = async (customerId, month) => {
        try {
            const token = await getToken();
            const response = await axios.get(
                `http://${ipAddress}:8090/fetch-total-paid`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { customer_id: customerId, month }
                }
            );
            setTotalPaidTupla(response.data.total_paid || 0);
        } catch (err) {
            console.error("Error fetching total paid:", err);
            setTotalPaidTupla(0);
            Alert.alert("Error", `Failed to load total paid: ${err.message}`);
        }
    };

    // Fetch total paid amount for all days in the month
    const fetchAllDailyPaidAmounts = async (customerId, month) => {
        try {
            const token = await getToken();
            const daysInMonth = moment(month).daysInMonth();
            const dailyAmounts = {};

            for (let day = 1; day <= daysInMonth; day++) {
                const date = moment(month).date(day).format('YYYY-MM-DD');
                const response = await axios.get(
                    `http://${ipAddress}:8090/fetch-total-paid-by-day`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { customer_id: customerId, date }
                    }
                );
                const totalPaid = response.data.total_paid || 0;
                if (totalPaid > 0) {
                    dailyAmounts[date] = totalPaid;
                }
            }

            setDailyPaidAmounts(dailyAmounts);
        } catch (err) {
            console.error("Error fetching daily paid amounts:", err);
            setDailyPaidAmounts({});
            Alert.alert("Error", `Failed to load daily paid amounts: ${err.message}`);
        }
    };

    // Calculate monthly order totals
    const calculateMonthlyOrderData = (orders, month) => {
        const filtered = orders.filter(order =>
            moment.unix(order.placed_on).format('YYYY-MM') === month
        );
        const totalAmount = filtered.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        setTotalOrderAmount(totalAmount);
    };

    // Group orders by date
    const getGroupedOrders = () => {
        const filtered = allOrders.filter(order =>
            moment.unix(order.placed_on).format('YYYY-MM') === selectedMonth
        );

        const grouped = filtered.reduce((acc, order) => {
            const date = moment.unix(order.placed_on).format('YYYY-MM-DD');
            if (!acc[date]) acc[date] = [];
            acc[date].push(order);
            return acc;
        }, {});

        return Object.keys(grouped).map(date => ({
            title: date,
            data: grouped[date]
        })).sort((a, b) => new Date(b.title) - new Date(a.title));
    };

    // Handle month change
    const changeMonth = async (increment) => {
        const newMonth = moment(selectedMonth).add(increment, 'months').format('YYYY-MM');
        setSelectedMonth(newMonth);
        calculateMonthlyOrderData(allOrders, newMonth);
        if (selectedUser) {
            fetchTotalPaid(selectedUser.customer_id, newMonth);
            fetchAllDailyPaidAmounts(selectedUser.customer_id, newMonth);
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    };

    // Format date
    const formatDate = (timestamp) => {
        return moment.unix(timestamp).format('MMM D, YYYY');
    };

    // Fetch Order Products
    const fetchOrderProducts = useCallback(async (orderId) => {
        try {
            const token = await getToken();
            const response = await axios.get(
                `http://${ipAddress}:8090/order-products?orderId=${orderId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching order products:", error);
            Alert.alert("Error", "Failed to fetch order details.");
            return [];
        }
    }, []);

    const calculateInvoiceDetails = useCallback((products) => {
        return products.map((op, index) => {
            const priceIncludingGst = parseFloat(op.price);
            const gstRate = parseFloat(op.gst_rate || 0);
            const basePrice = gstRate > 0 ? priceIncludingGst / (1 + (gstRate / 100)) : priceIncludingGst;
            const value = basePrice * op.quantity;
            const gstAmount = priceIncludingGst - basePrice;
            return {
                serialNumber: index + 1,
                name: op.name,
                quantity: op.quantity,
                rate: basePrice.toFixed(2),
                value: value.toFixed(2),
                gstRate: gstRate.toFixed(2),
                gstAmount: (gstAmount * op.quantity).toFixed(2),
                priceIncludingGst: priceIncludingGst.toFixed(2),
            };
        });
    }, []);

    const handleOrderPress = async (orderId) => {
        if (showInvoice === orderId) {
            setShowInvoice(null);
            setExpandedOrderProducts([]);
        } else {
            setShowInvoice(orderId);
            setExpandedOrder(orderId);
            const productsData = await fetchOrderProducts(orderId);
            setExpandedOrderProducts(productsData);
        }
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setAllOrders([]);
        setTotalOrderAmount(0);
        setTotalPaidTupla(0);
        setDailyPaidAmounts({});
        setExpandedOrder(null);
        setExpandedOrderProducts([]);
        setShowInvoice(null);
        fetchOrders(user.customer_id);
    };

    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    const groupedOrders = getGroupedOrders();

    return (
        <ScrollView style={styles.container}>
            {!selectedUser ? (
                <>
                    <Text style={styles.title}>Select a Customer</Text>
                    <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search customers by name..."
                            value={searchQuery}
                            onChangeText={handleSearch}
                            placeholderTextColor="#666"
                        />
                    </Animated.View>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#003366" />
                            <Text style={styles.loadingText}>Loading customers...</Text>
                        </View>
                    ) : error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : filteredUsers.length === 0 ? (
                        <Text style={styles.noDataText}>No customers found.</Text>
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={(item) => item.customer_id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.userItem}
                                    onPress={() => handleUserSelect(item)}
                                >
                                    <Text style={styles.userText}>
                                        {item.name || `Customer ${item.customer_id}`}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </>
            ) : (
                <>
                    <View style={styles.userHeader}>
                        <TouchableOpacity onPress={() => setSelectedUser(null)}>
                            <Text style={styles.backButton}>← Back to Customers</Text>
                        </TouchableOpacity>
                        <Text style={styles.selectedUserText}>
                            {selectedUser.name || `Customer ${selectedUser.customer_id}`}
                        </Text>
                    </View>

                    {/* Month Selector */}
                    <View style={styles.monthSelector}>
                        <TouchableOpacity onPress={() => changeMonth(-1)}>
                            <Text style={styles.monthArrow}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthText}>
                            {moment(selectedMonth).format('MMMM YYYY')}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)}>
                            <Text style={styles.monthArrow}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Balance Summary */}
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.balanceText}>Total Invoice: {formatCurrency(totalOrderAmount)}</Text>
                            <Text style={styles.balanceText}>Total Paid: {formatCurrency(totalPaidAmount)}</Text>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#003366" />
                            <Text style={styles.loadingText}>Loading...</Text>
                        </View>
                    ) : error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : groupedOrders.length === 0 ? (
                        <Text style={styles.noDataText}>No orders found for this month.</Text>
                    ) : (
                        <SectionList
                            sections={groupedOrders}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item, index }) => {
                                const date = moment.unix(item.placed_on).format('YYYY-MM-DD');
                                const dateOrders = groupedOrders.find(g => g.title === date).data;
                                const dateTotalOrderAmount = dateOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
                                const dateTotalPaid = dailyPaidAmounts[date] || 0;

                                const isFirstOrderOfDay = dateOrders[0].id === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.orderItem, { backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#fff' }]}
                                        onPress={() => handleOrderPress(item.id)}
                                    >
                                        {isFirstOrderOfDay && (
                                            <View style={styles.orderHeader}>
                                                <Text style={styles.orderDate}>
                                                    Total Invoice for the day:
                                                </Text>
                                                <Text style={styles.orderAmount}>
                                                    {formatCurrency(dateTotalOrderAmount)}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.orderHeader}>
                                            <Text style={styles.orderDate}>
                                                Order ID: {item.id}
                                            </Text>
                                            <Text style={styles.orderAmount}>
                                                {formatCurrency(item.total_amount)}
                                            </Text>
                                        </View>
                                        {isFirstOrderOfDay && dateTotalPaid > 0 && (
                                            <View style={styles.dailyPaidContainer}>
                                                <Text style={styles.dailyPaidText}>
                                                    Total Paid for {moment(date).format('MMMM D, YYYY')}: {formatCurrency(dateTotalPaid)}
                                                </Text>
                                            </View>
                                        )}
                                        {showInvoice === item.id && expandedOrderProducts.length > 0 ? (
                                            <View style={styles.invoiceContainer}>
                                                <Text style={styles.invoiceTitle}>Order Details</Text>
                                                <View style={styles.invoiceTableHeader}>
                                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                                                    <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>Qty</Text>
                                                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>Rate</Text>
                                                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>GST %</Text>
                                                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>GST Amt</Text>
                                                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>Value</Text>
                                                </View>
                                                {calculateInvoiceDetails(expandedOrderProducts).map((product, idx) => (
                                                    <View key={product.serialNumber} style={[styles.invoiceTableRow, { backgroundColor: idx % 2 === 0 ? '#f1f5f9' : '#fff' }]}>
                                                        <Text style={[styles.tableCell, { flex: 1 }]}>{product.name}</Text>
                                                        <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right' }]}>{product.quantity}</Text>
                                                        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right' }]}>{product.rate}</Text>
                                                        <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right' }]}>{product.gstRate}</Text>
                                                        <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right' }]}>{formatCurrency(product.gstAmount)}</Text>
                                                        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right' }]}>{formatCurrency(product.value)}</Text>
                                                    </View>
                                                ))}
                                                <View style={styles.invoiceTotalRow}>
                                                    <Text style={styles.totalLabel}>Total (Excl. GST):</Text>
                                                    <Text style={styles.totalValue}>
                                                        {formatCurrency(expandedOrderProducts.reduce((sum, item) => sum + (parseFloat(item.price) / (1 + (parseFloat(item.gst_rate || 0) / 100))) * item.quantity, 0))}
                                                    </Text>
                                                </View>
                                                {expandedOrderProducts.length > 0 && (
                                                    (() => {
                                                        const totalGst = expandedOrderProducts.reduce((sum, item) => {
                                                            const price = parseFloat(item.price);
                                                            const gstRate = parseFloat(item.gst_rate || 0);
                                                            const basePrice = price / (1 + (gstRate / 100));
                                                            const gstAmount = price - basePrice;
                                                            return sum + (gstAmount * item.quantity);
                                                        }, 0);
                                                        const cgst = totalGst / 2;
                                                        const sgst = totalGst / 2;
                                                        return (
                                                            <View>
                                                                <View style={styles.invoiceTotalRow}>
                                                                    <Text style={styles.totalLabel}>Total GST Amount:</Text>
                                                                    <Text style={styles.totalValue}>{formatCurrency(totalGst)}</Text>
                                                                </View>
                                                                <View style={styles.invoiceTotalRow}>
                                                                    <Text style={styles.totalLabel}>CGST:</Text>
                                                                    <Text style={styles.totalValue}>{formatCurrency(cgst)}</Text>
                                                                </View>
                                                                <View style={styles.invoiceTotalRow}>
                                                                    <Text style={styles.totalLabel}>SGST:</Text>
                                                                    <Text style={styles.totalValue}>{formatCurrency(sgst)}</Text>
                                                                </View>
                                                                <View style={styles.invoiceTotalRow}>
                                                                    <Text style={styles.totalLabel}>Grand Total:</Text>
                                                                    <Text style={styles.totalValue}>{formatCurrency(item.total_amount)}</Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })()
                                                )}
                                            </View>
                                        ) : showInvoice === item.id ? (
                                            <Text style={styles.loadingText}>Loading order details...</Text>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            }}
                            renderSectionHeader={({ section: { title } }) => (
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionHeaderText}>{formatDate(moment(title, 'YYYY-MM-DD').unix())}</Text>
                                </View>
                            )}
                        />
                    )}
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#003366',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: 'System', // Use system font for professional look
    },
    searchContainer: {
        marginBottom: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchInput: {
        fontSize: 16,
        color: '#333',
        paddingVertical: 10,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#003366',
        padding: 15,
        borderRadius: 10,
    },
    backButton: {
        fontSize: 16,
        color: '#fff',
        marginRight: 15,
        fontWeight: '600',
    },
    selectedUserText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    userItem: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    monthArrow: {
        fontSize: 30,
        color: '#003366',
        fontWeight: 'bold',
    },
    monthText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#003366',
    },
    summaryContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    balanceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
        marginBottom: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    errorText: {
        fontSize: 16,
        color: '#d32f2f',
        textAlign: 'center',
        marginTop: 20,
        fontWeight: '600',
    },
    noDataText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
        fontWeight: '500',
    },
    sectionHeader: {
        backgroundColor: '#003366',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    orderItem: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    orderDate: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#003366',
    },
    dailyPaidContainer: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    dailyPaidText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#003366',
    },
    invoiceContainer: {
        marginTop: 15,
        padding: 15,
        borderColor: '#003366',
        borderWidth: 1,
        borderRadius: 10,
        backgroundColor: '#fff',
    },
    invoiceTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
        marginBottom: 15,
        textAlign: 'center',
    },
    invoiceTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#003366',
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderRadius: 5,
        marginBottom: 10,
    },
    tableHeaderCell: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    invoiceTableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    tableCell: {
        fontSize: 12,
        fontWeight: '500',
        color: '#333',
    },
    invoiceTotalRow: {
        flexDirection: 'row',
        marginTop: 8,
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#003366',
        flex: 3.9,
        textAlign: 'right',
        paddingRight: 10,
    },
    totalValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#003366',
        flex: 0.8,
        textAlign: 'right',
    },
});

export default InvoiceDisplay;