import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    ToastAndroid,
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

const AdminOrderHistory = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirm = (date) => {
        hideDatePicker();
        setSelectedDate(date);
        fetchOrders(date);
    };

    const fetchOrders = useCallback(async (dateFilter) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;

            const url = `http://${ipAddress}:8090/get-admin-orders/${adminId}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            const ordersResponse = await fetch(url, { headers });

            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                throw new Error(`Failed to fetch admin orders. Status: ${ordersResponse.status}`);
            }

            const ordersData = await ordersResponse.json();
            let fetchedOrders = ordersData.orders;

            let filteredOrders = fetchedOrders;

            if (dateFilter) {
                const filterDateFormatted = moment(dateFilter).format("YYYY-MM-DD");
                filteredOrders = fetchedOrders.filter(order => {
                    if (!order.placed_on) return false;
                    const parsedEpochSeconds = parseInt(order.placed_on, 10);
                    const orderDateMoment = moment.unix(parsedEpochSeconds);
                    const orderDateFormatted = orderDateMoment.format("YYYY-MM-DD");
                    return orderDateFormatted === filterDateFormatted;
                });
            } else {
                const todayFormatted = moment().format("YYYY-MM-DD");
                filteredOrders = fetchedOrders.filter(order => {
                    if (!order.placed_on) return false;
                    const parsedEpochSeconds = parseInt(order.placed_on, 10);
                    const orderDateMoment = moment.unix(parsedEpochSeconds);
                    const orderDateFormatted = orderDateMoment.format("YYYY-MM-DD");
                    return orderDateFormatted === todayFormatted;
                });
            }

            setOrders(filteredOrders);

        } catch (fetchOrdersError) {
            console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
            Alert.alert("Error", fetchOrdersError.message || "Failed to fetch admin orders.");
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
            return () => {};
        }, [fetchOrders])
    );

    const fetchOrderProducts = async (orderId) => {
        try {
            const token = await checkTokenAndRedirect(navigation);
            if (!token) throw new Error("No authorization token found.");

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
    };

    const handleOrderDetailsPress = async (orderId) => {
        if (expandedOrderDetailsId === orderId) {
            setExpandedOrderDetailsId(null);
        } else {
            setExpandedOrderDetailsId(orderId);
            if (!orderDetails[orderId]) {
                const products = await fetchOrderProducts(orderId);
                setOrderDetails((prevDetails) => ({ ...prevDetails, [orderId]: products }));
            }
        }
    };

    const renderOrderDetails = (orderId) => {
        const products = orderDetails[orderId];
        if (!expandedOrderDetailsId || expandedOrderDetailsId !== orderId || !products) {
            return null;
        }

        return (
            <View style={detailStyles.orderDetailsContainer}>
                <Text style={detailStyles.orderDetailsTitle}>Order Items</Text>

                <View style={detailStyles.headerRow}>
                    <Text style={[detailStyles.headerCell, { flex: 2 }]}>Product</Text>
                    <Text style={detailStyles.headerCell}>Qty</Text>
                    <Text style={detailStyles.headerCell}>Price</Text>
                </View>

                {products.length > 0 ? (
                    products.map((product, index) => (
                        <View key={`${orderId}-${product.product_id}-${index}`} style={detailStyles.productRow}>
                            <Text style={[detailStyles.productCell, { flex: 2 }]}>{product.name}</Text>
                            <Text style={detailStyles.productCell}>{product.quantity}</Text>
                            <Text style={detailStyles.productCell}>₹{product.price}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={detailStyles.noProductsText}>No products found.</Text>
                )}
            </View>
        );
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'approved': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'rejected': return '#F44336';
            case 'delivered': return '#2196F3';
            case 'cancelled': return '#9E9E9E';
            default: return '#003366';
        }
    };

    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem('orderReportDirectoryUri');

                if (!directoryUriToUse) {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        directoryUriToUse = permissions.directoryUri;
                        await AsyncStorage.setItem('orderReportDirectoryUri', directoryUriToUse);
                    } else {
                        shareAsync(uri, reportType);
                        return;
                    }
                }

                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    directoryUriToUse,
                    filename,
                    mimetype
                );
                await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });

                ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
            } catch (error) {
                console.error("Error saving file:", error);
                if (error.message.includes('permission')) {
                    await AsyncStorage.removeItem('orderReportDirectoryUri');
                }
                ToastAndroid.show(`Failed to save ${reportType}. Please try again.`, ToastAndroid.SHORT);
            }
        } else {
            shareAsync(uri, reportType);
        }
    };

    const generateOrderExcelReport = async () => {
        const reportType = 'Order Report';
        setLoading(true);
        try {
            if (!orders || orders.length === 0) {
                Alert.alert("No Orders", "No orders to include in the report for the selected date.");
                return;
            }

            const wb = XLSX.utils.book_new();
            const wsData = [
                [`${reportType} - Date: ${moment(selectedDate).format('YYYY-MM-DD')}`],
                [],
                ["Customer ID", "Total Amount", "Order Type", "Placed On", "Cancelled","Approve Status", "Delivery Status"],
                ...orders.map(order => [
                    order.customer_id,
                    order.amount,
                    order.order_type,
                    moment.unix(parseInt(order.placed_on, 10)).format('YYYY-MM-DD HH:mm:ss'),
                    order.cancelled,
                    order.approve_status,
                    order.delivery_status,
                ])
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, `${reportType} Data`);

            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const base64Workbook = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const filename = `${reportType.replace(/\s/g, '')}-${moment(selectedDate).format('YYYY-MM-DD')}.xlsx`;
            const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            if (Platform.OS === 'web') {
                const blob = new Blob([wbout], { type: mimetype });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                Alert.alert('Success', `${reportType} Generated Successfully!`);
            } else {
                const fileDir = FileSystem.documentDirectory;
                const fileUri = fileDir + filename;

                await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
                    encoding: FileSystem.EncodingType.Base64
                });
                if (Platform.OS === 'android') {
                    save(fileUri, filename, mimetype, reportType);
                } else {
                    try {
                        await Sharing.shareAsync(fileUri, {
                            mimeType: mimetype,
                            dialogTitle: `${reportType} Report`,
                            UTI: 'com.microsoft.excel.xlsx'
                        });
                    } catch (shareError) {
                        console.error("Sharing Error:", shareError);
                        Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
                    }
                }
            }

        } catch (e) {
            console.error("Excel Generation Error:", e);
            Alert.alert("Generation Failed", `Error generating Excel ${reportType.toLowerCase()}.`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003366" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Admin Order History</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={styles.dateFilterButton} 
                        onPress={showDatePicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={18} color="#fff" />
                        <Text style={styles.dateFilterText}>
                            {moment(selectedDate).format('MMM D, YYYY')}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.reportButton}
                        onPress={generateOrderExcelReport}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="document-text-outline" size={18} color="#fff" />
                        <Text style={styles.reportButtonText}>Report</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                date={selectedDate}
            />

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
                        <Text style={styles.emptyStateText}>No orders found for selected date</Text>
                    </View>
                ) : (
                    orders.map((order) => (
                        <View key={order.id} style={styles.orderCard}>
                            <View style={styles.orderHeader}>
                                <View>
                                    <Text style={styles.orderId}>Order #{order.id}</Text>
                                    <Text style={styles.orderCustomer}>Customer ID: {order.customer_id}</Text>
                                    <Text style={styles.orderDate}>
                                        {moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}
                                    </Text>
                                </View>
                                <Text style={[styles.orderStatus, { backgroundColor: getStatusColor(order.approve_status) }]}>
                                    {(order.approve_status || 'pending').toUpperCase()}
                                </Text>
                            </View>

                            <View style={styles.orderSummary}>
                                <Text style={styles.orderTotal}>₹{order.amount}</Text>
                                <Text style={styles.orderType}>{order.order_type}</Text>
                            </View>

                            <View style={styles.orderFooter}>
                                <Text style={styles.deliveryStatus}>
                                    Delivery: <Text style={{ color: getStatusColor(order.delivery_status) }}>
                                        {(order.delivery_status || 'pending').toUpperCase()}
                                    </Text>
                                </Text>
                                <TouchableOpacity 
                                    onPress={() => handleOrderDetailsPress(order.id)}
                                    style={styles.detailsButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.detailsButtonText}>
                                        {expandedOrderDetailsId === order.id ? 'HIDE DETAILS' : 'VIEW DETAILS'}
                                    </Text>
                                    <Ionicons 
                                        name={expandedOrderDetailsId === order.id ? "chevron-up" : "chevron-down"} 
                                        size={16} 
                                        color="#003366" 
                                    />
                                </TouchableOpacity>
                            </View>

                            {renderOrderDetails(order.id)}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        backgroundColor: '#003366',
        padding: 20,
        paddingBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 15,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    dateFilterText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 14,
    },
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4CAF50',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    reportButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#f5f7fa',
    },
    scrollContainer: {
        padding: 15,
        paddingBottom: 25,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyStateText: {
        marginTop: 15,
        fontSize: 16,
        color: '#003366',
        opacity: 0.7,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
    },
    orderCustomer: {
        fontSize: 13,
        color: '#666',
        marginTop: 3,
    },
    orderDate: {
        fontSize: 12,
        color: '#666',
        marginTop: 3,
    },
    orderStatus: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        alignSelf: 'flex-start',
    },
    orderSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        paddingBottom: 10,
    },
    orderTotal: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
    },
    orderType: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        paddingTop: 0,
    },
    deliveryStatus: {
        fontSize: 13,
        color: '#666',
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#003366',
        fontWeight: '600',
        marginRight: 5,
        fontSize: 14,
    },
});

const detailStyles = StyleSheet.create({
    orderDetailsContainer: {
        backgroundColor: '#f9fafc',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    orderDetailsTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#003366',
        marginBottom: 15,
    },
    headerRow: {
        flexDirection: 'row',
        paddingBottom: 8,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerCell: {
        fontSize: 13,
        fontWeight: '600',
        color: '#003366',
        flex: 1,
    },
    productRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    productCell: {
        fontSize: 13,
        color: '#555',
        flex: 1,
    },
    noProductsText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        marginTop: 10,
    }
});

export default AdminOrderHistory;