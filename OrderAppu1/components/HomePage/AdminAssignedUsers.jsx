import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    ScrollView,
    RefreshControl,
    Platform,
} from "react-native";
import { Checkbox, Card, Button, Searchbar } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from "../../urls";
import { useNavigation } from "@react-navigation/native";
import moment from 'moment';
import Toast from "react-native-toast-message";
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Animated } from 'react-native';

// Color Constants
const COLORS = {
    primary: '#003366', // Deep Blue
    primaryLight: '#004488',
    primaryDark: '#002244',
    secondary: '#10B981', // Emerald
    accent: '#F59E0B', // Amber
    success: '#059669', // Green
    error: '#DC2626', // Red
    warning: '#D97706', // Yellow
    background: '#F3F4F6', // Light Gray
    surface: '#FFFFFF', // White
    text: {
        primary: '#111827', // Almost Black
        secondary: '#4B5563', // Gray
        tertiary: '#9CA3AF', // Light Gray
        light: '#FFFFFF', // White
    },
    border: '#E5E7EB',
    divider: '#F3F4F6',
    card: {
        background: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
    },
};

const AdminAssignedUsersPage = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adminId, setAdminId] = useState(null);
    const navigation = useNavigation();
    const [selectedOrderIds, setSelectedOrderIds] = useState({});
    const [selectAllOrders, setSelectAllOrders] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const scrollY = new Animated.Value(0);

    // Header animation values
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [120, 80],
        extrapolate: 'clamp',
    });

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.8],
        extrapolate: 'clamp',
    });

    useFocusEffect(
        React.useCallback(() => {
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

    useEffect(() => {
        if (searchQuery) {
            const filtered = assignedUsers.filter(user =>
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.route.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(assignedUsers);
        }
    }, [searchQuery, assignedUsers]);

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

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchInitialData().finally(() => setRefreshing(false));
    }, []);

    const fetchAssignedUsers = async (currentAdminId, userAuthToken) => {
        try {
            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
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
                setFilteredUsers(responseData.assignedUsers);
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
        const apiUrl = `http://${ipAddress}:8091/get-admin-orders/${currentAdminId}?date=${today}`;

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
                const response = await fetch(`http://${ipAddress}:8091/update-order-status`, {
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
                        <View style={styles.userAvatar}>
                            <Icon name="account-circle" size={32} color={COLORS.primary} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <View style={styles.userMeta}>
                                <Icon name="map-marker" size={16} color={COLORS.text.secondary} />
                                <Text style={styles.userRoute}>{item.route}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.ordersContainer}>
                        <View style={styles.orderTypeSection}>
                            <View style={styles.orderTypeHeader}>
                                <Icon name="weather-sunny" size={20} color={COLORS.accent} />
                                <Text style={styles.orderTypeTitle}>AM Orders</Text>
                                <View style={styles.orderCountBadge}>
                                    <Text style={styles.orderCountText}>{userAMOrdersToday.length}</Text>
                                </View>
                            </View>
                            {userAMOrdersToday.length > 0 ? (
                                userAMOrdersToday.map(order => (
                                    <Card key={order.id} style={styles.orderCard}>
                                        <Card.Content>
                                            <View style={styles.orderRow}>
                                                <Checkbox
                                                    status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                                    onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                                    color={COLORS.primary}
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
                                                        <View style={[styles.statusBadge, styles.alteredBadge]}>
                                                            <Icon name="pencil" size={14} color={COLORS.primary} />
                                                            <Text style={styles.alteredStatus}>Altered</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={[
                                                            styles.statusBadge,
                                                            order.approve_status === 'Accepted' ? styles.acceptedBadge : styles.pendingBadge
                                                        ]}>
                                                            <Icon 
                                                                name={order.approve_status === 'Accepted' ? 'check-circle' : 'clock-outline'} 
                                                                size={14} 
                                                                color={order.approve_status === 'Accepted' ? COLORS.success : COLORS.warning} 
                                                            />
                                                            <Text style={[
                                                                styles.statusText,
                                                                order.approve_status === 'Accepted' ? styles.acceptedStatus : styles.pendingStatus
                                                            ]}>
                                                                {order.approve_status === 'Accepted' ? 'Accepted' : 'Pending'}
                                                            </Text>
                                                        </View>
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
                                <Icon name="weather-night" size={20} color={COLORS.primary} />
                                <Text style={styles.orderTypeTitle}>PM Orders</Text>
                                <View style={styles.orderCountBadge}>
                                    <Text style={styles.orderCountText}>{userPMOrdersToday.length}</Text>
                                </View>
                            </View>
                            {userPMOrdersToday.length > 0 ? (
                                userPMOrdersToday.map(order => (
                                    <Card key={order.id} style={styles.orderCard}>
                                        <Card.Content>
                                            <View style={styles.orderRow}>
                                                <Checkbox
                                                    status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                                    onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                                    color={COLORS.primary}
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
                                                        <View style={[styles.statusBadge, styles.alteredBadge]}>
                                                            <Icon name="pencil" size={14} color={COLORS.primary} />
                                                            <Text style={styles.alteredStatus}>Altered</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={[
                                                            styles.statusBadge,
                                                            order.approve_status === 'Accepted' ? styles.acceptedBadge : styles.pendingBadge
                                                        ]}>
                                                            <Icon 
                                                                name={order.approve_status === 'Accepted' ? 'check-circle' : 'clock-outline'} 
                                                                size={14} 
                                                                color={order.approve_status === 'Accepted' ? COLORS.success : COLORS.warning} 
                                                            />
                                                            <Text style={[
                                                                styles.statusText,
                                                                order.approve_status === 'Accepted' ? styles.acceptedStatus : styles.pendingStatus
                                                            ]}>
                                                                {order.approve_status === 'Accepted' ? 'Accepted' : 'Pending'}
                                                            </Text>
                                                        </View>
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
                                    color={COLORS.primary}
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

                <Searchbar
                    placeholder="Search users..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    iconColor={COLORS.primary}
                    inputStyle={styles.searchInput}
                />

                <ScrollView 
                    style={styles.usersScrollView}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                    scrollEventThrottle={16}
                >
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map(user => renderUserOrderItem({ item: user }))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Icon name="account-question" size={48} color={COLORS.primary} />
                                <Text style={styles.emptyText}>No users found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'No users assigned to you'}
                                </Text>
                            </Card.Content>
                        </Card>
                    )}
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
                <View style={styles.headerContent}>
                    <Icon name="account-group" size={28} color={COLORS.text.light} />
                    <Text style={styles.headerTitle}>Order Approvals</Text>
                </View>
            </Animated.View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading user data...</Text>
                </View>
            ) : error ? (
                <Card style={styles.errorCard}>
                    <Card.Content>
                        <View style={styles.errorContent}>
                            <Icon name="alert-circle" size={24} color={COLORS.error} />
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
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 40 : 16,
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
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text.light,
        marginLeft: 12,
    },
    contentContainer: {
        flex: 1,
        padding: 16,
    },
    searchBar: {
        marginBottom: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        elevation: 2,
    },
    searchInput: {
        color: COLORS.text.primary,
    },
    bulkActionsCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
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
        color: COLORS.primary,
        fontWeight: '500',
    },
    bulkApproveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
    },
    bulkApproveButtonLabel: {
        color: COLORS.text.light,
        fontWeight: '500',
    },
    usersScrollView: {
        flex: 1,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    userMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    userRoute: {
        fontSize: 14,
        color: COLORS.text.secondary,
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
        marginBottom: 12,
    },
    orderTypeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginLeft: 8,
    },
    orderCountBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    orderCountText: {
        fontSize: 12,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    orderCard: {
        backgroundColor: COLORS.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    noOrdersCard: {
        backgroundColor: COLORS.background,
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
        color: COLORS.text.secondary,
        width: 70,
    },
    orderValue: {
        fontSize: 14,
        color: COLORS.text.primary,
        fontWeight: '500',
    },
    orderStatus: {
        marginLeft: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pendingBadge: {
        backgroundColor: '#FEF3C7',
    },
    acceptedBadge: {
        backgroundColor: '#D1FAE5',
    },
    alteredBadge: {
        backgroundColor: '#DBEAFE',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 4,
    },
    pendingStatus: {
        color: COLORS.warning,
    },
    acceptedStatus: {
        color: COLORS.success,
    },
    alteredStatus: {
        color: COLORS.primary,
    },
    noOrdersText: {
        fontSize: 14,
        color: COLORS.text.secondary,
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
        color: COLORS.primary,
    },
    errorCard: {
        backgroundColor: '#FEE2E2',
        margin: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
    },
    errorContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.error,
        marginLeft: 8,
        fontSize: 16,
    },
    emptyCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
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
        color: COLORS.text.primary,
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginTop: 8,
        textAlign: 'center',
    },
});

export default AdminAssignedUsersPage;