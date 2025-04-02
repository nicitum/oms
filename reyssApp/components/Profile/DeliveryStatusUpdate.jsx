import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { ipAddress } from "../../urls"; // Ensure this points to your live server URL
import { jwtDecode } from "jwt-decode";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from 'react-native-toast-message';

const OrderItem = React.memo(({ item, onStatusUpdate, loading, remarksSavedStatuses }) => {
    const [localStatus, setLocalStatus] = useState(item.delivery_status || 'pending');
    const isDelivered = localStatus === 'delivered';
    const [showRemarksInput, setShowRemarksInput] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [remarksSaved, setRemarksSaved] = useState(remarksSavedStatuses ? remarksSavedStatuses[item.id] : false);

    useEffect(() => {
        setShowRemarksInput(localStatus === 'delivered' && !remarksSaved);
    }, [localStatus, remarksSaved]);

    const handleStatusChange = async (newStatus) => {
        if (isDelivered) return;

        try {
            await onStatusUpdate(item.id, newStatus);
            setLocalStatus(newStatus);
            if (newStatus === 'delivered') {
                setShowRemarksInput(true);
            } else {
                setShowRemarksInput(false);
            }
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Update Failed',
                text2: error.message
            });
        }
    };

    const handleRemarksChange = (text) => {
        setRemarks(text);
    };

    const handleSaveRemarks = async () => {
        let customerId = null;
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            console.log("Token for remarks:", token);
            if (!token) throw new Error("Authentication required");
            const decoded = jwtDecode(token);
            customerId = decoded.id;
            console.log("Customer ID for remarks:", customerId);
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Authentication Error',
                text2: 'Could not retrieve customer ID: ' + error.message
            });
            return;
        }

        const orderId = item.id;

        if (!remarks.trim()) {
            Toast.show({
                type: 'warn',
                text1: 'Warning',
                text2: 'Remarks cannot be empty.'
            });
            return;
        }

        try {
            const response = await axios.post(`http://${ipAddress}:8090/remarks-update`, {
                customer_id: customerId,
                order_id: orderId,
                remarks: remarks
            });

            if (response.status >= 200 && response.status < 300) {
                Toast.show({
                    type: 'success',
                    text1: 'Remarks Saved',
                    text2: response.data.message || 'Remarks saved successfully.'
                });
                setRemarks('');
                setShowRemarksInput(false);
                setRemarksSaved(true);
                await AsyncStorage.setItem(`remarksSaved_${item.id}`, 'true');
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error Saving Remarks',
                    text2: response.data.message || 'Failed to save remarks.'
                });
            }
        } catch (error) {
            console.error("Error saving remarks:", error);
            Toast.show({
                type: 'error',
                text1: 'Error Saving Remarks',
                text2: 'Failed to save remarks: ' + error.message
            });
        }
    };

    return (
        <View style={[styles.orderCard, isDelivered && styles.deliveredCard]}>
            <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>Order #{item.id}</Text>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: isDelivered ? '#4CAF50' : '#FFA000' }
                ]}>
                    <Text style={styles.statusText}>
                        {isDelivered ? 'Delivered' : 'Pending'}
                    </Text>
                </View>
            </View>

            <View style={styles.orderDetails}>
                <Text style={styles.detailText}>
                    Date: {new Date(item.placed_on * 1000).toLocaleDateString()}
                </Text>
                <Text style={styles.detailText}>
                    Amount: ₹{item.total_amount || 0}
                </Text>
            </View>

            {!isDelivered && (
                <View style={styles.actionContainer}>
                    <Picker
                        enabled={!isDelivered && !loading}
                        selectedValue={localStatus}
                        style={[styles.picker, isDelivered && styles.disabledPicker]}
                        onValueChange={handleStatusChange}
                    >
                        <Picker.Item label="Pending" value="pending" />
                        <Picker.Item label="Delivered" value="delivered" />
                    </Picker>
                </View>
            )}

            {showRemarksInput && (
                <View style={styles.remarksContainer}>
                    <Text style={styles.remarksLabel}>Remarks:</Text>
                    <TextInput
                        style={styles.remarksInput}
                        placeholder="Enter remarks here..."
                        multiline
                        numberOfLines={2}
                        value={remarks}
                        onChangeText={handleRemarksChange}
                        textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.saveRemarksButton} onPress={handleSaveRemarks}>
                        <Text style={styles.saveRemarksButtonText}>Save Remarks</Text>
                    </TouchableOpacity>
                </View>
            )}
            {isDelivered && remarksSaved && (
                <Text style={{ marginTop: 10, fontStyle: 'italic', color: 'gray' }}>Remarks saved.</Text>
            )}
        </View>
    );
});

const DeliveryStatusUpdate = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customerId, setCustomerId] = useState(null);
    const [remarksSavedStatuses, setRemarksSavedStatuses] = useState({});

    useEffect(() => {
        const initializeData = async () => {
            console.log("Starting initializeData in useEffect...");
            try {
                // Step 1: Fetch token and decode customerId
                const token = await AsyncStorage.getItem("userAuthToken");
                console.log("Token from AsyncStorage:", token);

                if (!token) {
                    console.log("No token available");
                    throw new Error("No authentication token found - please log in");
                }

                let decoded;
                try {
                    decoded = jwtDecode(token);
                    console.log("Decoded JWT:", decoded);
                } catch (decodeError) {
                    console.error("JWT Decode Error:", decodeError.message);
                    throw new Error("Failed to decode token");
                }

                const customerId = decoded.id;
                if (!customerId) {
                    console.log("No customerId in token");
                    throw new Error("Customer ID not found in token");
                }

                console.log("Customer ID extracted:", customerId);
                setCustomerId(customerId);

                // Step 2: Fetch orders and remarks with customerId
                try {
                    console.log("Fetching orders for customerId:", customerId);
                    const response = await axios.get(`http://${ipAddress}:8090/get-orders/${customerId}`);
                    console.log("API Response:", response.data);

                    if (!response.data.status) {
                        throw new Error(response.data.message || "API returned failure status");
                    }

                    const fetchedOrders = response.data.orders || [];
                    console.log("Fetched Orders:", fetchedOrders);
                    setOrders(fetchedOrders);

                    const orderIds = fetchedOrders.map(order => order.id);
                    console.log("Order IDs:", orderIds);
                    const savedStatuses = await loadAllRemarksSaved(orderIds);
                    console.log("Remarks Saved Statuses:", savedStatuses);
                    setRemarksSavedStatuses(savedStatuses);
                } catch (fetchError) {
                    console.error("Fetch Error:", fetchError.message);
                    throw new Error("Failed to fetch orders: " + fetchError.message);
                }
            } catch (error) {
                console.error("Initialize Error:", error.message);
                setError(error.message);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: `Failed to load data: ${error.message}`
                });
            } finally {
                console.log("Setting loading to false");
                setLoading(false);
            }
        };

        initializeData();
    }, []); // Empty dependency array ensures it runs once on mount

    const loadAllRemarksSaved = async (orderIds) => {
        const statuses = {};
        try {
            await Promise.all(orderIds.map(async (orderId) => {
                const savedStatus = await AsyncStorage.getItem(`remarksSaved_${orderId}`);
                statuses[orderId] = savedStatus === 'true';
            }));
        } catch (error) {
            console.error("Error loading remarks saved statuses:", error);
        }
        return statuses;
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        setLoading(true);
        try {
            const response = await axios.post(
                `http://${ipAddress}:8090/update-delivery-status`,
                {
                    customer_id: customerId,
                    order_id: orderId,
                    delivery_status: newStatus
                }
            );

            if (response.data.status) {
                setOrders(prevOrders =>
                    prevOrders.map(order =>
                        order.id === orderId
                            ? { ...order, delivery_status: newStatus }
                            : order
                    )
                );
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Status updated successfully'
                });
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error("Status Update Error:", error.message);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to update status: ' + error.message
            });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.headerText}>Delivery Status</Text>
                {error ? (
                    <Text style={styles.emptyText}>{error}</Text>
                ) : orders.length > 0 ? (
                    orders.map((item) => (
                        <OrderItem
                            key={item.id.toString()}
                            item={item}
                            onStatusUpdate={handleStatusUpdate}
                            loading={loading}
                            remarksSavedStatuses={remarksSavedStatuses}
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>No orders found</Text>
                )}
                <Toast />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        paddingVertical: 12,
    },
    container: {
        flexGrow: 1,
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333'
    },
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        minHeight: 100,
    },
    deliveredCard: {
        backgroundColor: '#F8FFF8',
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50'
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    orderTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333'
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600'
    },
    orderDetails: {
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E0E0E0'
    },
    detailText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 2
    },
    actionContainer: {
        marginTop: 2
    },
    picker: {
        backgroundColor: '#F5F5F5',
        borderRadius: 6,
        width: '100%',
        height: 50
    },
    disabledPicker: {
        opacity: 0.7,
        backgroundColor: '#E0E0E0'
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#666',
        marginTop: 20
    },
    remarksContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 0.5,
        borderTopColor: '#E0E0E0'
    },
    remarksLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4
    },
    remarksInput: {
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#BDBDBD',
        padding: 8,
        minHeight: 40,
        textAlignVertical: 'top',
        marginBottom: 8
    },
    saveRemarksButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignSelf: 'flex-start'
    },
    saveRemarksButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13
    }
});

export default DeliveryStatusUpdate;