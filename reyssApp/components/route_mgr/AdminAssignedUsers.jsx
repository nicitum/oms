import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    ScrollView, // Changed FlatList to ScrollView for user items
} from "react-native";

import { Checkbox } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from "../../urls";

import { useNavigation } from "@react-navigation/native";
import moment from 'moment';
import Toast from "react-native-toast-message";
import { useFocusEffect } from '@react-navigation/native';

const AdminAssignedUsersPage = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [amAdminOrders, setAmAdminOrders] = useState([]);
    const [pmAdminOrders, setPmAdminOrders] = useState([]);
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

                    // Fetch all data in parallel
                    await Promise.all([
                        fetchAssignedUsers(currentAdminId, userAuthToken),
                        fetchAMAdminOrders(currentAdminId, userAuthToken),
                        fetchPMAdminOrders(currentAdminId, userAuthToken)
                    ]);

                    // Clear selected orders when refreshing
                    setSelectedOrderIds({});
                    setSelectAllOrders(false);

                } catch (err) {
                    console.error("Error initializing data:", err);
                    setError("Error loading data. Please try again.");
                } finally {
                    setLoading(false);
                }
            };

            fetchInitialData();

            // Optional: Return a cleanup function
            return () => {
                // Clean up any subscriptions or pending requests here
                setAmAdminOrders([]);
                setPmAdminOrders([]);
                setAssignedUsers([]);
            };
        }, []) // Empty dependency array since we want to run this every time the screen focuses
    );

    useEffect(() => {
        if (selectAllOrders) {
            let allOrderIds = {};
            // Include all AM orders regardless of status
            amAdminOrders.forEach(order => allOrderIds[order.id] = true);
            // Include all PM orders regardless of status
            pmAdminOrders.forEach(order => allOrderIds[order.id] = true);
            setSelectedOrderIds(allOrderIds);
        } else {
            setSelectedOrderIds({});
        }
    }, [selectAllOrders, amAdminOrders, pmAdminOrders]);


    const fetchAssignedUsers = async (currentAdminId, userAuthToken) => {
        try {
            const response = await fetch(`http://${ipAddress}:8090/assigned-users/${currentAdminId}`, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch assigned users. Status: ${response.status}`;
                throw new Error(message);
            }

            const responseData = await response.json();
            console.log(responseData)
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

    const fetchAMAdminOrders = async (currentAdminId, userAuthToken) => {
        let apiUrl = `http://${ipAddress}:8090/get-admin-orders/${currentAdminId}`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch admin orders. Status: ${response.status}`;
                throw new Error(message);
            }

            const responseData = await response.json();
            console.log('orders', responseData)
            if (responseData.success) {
                filterAMOrdersByDate(responseData.orders);
            } else {
                setError(responseData.message || "Failed to fetch admin orders.");
            }
        } catch (err) {
            console.error("Error fetching AM admin orders:", err);
            setError("Error fetching AM admin orders. Please try again.");
        }
    };

    const fetchPMAdminOrders = async (currentAdminId, userAuthToken) => {
        let apiUrl = `http://${ipAddress}:8090/get-admin-orders/${currentAdminId}`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch admin orders. Status: ${response.status}`;
                throw new Error(message);
            }

            const responseData = await response.json();
            if (responseData.success) {
                filterPMOrdersByDate(responseData.orders);
            } else {
                setError(responseData.message || "Failed to fetch PM admin orders.");
            }
        } catch (err) {
            console.error("Error fetching PM admin orders:", err);
            setError("Error fetching PM admin orders. Please try again.");
        }
    };


    const filterAMOrdersByDate = (orders) => {
        const today = new Date();

        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = Math.floor(startOfToday.getTime() / 1000);

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        const endOfTodayTimestamp = Math.floor(endOfToday.getTime() / 1000);

        let filteredOrders = orders.filter(order => {
            const orderTimestamp = order.placed_on;
            return order.order_type === 'AM' && orderTimestamp >= startOfTodayTimestamp && orderTimestamp <= endOfTodayTimestamp; // **TODAY ONLY FILTER**
        });
        setAmAdminOrders(filteredOrders);
    };

    const filterPMOrdersByDate = (orders) => {
        const today = new Date();

        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = Math.floor(startOfToday.getTime() / 1000);

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        const endOfTodayTimestamp = Math.floor(endOfToday.getTime() / 1000);


        let filteredOrders = orders.filter(order => {
            const orderTimestamp = order.placed_on;
            return order.order_type === 'PM' && orderTimestamp >= startOfTodayTimestamp && orderTimestamp <= endOfTodayTimestamp; // **TODAY ONLY FILTER**
        });
        setPmAdminOrders(filteredOrders);
    };




    const updateOrderStatusInState = (orderId, status) => {
        console.log(`Updating order status in state for order ID: ${orderId} to status: ${status}`);

        const updatedAMOrders = amAdminOrders.map(order => {
            if (order.id === orderId) {
                console.log(`  AM Order ID ${orderId} status updated to: ${status}`);
                return { ...order, approve_status: status };
            }
            return order;
        });
        setAmAdminOrders(updatedAMOrders);

        const updatedPMOrders = pmAdminOrders.map(order => {
            if (order.id === orderId) {
                console.log(`  PM Order ID ${orderId} status updated to: ${status}`);
                return { ...order, approve_status: status };
            }
            return order;
        });
        setPmAdminOrders(updatedPMOrders);
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
            // **Corrected Bulk Approval Logic:** Iterate over all selectedOrderIds
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
                    const message = `HTTP Error approving order ID ${orderId}. Status: ${response.status}`;
                    console.error(message); // Log HTTP error
                    continue;
                }
                const responseData = await response.json();
                if (responseData.success) {
                    updateOrderStatusInState(parseInt(orderId), 'Accepted'); // Update UI for each approved order
                    console.log(`Bulk Approval: Order ID ${orderId} approval processed successfully.`); // ADDED LOGGING FOR BULK ACTIONS
                } else {
                    console.error(`Bulk Approval API Error for order ID ${orderId}: ${responseData.message}`);
                }
            }

            Alert.alert("Success", "Selected orders approved successfully");

            setSelectedOrderIds({});
            setSelectAllOrders(false);

            // **RE-FETCH ORDERS AFTER BULK APPROVAL**
            await Promise.all([  // Fetch both AM and PM orders in parallel
                fetchAMAdminOrders(adminId, userAuthToken),
                fetchPMAdminOrders(adminId, userAuthToken)
            ]);
            console.log("Re-fetched orders after bulk approval to update UI."); // Confirmation log
        } catch (err) {
            console.error("Error bulk approving orders:", err);
            Alert.alert("Error", "Failed to approve selected orders. Please try again.");
            setError("Failed to approve selected orders. Please try again.");
        } finally {
            setLoading(false);
        }
    };



    const renderUserOrderItem = ({ item }) => {
        const today = moment();

        const hasAMOrderToday = amAdminOrders.some(order => order.customer_id === item.cust_id && moment.unix(order.placed_on).isSame(today, 'day'));
        const hasPMOrderToday = pmAdminOrders.some(order => order.customer_id === item.cust_id && moment.unix(order.placed_on).isSame(today, 'day'));

        const userAMOrdersToday = amAdminOrders.filter(order => order.customer_id === item.cust_id && moment.unix(order.placed_on).isSame(today, 'day'));
        const userPMOrdersToday = pmAdminOrders.filter(order => order.customer_id === item.cust_id && moment.unix(order.placed_on).isSame(today, 'day'));

        return (
            <View style={styles.userOrderItemContainer}>
                <View style={styles.userInfoSection}>
                    <Text style={styles.userNameText}>{item.name}</Text>
                    <Text style={styles.userRouteText}><Text style={styles.boldText}>Route:</Text> {item.route}</Text>
                </View>

                <View style={styles.userOrdersSection}>
                    <Text style={styles.sectionHeaderText}>AM Orders:</Text>
                    {userAMOrdersToday.length > 0 ? (
                        userAMOrdersToday.map(order => (
                            <View key={order.id} style={styles.orderItem}>
                                <View style={styles.orderRow}>
                                    <Checkbox
                                        status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                        onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                        style={styles.orderCheckbox}
                                    />
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderIdText}><Text style={styles.boldText}>Order ID:</Text> {order.id}</Text>
                                        <Text style={styles.orderDateText}><Text style={styles.boldText}>Placed On:</Text> {moment(new Date(order.placed_on * 1000)).format('MMM DD, YYYY')}</Text>
                                        <Text style={styles.orderAmountText}><Text style={styles.boldText}>Amount:</Text> ₹{order.amount || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.orderStatusContainer}>
                                        <Text style={styles.orderStatusLabel}><Text style={styles.boldText}>Status: </Text>
                                            {order.altered === 'Yes' ? (
                                                <Text style={styles.orderAlteredText}>Altered</Text>
                                            ) : (
                                                <Text style={order.approve_status === 'Accepted' ? styles.orderAcceptedText : styles.orderPendingText}>
                                                    {order.approve_status === 'Accepted' ? 'Accepted' : 'PENDING'}
                                                </Text>
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noOrdersText}>No AM orders for today.</Text>
                    )}

                    <Text style={[styles.sectionHeaderText, styles.pmOrdersHeaderText]}>PM Orders:</Text>
                    {userPMOrdersToday.length > 0 ? (
                        userPMOrdersToday.map(order => (
                            <View key={order.id} style={styles.orderItem}>
                                <View style={styles.orderRow}>
                                    <Checkbox
                                        status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                        onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                        style={styles.orderCheckbox}
                                    />
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderIdText}><Text style={styles.boldText}>Order ID:</Text> {order.id}</Text>
                                        <Text style={styles.orderDateText}><Text style={styles.boldText}>Placed On:</Text> {moment(new Date(order.placed_on * 1000)).format('MMM DD, YYYY')}</Text>
                                        <Text style={styles.orderAmountText}><Text style={styles.boldText}>Amount:</Text> ₹{order.amount || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.orderStatusContainer}>
                                        <Text style={styles.orderStatusLabel}><Text style={styles.boldText}>Status: </Text>
                                            {order.altered === 'Yes' ? (
                                                <Text style={styles.orderAlteredText}>Altered</Text>
                                            ) : (
                                                <Text style={order.approve_status === 'Accepted' ? styles.orderAcceptedText : styles.orderPendingText}>
                                                    {order.approve_status === 'Accepted' ? 'Accepted' : 'PENDING'}
                                                </Text>
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noOrdersText}>No PM orders for today.</Text>
                    )}
                </View>
            </View>
        );
    };
    const renderContent = () => {
        const filteredUsers = assignedUsers;

        return (
            <View style={styles.tabContentContainer}>
                <View style={[styles.bulkActionsContainer, { justifyContent: 'flex-start' }]}>
                    <View style={styles.selectAllContainer}>
                        <Checkbox
                            status={selectAllOrders ? 'checked' : 'unchecked'} // Use 'status' prop to reflect selectAllOrders state
                            onPress={() => setSelectAllOrders(!selectAllOrders)} // Use 'onPress' to toggle selectAllOrders state
                            style={styles.selectAllCheckbox}
                        />
                        <Text style={styles.selectAllText}>Select All Orders</Text>
                    </View>

                    <TouchableOpacity style={styles.bulkActionButton} onPress={handleBulkApprove}>
                        <Text style={styles.bulkActionButtonText}>Accept Selected</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.usersScrollView}>
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map(user => renderUserOrderItem({ item: user }))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                No users assigned to this admin yet.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };


    return (
        <View style={styles.container}>
            
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ffcc00" />
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {renderContent()}
                </View>
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f4f4', // Light grey background
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: 'red',
        textAlign: 'center',
    },
    tabContentContainer: {
        flex: 1,
        paddingHorizontal: 15,
        paddingBottom: 15,
    },
    usersScrollView: {
        flex: 1,
    },
    userOrderItemContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    userInfoSection: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    userNameText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    userRouteText: {
        fontSize: 16,
        color: '#555',
    },
    userOrdersSection: {
        // Styles for orders section
    },
    sectionHeaderText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 10,
        marginBottom: 8,
    },
    pmOrdersHeaderText: {
        marginTop: 15,
    },
    orderItem: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderCheckbox: {
        marginRight: 10,
    },
    orderInfo: {
        flex: 1,
    },
    orderIdText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 3,
    },
    orderDateText: {
        fontSize: 14,
        color: '#777',
        marginBottom: 3,
    },
    orderAmountText: {
        fontSize: 14,
        color: '#777',
    },
    orderStatusContainer: {
        marginLeft: 10,
    },
    orderStatusLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    orderPendingText: {
        fontWeight: 'bold',
    },
    orderAcceptedText: {
        color: 'green',
        fontWeight: 'bold',
    },
    orderAlteredText: {
        color: 'blue',
        fontWeight: 'bold',
    },
    boldText: {
        fontWeight: 'bold',
    },
    noOrdersText: {
        fontSize: 14,
        color: '#777',
        fontStyle: 'italic',
        marginTop: 5,
        marginLeft: 10,
    },
    bulkActionsContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 10,
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    selectAllText: {
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 16,
    },
    bulkActionButton: {
        backgroundColor: '#FFBF00',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        marginLeft: 8,
    },
    bulkActionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#777',
        textAlign: 'center',
    },
});

export default AdminAssignedUsersPage;