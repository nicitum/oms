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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';
import moment from 'moment';
import axios from 'axios';

const TransactionsPage = () => {
    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(moment().format('YYYY-MM'));
    const [totalOrderAmount, setTotalOrderAmount] = useState(0);
    const [totalPaidAmount, setTotalPaidAmount] = useState(0);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [expandedOrderProducts, setExpandedOrderProducts] = useState([]);
    const [showInvoice, setShowInvoice] = useState(null);
    const [dailyPaidAmounts, setDailyPaidAmounts] = useState({}); // Store daily paid amounts

    // Fetch all orders
    const fetchOrders = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("Authentication token not found");

            const decoded = jwtDecode(token);
            const customerId = decoded.id;

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
            fetchAllDailyPaidAmounts(customerId, selectedMonth); // Fetch daily paid amounts
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
            const token = await AsyncStorage.getItem("userAuthToken");
            const response = await axios.get(
                `http://${ipAddress}:8090/fetch-total-paid`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { customer_id: customerId, month }
                }
            );
            setTotalPaidAmount(response.data.total_paid || 0);
        } catch (err) {
            console.error("Error fetching total paid:", err);
            setTotalPaidAmount(0);
            Alert.alert("Error", `Failed to load total paid: ${err.message}`);
        }
    };

    // Fetch total paid amount for all days in the month
    const fetchAllDailyPaidAmounts = async (customerId, month) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
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
        
        const token = await AsyncStorage.getItem("userAuthToken");
        const decoded = jwtDecode(token);
        fetchTotalPaid(decoded.id, newMonth);
        fetchAllDailyPaidAmounts(decoded.id, newMonth);
    };

    // Format currency
    const formatCurrency = (amount) => {
        return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    };

    // Format date
    const formatDate = (timestamp) => {
        return moment.unix(timestamp).format('MMM D,');
    };

    // Fetch Order Products
    const fetchOrderProducts = useCallback(async (orderId) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
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

    useEffect(() => {
        fetchOrders();
    }, []);

    const groupedOrders = getGroupedOrders();

    return (
        <ScrollView style={styles.container}>
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
                    <ActivityIndicator size="large" color="#007bff" />
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
                renderItem={({ item }) => {
                    const date = moment.unix(item.placed_on).format('YYYY-MM-DD');
                    const dateOrders = groupedOrders.find(g => g.title === date).data;
                    const dateTotalOrderAmount = dateOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
                    const dateTotalPaid = dailyPaidAmounts[date] || 0;

                    const isFirstOrderOfDay = dateOrders[0].id === item.id;
                    return (
                        <TouchableOpacity
                            style={styles.orderItem}
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
                                    Order Id: {item.id}
                                </Text>
                               
                                <Text style={styles.orderAmount}>
                                    {formatCurrency(item.total_amount)}
                                </Text>
                            </View>
                            {/* Display total paid for the day only for first order */}
                            {isFirstOrderOfDay && dateTotalPaid > 0 && (
                                <View style={styles.dailyPaidContainer}>
                                    <Text style={styles.dailyPaidText}>
                                        Total Paid for {moment(date).format('MMMM D, YYYY')}: {formatCurrency(dateTotalPaid)}
                                    </Text>
                                </View>
                            )}
                            {showInvoice === item.id && expandedOrderProducts.length > 0 ? (
                                <View style={styles.invoiceContainer}>
                                <Text style={styles.invoiceTitle}>Order Products</Text>
                                <View style={styles.invoiceTableHeader}>
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                                    <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>Qty</Text>
                                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>Rate</Text>
                                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>GST %</Text>
                                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>GST Amt</Text>
                                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>Value</Text>
                                </View>
                                {calculateInvoiceDetails(expandedOrderProducts).map(product => (
                                    <View key={product.serialNumber} style={styles.invoiceTableRow}>
                                        <Text style={[styles.tableCell, { flex: 1 }]}>{product.name}</Text>
                                        <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right' }]}>{product.quantity}</Text>
                                        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right' }]}>{product.rate}</Text>
                                        <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right' }]}>{product.gstRate}</Text>
                                        <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right' }]}>{formatCurrency(product.gstAmount)}</Text>
                                        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right' }]}>{formatCurrency(product.value)}</Text>
                                    </View>
                                ))}
                                <View style={styles.invoiceTotalRow}>
                                    <Text style={{ fontWeight: 'bold', flex: 3.9, textAlign: 'right', paddingRight: 10 }}>Total (Excl. GST):</Text>
                                    <Text style={{ fontWeight: 'bold', flex: 0.8, textAlign: 'right' }}>{formatCurrency(expandedOrderProducts.reduce((sum, item) => sum + (parseFloat(item.price) / (1 + (parseFloat(item.gst_rate || 0) / 100))) * item.quantity, 0))}</Text>
                                </View>
                                {expandedOrderProducts.length > 0 && (
                                    <View>
                                    {(() => {
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
                                                    <Text style={{ fontWeight: 'bold', flex: 3.9, textAlign: 'right', paddingRight: 10 }}>Total GST Amount:</Text>
                                                    <Text style={{ fontWeight: 'bold', flex: 0.8, textAlign: 'right' }}>{formatCurrency(totalGst)}</Text>
                                                </View>
                                                <View style={styles.invoiceTotalRow}>
                                                    <Text style={{ fontWeight: 'bold', flex: 3.9, textAlign: 'right', paddingRight: 10 }}>CGST:</Text>
                                                    <Text style={{ fontWeight: 'bold', flex: 0.8, textAlign: 'right' }}>{formatCurrency(cgst)}</Text>
                                                </View>
                                                <View style={styles.invoiceTotalRow}>
                                                    <Text style={{ fontWeight: 'bold', flex: 3.9, textAlign: 'right', paddingRight: 10 }}>SGST:</Text>
                                                    <Text style={{ fontWeight: 'bold', flex: 0.8, textAlign: 'right' }}>{formatCurrency(sgst)}</Text>
                                                </View>
                                                <View style={styles.invoiceTotalRow}>
                                                    <Text style={{ fontWeight: 'bold', flex: 3.9, textAlign: 'right', paddingRight: 10 }}>Grand Total:</Text>
                                                    <Text style={{ fontWeight: 'bold', flex: 0.8, textAlign: 'right' }}>{formatCurrency(item.total_amount)}</Text>
                                                </View>
                                            </View>
                                        );
                                    })()}
                                </View>
                            )}
                        </View>
                            ) : showInvoice === item.id ? (
                                <Text style={{ marginTop: 10 }}>Loading order products...</Text>
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
    </ScrollView>
);
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    monthArrow: { fontSize: 30, color: '#007bff' },
    monthText: { fontSize: 18, fontWeight: 'bold' },
    summaryContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceText: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#28a745' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, fontSize: 16, color: '#6c757d' },
    errorText: { fontSize: 16, color: 'red', textAlign: 'center', marginTop: 20 },
    noDataText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 20 },
    sectionHeader: {
        backgroundColor: '#e9ecef',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#dee2e6',
    },
    sectionHeaderText: { fontWeight: 'bold' },
    orderItem: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 8,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    orderDate: { fontWeight: '500' },
    orderAmount: { fontWeight: 'bold', color: '#28a745' },
    dailyPaidContainer: { paddingTop: 5 },
    dailyPaidText: { fontSize: 14, color: '#28a745' },
    invoiceContainer: {
        marginTop: 10,
        padding: 10,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 5,
    },
    invoiceTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    invoiceTableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        paddingBottom: 8,
        marginBottom: 5,
    },
    tableHeaderCell: { fontWeight: 'bold', fontSize: 12 },
    invoiceTableRow: {
        flexDirection: 'row',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    tableCell: { fontSize: 12 },
    invoiceTotalRow: { flexDirection: 'row', marginTop: 5, paddingVertical: 3 },
});

export default TransactionsPage;