import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    StatusBar,
    Dimensions
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { ipAddress } from "../../urls";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from 'react-native-toast-message';
import { MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get('window');

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
            if (!token) throw new Error("Authentication required");
            const decoded = jwtDecode(token);
            customerId = decoded.id;
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Authentication Error',
                text2: 'Could not retrieve customer ID: ' + error.message
            });
            return;
        }

        if (!remarks.trim()) {
            Toast.show({
                type: 'warn',
                text1: 'Warning',
                text2: 'Remarks cannot be empty.'
            });
            return;
        }

        try {
            const response = await axios.post(`http://${ipAddress}:8091/remarks-update`, {
                customer_id: customerId,
                order_id: item.id,
                remarks: remarks
            });

            if (response.status >= 200 && response.status < 300) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Remarks saved successfully'
                });
                setRemarks('');
                setShowRemarksInput(false);
                setRemarksSaved(true);
                await AsyncStorage.setItem(`remarksSaved_${item.id}`, 'true');
            } else {
                throw new Error(response.data.message || 'Failed to save remarks');
            }
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to save remarks: ' + error.message
            });
        }
    };

    const getStatusInfo = (status) => {
        const statusConfig = {
            pending: {
                icon: 'schedule',
                color: '#FF9800',
                bgColor: '#FFF3E0',
                label: 'Pending'
            },
            delivered: {
                icon: 'check-circle',
                color: '#4CAF50',
                bgColor: '#E8F5E9',
                label: 'Delivered'
            }
        };
        return statusConfig[status] || statusConfig.pending;
    };

    const statusInfo = getStatusInfo(localStatus);

    return (
        <View style={[styles.orderCard, isDelivered && styles.deliveredCard]}>
            <View style={styles.orderHeader}>
                <View style={styles.orderTitleContainer}>
                    <MaterialIcons name="shopping-bag" size={20} color="#003366" />
                    <Text style={styles.orderTitle}>Order #{item.id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                    <MaterialIcons name={statusInfo.icon} size={16} color={statusInfo.color} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                    </Text>
                </View>
            </View>

            <View style={styles.orderDetails}>
                <View style={styles.detailRow}>
                    <MaterialIcons name="event" size={16} color="#666666" />
                    <Text style={styles.detailText}>
                        {new Date(item.placed_on * 1000).toLocaleDateString()}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <MaterialIcons name="payment" size={16} color="#666666" />
                    <Text style={styles.detailText}>₹{item.total_amount || 0}</Text>
                </View>
            </View>

            {!isDelivered && (
                <View style={styles.actionContainer}>
                    <View style={styles.pickerContainer}>
                        <Picker
                            enabled={!isDelivered && !loading}
                            selectedValue={localStatus}
                            style={styles.picker}
                            onValueChange={handleStatusChange}
                        >
                            <Picker.Item label="Pending" value="pending" color="#003366" />
                            <Picker.Item label="Delivered" value="delivered" color="#003366" />
                        </Picker>
                    </View>
                </View>
            )}

            {showRemarksInput && (
                <View style={styles.remarksContainer}>
                    <Text style={styles.remarksLabel}>Delivery Remarks</Text>
                    <TextInput
                        style={styles.remarksInput}
                        placeholder="Add delivery remarks here..."
                        placeholderTextColor="#999999"
                        multiline
                        numberOfLines={2}
                        value={remarks}
                        onChangeText={handleRemarksChange}
                        textAlignVertical="top"
                    />
                    <TouchableOpacity 
                        style={styles.saveRemarksButton} 
                        onPress={handleSaveRemarks}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="check" size={20} color="#FFFFFF" />
                        <Text style={styles.saveRemarksButtonText}>Save Remarks</Text>
                    </TouchableOpacity>
                </View>
            )}
            
            {isDelivered && remarksSaved && (
                <View style={styles.remarksSavedContainer}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.remarksSavedText}>Remarks saved</Text>
                </View>
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
            try {
                const token = await AsyncStorage.getItem("userAuthToken");
                if (!token) throw new Error("Authentication required");

                const decoded = jwtDecode(token);
                const customerId = decoded.id;
                if (!customerId) throw new Error("Customer ID not found");

                setCustomerId(customerId);

                const response = await axios.get(`http://${ipAddress}:8091/get-orders/${customerId}`);
                if (!response.data.status) {
                    throw new Error(response.data.message || "Failed to fetch orders");
                }

                const fetchedOrders = response.data.orders || [];
                setOrders(fetchedOrders);

                const orderIds = fetchedOrders.map(order => order.id);
                const savedStatuses = await loadAllRemarksSaved(orderIds);
                setRemarksSavedStatuses(savedStatuses);
            } catch (error) {
                setError(error.message);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: error.message
                });
            } finally {
                setLoading(false);
            }
        };

        initializeData();
    }, []);

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
                `http://${ipAddress}:8091/update-delivery-status`,
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003366" />
                <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#003366" barStyle="light-content" />
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Delivery Status</Text>
                <Text style={styles.headerSubtitle}>Update order delivery status</Text>
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {error ? (
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={48} color="#F44336" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
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
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="inbox" size={64} color="#003366" />
                        <Text style={styles.emptyTitle}>No Orders Found</Text>
                        <Text style={styles.emptySubtitle}>There are no orders to update at this time</Text>
                    </View>
                )}
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F7FA",
    },
    header: {
        backgroundColor: "#003366",
        padding: 16,
        paddingTop: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "600",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F7FA",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#666666",
    },
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        overflow: "hidden",
    },
    deliveredCard: {
        borderLeftWidth: 4,
        borderLeftColor: "#4CAF50",
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    orderTitleContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    orderTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#003366",
        marginLeft: 8,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600",
        marginLeft: 4,
    },
    orderDetails: {
        padding: 16,
        backgroundColor: "#FAFAFA",
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    detailText: {
        fontSize: 14,
        color: "#666666",
        marginLeft: 8,
    },
    actionContainer: {
        padding: 16,
    },
    pickerContainer: {
        backgroundColor: "#F5F7FA",
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        height: 48,
    },
    remarksContainer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#F0F0F0",
    },
    remarksLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#003366",
        marginBottom: 8,
    },
    remarksInput: {
        backgroundColor: "#F5F7FA",
        borderRadius: 8,
        padding: 12,
        minHeight: 80,
        fontSize: 14,
        color: "#333333",
        marginBottom: 12,
    },
    saveRemarksButton: {
        backgroundColor: "#003366",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderRadius: 8,
    },
    saveRemarksButtonText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
        marginLeft: 8,
    },
    remarksSavedContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        backgroundColor: "#F5F7FA",
    },
    remarksSavedText: {
        fontSize: 14,
        color: "#4CAF50",
        marginLeft: 8,
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: "#F44336",
        textAlign: "center",
        marginTop: 16,
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#003366",
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#666666",
        textAlign: "center",
        marginTop: 8,
    },
});

export default DeliveryStatusUpdate;