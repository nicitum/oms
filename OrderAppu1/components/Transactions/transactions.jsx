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
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';
import moment from 'moment';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Button } from 'react-native-paper';

const COLORS = {
    primary: '#003366',
    secondary: '#004d99',
    accent: '#0066cc',
    background: '#f5f7fa',
    surface: '#ffffff',
    text: {
        primary: '#1a1a1a',
        secondary: '#666666',
        light: '#ffffff',
    },
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
};

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
                `http://${ipAddress}:8091/get-orders/${customerId}`,
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
                `http://${ipAddress}:8091/fetch-total-paid`,
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
                    `http://${ipAddress}:8091/fetch-total-paid-by-day`,
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
                `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
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

    // Enhanced MonthSelector component
    const MonthSelector = () => (
        <View style={styles.monthSelector}>
            <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => changeMonth(-1)}
            >
                <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
                {moment(selectedMonth).format('MMMM YYYY')}
            </Text>
            <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => changeMonth(1)}
            >
                <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
            </TouchableOpacity>
        </View>
    );

    // Enhanced SummaryCard component
    const SummaryCard = ({ title, amount, icon, color = COLORS.primary }) => (
        <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
                <View style={[styles.summaryIconContainer, { backgroundColor: `${color}15` }]}>
                    <MaterialCommunityIcons name={icon} size={24} color={color} />
                </View>
                <View style={styles.summaryTextContainer}>
                    <Text style={styles.summaryTitle}>{title}</Text>
                    <Text style={[styles.summaryAmount, { color }]}>{formatCurrency(amount)}</Text>
                </View>
            </Card.Content>
        </Card>
    );

    // Enhanced OrderItem component
    const OrderItem = ({ item, isFirstOrderOfDay, dateTotalOrderAmount, dateTotalPaid }) => (
        <Card style={styles.orderCard}>
            <Card.Content>
                {isFirstOrderOfDay && (
                    <View style={styles.dailySummary}>
                        <Text style={styles.dailySummaryTitle}>Daily Summary</Text>
                        <View style={styles.dailySummaryRow}>
                            <Text style={styles.dailySummaryLabel}>Total Invoice:</Text>
                            <Text style={styles.dailySummaryValue}>{formatCurrency(dateTotalOrderAmount)}</Text>
                        </View>
                        {dateTotalPaid > 0 && (
                            <View style={styles.dailySummaryRow}>
                                <Text style={styles.dailySummaryLabel}>Total Paid:</Text>
                                <Text style={[styles.dailySummaryValue, { color: COLORS.success }]}>
                                    {formatCurrency(dateTotalPaid)}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                <TouchableOpacity onPress={() => handleOrderPress(item.id)}>
                    <View style={styles.orderHeader}>
                        <View style={styles.orderIdContainer}>
                            <MaterialCommunityIcons name="receipt" size={20} color={COLORS.primary} />
                            <Text style={styles.orderId}>Order #{item.id}</Text>
                        </View>
                        <Text style={styles.orderAmount}>{formatCurrency(item.total_amount)}</Text>
                    </View>
                </TouchableOpacity>
                {showInvoice === item.id && (
                    <View style={styles.invoiceDetails}>
                        {expandedOrderProducts.length > 0 ? (
                            <View>
                                <View style={styles.invoiceTableHeader}>
                                    <Text style={styles.tableHeaderCell}>Product</Text>
                                    <Text style={styles.tableHeaderCell}>Qty</Text>
                                    <Text style={styles.tableHeaderCell}>Rate</Text>
                                    <Text style={styles.tableHeaderCell}>GST</Text>
                                    <Text style={styles.tableHeaderCell}>Total</Text>
                                </View>
                                {calculateInvoiceDetails(expandedOrderProducts).map(product => (
                                    <View key={product.serialNumber} style={styles.invoiceTableRow}>
                                        <Text style={styles.tableCell}>{product.name}</Text>
                                        <Text style={styles.tableCell}>{product.quantity}</Text>
                                        <Text style={styles.tableCell}>{product.rate}</Text>
                                        <Text style={styles.tableCell}>{product.gstRate}%</Text>
                                        <Text style={styles.tableCell}>{formatCurrency(product.value)}</Text>
                                    </View>
                                ))}
                                <View style={styles.invoiceTotalSection}>
                                    <View style={styles.invoiceTotalRow}>
                                        <Text style={styles.totalLabel}>Subtotal:</Text>
                                        <Text style={styles.totalValue}>
                                            {formatCurrency(expandedOrderProducts.reduce((sum, item) => 
                                                sum + (parseFloat(item.price) / (1 + (parseFloat(item.gst_rate || 0) / 100))) * item.quantity, 0
                                            ))}
                                        </Text>
                                    </View>
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
                                                    <Text style={styles.totalLabel}>CGST:</Text>
                                                    <Text style={styles.totalValue}>{formatCurrency(cgst)}</Text>
                                                </View>
                                                <View style={styles.invoiceTotalRow}>
                                                    <Text style={styles.totalLabel}>SGST:</Text>
                                                    <Text style={styles.totalValue}>{formatCurrency(sgst)}</Text>
                                                </View>
                                                <View style={[styles.invoiceTotalRow, styles.grandTotalRow]}>
                                                    <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                                                    <Text style={styles.grandTotalValue}>{formatCurrency(item.total_amount)}</Text>
                                                </View>
                                            </View>
                                        );
                                    })()}
                                </View>
                            </View>
                        ) : (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        )}
                    </View>
                )}
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles.container}>
            <MonthSelector />
            
            <View style={styles.summaryContainer}>
                <SummaryCard 
                    title="Total Invoice" 
                    amount={totalOrderAmount} 
                    icon="file-document-outline"
                    color={COLORS.primary}
                />
                <SummaryCard 
                    title="Total Paid" 
                    amount={totalPaidAmount} 
                    icon="cash-multiple"
                    color={COLORS.success}
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <Button
                        mode="contained"
                        onPress={fetchOrders}
                        style={styles.retryButton}
                        labelStyle={styles.retryButtonText}
                    >
                        Retry
                    </Button>
                </View>
            ) : groupedOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.text.secondary} />
                    <Text style={styles.emptyText}>No transactions found for this month</Text>
                </View>
            ) : (
                <SectionList
                    sections={groupedOrders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index, section }) => {
                        const isFirstOrderOfDay = index === 0;
                        const date = moment.unix(item.placed_on).format('YYYY-MM-DD');
                        const dateTotalPaid = dailyPaidAmounts[date] || 0;
                        const dateOrders = section.data;
                        const dateTotalOrderAmount = dateOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);

                        return (
                            <OrderItem
                                item={item}
                                isFirstOrderOfDay={isFirstOrderOfDay}
                                dateTotalOrderAmount={dateTotalOrderAmount}
                                dateTotalPaid={dateTotalPaid}
                            />
                        );
                    }}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>
                                {formatDate(moment(title, 'YYYY-MM-DD').unix())}
                            </Text>
                        </View>
                    )}
                    contentContainerStyle={styles.sectionListContent}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.surface,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    monthButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: `${COLORS.primary}10`,
    },
    monthText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.primary,
    },
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
    },
    summaryCard: {
        flex: 1,
        marginHorizontal: 8,
        elevation: 2,
        borderRadius: 12,
    },
    summaryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    summaryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    summaryTextContainer: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginBottom: 4,
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: COLORS.error,
        textAlign: 'center',
        marginTop: 12,
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: COLORS.primary,
    },
    retryButtonText: {
        color: COLORS.text.light,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.text.secondary,
        marginTop: 12,
        textAlign: 'center',
    },
    sectionHeader: {
        backgroundColor: COLORS.primary,
        padding: 12,
        marginBottom: 8,
    },
    sectionHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.light,
    },
    sectionListContent: {
        padding: 16,
    },
    orderCard: {
        marginBottom: 12,
        elevation: 2,
        borderRadius: 12,
    },
    dailySummary: {
        backgroundColor: `${COLORS.primary}10`,
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    dailySummaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 8,
    },
    dailySummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    dailySummaryLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    dailySummaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 8,
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    invoiceDetails: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: `${COLORS.primary}20`,
    },
    invoiceTableHeader: {
        flexDirection: 'row',
        backgroundColor: `${COLORS.primary}10`,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
        textAlign: 'center',
    },
    invoiceTableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: `${COLORS.primary}10`,
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        color: COLORS.text.primary,
        textAlign: 'center',
    },
    invoiceTotalSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: `${COLORS.primary}20`,
    },
    invoiceTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    totalLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    totalValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    grandTotalRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: `${COLORS.primary}20`,
    },
    grandTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    grandTotalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
});

export default TransactionsPage;