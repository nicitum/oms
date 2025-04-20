import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    ScrollView,
} from "react-native";
import { Checkbox, Card, Button } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from "../../urls";
import { useNavigation } from "@react-navigation/native";
import moment from 'moment';
import Toast from "react-native-toast-message";
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const AdminAssignedUsersPage = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adminId, setAdminId] = useState(null);
    const navigation = useNavigation();
    const [selectedOrderIds, setSelectedOrderIds] = useState({});
    const [selectAllOrders, setSelectAllOrders] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            const fetchInitialData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const userAuthToken = await AsyncStorage.getItem("userAuthToken");
                    if (!userAuthToken) {
                        setError("User authentication token not found.");
                        return;
                    }

                    const decodedToken = jwtDecode(userAuthToken);
                    const currentAdminId = decodedToken.id1;
                    setAdminId(currentAdminId);

                    await Promise.all([
                        fetchAssignedUsers(currentAdminId, userAuthToken),
                        fetchAdminOrders(currentAdminId, userAuthToken)
                    ]);

                    setSelectedOrderIds({});
                    setSelectAllOrders(false);

                } catch (err) {
                    console.error("Error initializing data:", err);
                    setError("Error loading data. Please try again.");
                    Toast.show({
                        type: 'error',
                        text1: 'Data Loading Error',
                        text2: 'Error loading data. Please try again.'
                    });
                } finally {
                    setLoading(false);
                }
            };

            fetchInitialData();

            return () => {
                setAdminOrders([]);
                setAssignedUsers([]);
            };
        }, [])
    );

    useEffect(() => {
        if (selectAllOrders) {
            let allOrderIds = {};
            adminOrders.forEach(order => allOrderIds[order.id] = true);
            setSelectedOrderIds(allOrderIds);
        } else {
            setSelectedOrderIds({});
        }
    }, [selectAllOrders, adminOrders]);

    const fetchAssignedUsers = async (currentAdminId, userAuthToken) => {
        try {
            const response = await fetch(`http://${ipAddress}:8090/assigned-users/${currentAdminId}`, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch assigned users. Status: ${response.status}`);
            }

            const responseData = await response.json();
            if (responseData.success) {
                setAssignedUsers(responseData.assignedUsers);
            } else {
                setError(responseData.message || "Failed to fetch assigned users.");
            }
        } catch (err) {
            console.error("Error fetching assigned users:", err);
            setError("Error fetching assigned users. Please try again.");
        }
    };

    const fetchAdminOrders = async (currentAdminId, userAuthToken) => {
        const today = moment().format('YYYY-MM-DD');
        const apiUrl = `http://${ipAddress}:8090/get-admin-orders/${currentAdminId}?date=${today}`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch admin orders. Status: ${response.status}`);
            }

            const responseData = await response.json();
            if (responseData.success) {
                setAdminOrders(responseData.orders);
            } else {
                setError(responseData.message || "Failed to fetch admin orders.");
            }
        } catch (err) {
            console.error("Error fetching admin orders:", err);
            setError("Error fetching admin orders. Please try again.");
        }
    };

    const updateOrderStatusInState = (orderId, status) => {
        const updatedOrders = adminOrders.map(order => {
            if (order.id === orderId) {
                return { ...order, approve_status: status };
            }
            return order;
        });
        setAdminOrders(updatedOrders);
    };

    const handleCheckboxChange = (orderId, isSelected) => {
        setSelectedOrderIds(prevSelectedOrderIds => {
            const updatedSelectedOrderIds = { ...prevSelectedOrderIds };
            if (isSelected) {
                updatedSelectedOrderIds[orderId] = true;
            } else {
                delete updatedSelectedOrderIds[orderId];
            }
            return updatedSelectedOrderIds;
        });
    };

    const handleBulkApprove = async () => {
        const orderIdsToApprove = Object.keys(selectedOrderIds);
        if (orderIdsToApprove.length === 0) {
            Alert.alert("No Orders Selected", "Please select orders to approve.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");
            
            for (const orderId of orderIdsToApprove) {
                const response = await fetch(`http://${ipAddress}:8090/update-order-status`, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${userAuthToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: parseInt(orderId), approve_status: 'Accepted' })
                });

                if (!response.ok) {
                    console.error(`HTTP Error approving order ID ${orderId}. Status: ${response.status}`);
                    continue;
                }
                const responseData = await response.json();
                if (responseData.success) {
                    updateOrderStatusInState(parseInt(orderId), 'Accepted');
                }
            }

            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Selected orders approved successfully'
            });

            setSelectedOrderIds({});
            setSelectAllOrders(false);

            await fetchAdminOrders(adminId, userAuthToken);
        } catch (err) {
            console.error("Error bulk approving orders:", err);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to approve selected orders. Please try again.'
            });
            setError("Failed to approve selected orders. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderUserOrderItem = ({ item }) => {
        const today = moment();
        const userOrdersToday = adminOrders.filter(order => 
            order.customer_id === item.cust_id && 
            moment.unix(order.placed_on).isSame(today, 'day')
        );
        const userAMOrdersToday = userOrdersToday.filter(order => order.order_type === 'AM');
        const userPMOrdersToday = userOrdersToday.filter(order => order.order_type === 'PM');

        return (
            <Card style={styles.userCard} key={item.cust_id}>
                <Card.Content>
                    <View style={styles.userHeader}>
                        <Icon name="account-circle" size={24} color="#003366" />
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <View style={styles.userMeta}>
                                <Icon name="map-marker" size={14} color="#666" />
                                <Text style={styles.userRoute}>{item.route}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.ordersContainer}>
                        <View style={styles.orderTypeSection}>
                            <View style={styles.orderTypeHeader}>
                                <Icon name="weather-sunny" size={18} color="#FFA500" />
                                <Text style={styles.orderTypeTitle}>AM Orders</Text>
                            </View>
                            {userAMOrdersToday.length > 0 ? (
                                userAMOrdersToday.map(order => (
                                    <Card key={order.id} style={styles.orderCard}>
                                        <Card.Content>
                                            <View style={styles.orderRow}>
                                                <Checkbox
                                                    status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                                    onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                                    color="#003366"
                                                />
                                                <View style={styles.orderDetails}>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Order ID:</Text>
                                                        <Text style={styles.orderValue}>{order.id}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Date:</Text>
                                                        <Text style={styles.orderValue}>{moment.unix(order.placed_on).format('DD MMM, YYYY')}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Amount:</Text>
                                                        <Text style={styles.orderValue}>₹{order.amount || 'N/A'}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.orderStatus}>
                                                    {order.altered === 'Yes' ? (
                                                        <Text style={styles.alteredStatus}>Altered</Text>
                                                    ) : (
                                                        <Text style={order.approve_status === 'Accepted' ? styles.acceptedStatus : styles.pendingStatus}>
                                                            {order.approve_status === 'Accepted' ? 'Accepted' : 'Pending'}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        </Card.Content>
                                    </Card>
                                ))
                            ) : (
                                <Card style={styles.noOrdersCard}>
                                    <Card.Content>
                                        <Text style={styles.noOrdersText}>No AM orders for today</Text>
                                    </Card.Content>
                                </Card>
                            )}
                        </View>

                        <View style={styles.orderTypeSection}>
                            <View style={styles.orderTypeHeader}>
                                <Icon name="weather-night" size={18} color="#003366" />
                                <Text style={styles.orderTypeTitle}>PM Orders</Text>
                            </View>
                            {userPMOrdersToday.length > 0 ? (
                                userPMOrdersToday.map(order => (
                                    <Card key={order.id} style={styles.orderCard}>
                                        <Card.Content>
                                            <View style={styles.orderRow}>
                                                <Checkbox
                                                    status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                                    onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                                    color="#003366"
                                                />
                                                <View style={styles.orderDetails}>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Order ID:</Text>
                                                        <Text style={styles.orderValue}>{order.id}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Date:</Text>
                                                        <Text style={styles.orderValue}>{moment.unix(order.placed_on).format('DD MMM, YYYY')}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Amount:</Text>
                                                        <Text style={styles.orderValue}>₹{order.amount || 'N/A'}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.orderStatus}>
                                                    {order.altered === 'Yes' ? (
                                                        <Text style={styles.alteredStatus}>Altered</Text>
                                                    ) : (
                                                        <Text style={order.approve_status === 'Accepted' ? styles.acceptedStatus : styles.pendingStatus}>
                                                            {order.approve_status === 'Accepted' ? 'Accepted' : 'Pending'}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        </Card.Content>
                                    </Card>
                                ))
                            ) : (
                                <Card style={styles.noOrdersCard}>
                                    <Card.Content>
                                        <Text style={styles.noOrdersText}>No PM orders for today</Text>
                                    </Card.Content>
                                </Card>
                            )}
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    const renderContent = () => {
        return (
            <View style={styles.contentContainer}>
                <Card style={styles.bulkActionsCard}>
                    <Card.Content>
                        <View style={styles.bulkActionsContainer}>
                            <View style={styles.selectAllContainer}>
                                <Checkbox
                                    status={selectAllOrders ? 'checked' : 'unchecked'}
                                    onPress={() => setSelectAllOrders(!selectAllOrders)}
                                    color="#003366"
                                />
                                <Text style={styles.selectAllText}>Select All Orders</Text>
                            </View>
                            <Button
                                mode="contained"
                                onPress={handleBulkApprove}
                                style={styles.bulkApproveButton}
                                labelStyle={styles.bulkApproveButtonLabel}
                                disabled={Object.keys(selectedOrderIds).length === 0}
                                icon="check-circle"
                            >
                                Approve Selected
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                <ScrollView style={styles.usersScrollView}>
                    {assignedUsers.length > 0 ? (
                        assignedUsers.map(user => renderUserOrderItem({ item: user }))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Icon name="account-question" size={40} color="#003366" />
                                <Text style={styles.emptyText}>No users assigned to you</Text>
                                <Text style={styles.emptySubtext}>Contact support if this is unexpected</Text>
                            </Card.Content>
                        </Card>
                    )}
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Icon name="account-group" size={28} color="#fff" />
                    <Text style={styles.headerTitle}>Order Approvals</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#003366" />
                    <Text style={styles.loadingText}>Loading user data...</Text>
                </View>
            ) : error ? (
                <Card style={styles.errorCard}>
                    <Card.Content>
                        <View style={styles.errorContent}>
                            <Icon name="alert-circle" size={24} color="#dc3545" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    </Card.Content>
                </Card>
            ) : (
                renderContent()
            )}
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
        padding: 16,
        paddingTop: 40,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 10,
    },
    contentContainer: {
        flex: 1,
        padding: 16,
    },
    bulkActionsCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 16,
        elevation: 2,
    },
    bulkActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectAllText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#003366',
        fontWeight: '500',
    },
    bulkApproveButton: {
        backgroundColor: '#003366',
        borderRadius: 8,
    },
    bulkApproveButtonLabel: {
        color: '#fff',
        fontWeight: '500',
    },
    usersScrollView: {
        flex: 1,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 16,
        elevation: 2,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#003366',
    },
    userMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    userRoute: {
        fontSize: 14,
        color: '#666',
        marginLeft: 4,
    },
    ordersContainer: {
        marginTop: 8,
    },
    orderTypeSection: {
        marginBottom: 16,
    },
    orderTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderTypeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
        marginLeft: 8,
    },
    orderCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 8,
    },
    noOrdersCard: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderDetails: {
        flex: 1,
        marginLeft: 8,
    },
    orderMeta: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    orderLabel: {
        fontSize: 14,
        color: '#666',
        width: 70,
    },
    orderValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    orderStatus: {
        marginLeft: 8,
    },
    pendingStatus: {
        color: '#FFA500',
        fontWeight: 'bold',
    },
    acceptedStatus: {
        color: '#28a745',
        fontWeight: 'bold',
    },
    alteredStatus: {
        color: '#007bff',
        fontWeight: 'bold',
    },
    noOrdersText: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#003366',
    },
    errorCard: {
        backgroundColor: '#fde8e8',
        margin: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#dc3545',
    },
    errorContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: '#dc3545',
        marginLeft: 8,
        fontSize: 16,
    },
    emptyCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        elevation: 2,
    },
    emptyContent: {
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#003366',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
});

export default AdminAssignedUsersPage;