import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView, Modal, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Animated } from 'react-native';
import { Searchbar, Card, Button } from 'react-native-paper';

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

const CollectCashPage = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [amountDueMap, setAmountDueMap] = useState({});
    const [cashInputMap, setCashInputMap] = useState({});
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingAmounts, setLoadingAmounts] = useState({});
    const [updatingCash, setUpdatingCash] = useState({});
    const [error, setError] = useState(null);
    const [userAuthToken, setUserAuthToken] = useState(null);
    const [adminId, setAdminId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalCustomerId, setModalCustomerId] = useState(null);
    const [modalCash, setModalCash] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
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

    const getTokenAndAdminId = useCallback(async () => {
        try {
            setLoadingUsers(true);
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("User authentication token not found.");
            }
            setUserAuthToken(token);
            const decodedToken = jwtDecode(token);
            const currentAdminId = decodedToken.id1;
            setAdminId(currentAdminId);
            return { currentAdminId, token };
        } catch (err) {
            setError(err.message || "Failed to retrieve token and admin ID.");
            return { currentAdminId: null, token: null };
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const fetchAssignedUsers = useCallback(async (currentAdminId, userAuthToken) => {
        if (!currentAdminId || !userAuthToken) {
            return;
        }
        setLoadingUsers(true);
        try {
            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch assigned users. Status: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();
            let usersArray = [];
            if (Array.isArray(data.assignedUsers)) {
                usersArray = data.assignedUsers;
            } else if (data.assignedUsers) {
                usersArray = [data.assignedUsers];
            }

            setAssignedUsers(usersArray);
            setFilteredUsers(usersArray);

            const initialLoadingAmounts = {};
            usersArray.forEach(user => {
                initialLoadingAmounts[user.cust_id] = false;
            });
            setLoadingAmounts(initialLoadingAmounts);
        } catch (error) {
            setError(error.message || "Error fetching assigned users.");
            setAssignedUsers([]);
            setFilteredUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const fetchAmountDue = useCallback(async (customerId) => {
        setLoadingAmounts(prev => ({ ...prev, [customerId]: true }));
        try {
            const response = await fetch(`http://${ipAddress}:8091/collect_cash?customerId=${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch amount due for customer ${customerId}.`);
            }

            const data = await response.json();
            setAmountDueMap(prev => ({ ...prev, [customerId]: data.amountDue }));
        } catch (error) {
            setAmountDueMap(prev => ({ ...prev, [customerId]: 'Error' }));
            Toast.show({ type: 'error', text1: 'Error', text2: error.message });
        } finally {
            setLoadingAmounts(prev => ({ ...prev, [customerId]: false }));
        }
    }, []);

    const handleCollectCash = (customerId, cash) => {
        if (isNaN(cash) || cash < 0) {
            Toast.show({ type: 'error', text1: 'Invalid Input', text2: 'Please enter a valid cash amount.' });
            return;
        }

        const currentAmountDue = amountDueMap[customerId];
        if (currentAmountDue !== 'Error' && parseFloat(cash) > parseFloat(currentAmountDue)) {
            Toast.show({
                type: 'info',
                text1: 'Info',
                text2: `Cannot collect more than Amount Due: ${parseFloat(currentAmountDue).toFixed(2)}`,
            });
            return;
        }

        setModalCustomerId(customerId);
        setModalCash(cash);
        setIsModalVisible(true);
    };

    const confirmCollectCash = async () => {
        const customerId = modalCustomerId;
        const cash = modalCash;
        setUpdatingCash(prev => ({ ...prev, [customerId]: true }));
        setIsModalVisible(false);

        try {
            const response = await fetch(`http://${ipAddress}:8091/collect_cash?customerId=${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cash: parseFloat(cash) }),
            });

            if (!response.ok) {
                throw new Error(`Failed to collect cash for customer ${customerId}.`);
            }

            const data = await response.json();
            setAmountDueMap(prev => ({ ...prev, [customerId]: data.updatedAmountDue }));
            setCashInputMap(prev => ({ ...prev, [customerId]: '' }));
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: data.message || "Cash collected successfully!",
            });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.message });
        } finally {
            setUpdatingCash(prev => ({ ...prev, [customerId]: false }));
        }
    };

    const handleCashInputChange = (customerId, text) => {
        const sanitizedText = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        if (!isNaN(Number(sanitizedText)) && Number(sanitizedText) >= 0) {
            setCashInputMap(prev => ({ ...prev, [customerId]: sanitizedText }));
        } else if (text === '') {
            setCashInputMap(prev => ({ ...prev, [customerId]: '' }));
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        getTokenAndAdminId().then(({ currentAdminId, token }) => {
            if (currentAdminId && token) {
                fetchAssignedUsers(currentAdminId, token).finally(() => setRefreshing(false));
            } else {
                setRefreshing(false);
            }
        });
    }, [getTokenAndAdminId, fetchAssignedUsers]);

    useEffect(() => {
        const loadData = async () => {
            const authData = await getTokenAndAdminId();
            if (authData.currentAdminId && authData.token) {
                await fetchAssignedUsers(authData.currentAdminId, authData.token);
            }
        };
        loadData();
    }, [getTokenAndAdminId, fetchAssignedUsers]);

    useEffect(() => {
        if (assignedUsers.length > 0) {
            assignedUsers.forEach(user => {
                fetchAmountDue(user.cust_id);
            });
        }
    }, [assignedUsers, fetchAmountDue]);

    useEffect(() => {
        if (searchQuery) {
            const filtered = assignedUsers.filter(user =>
                user.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(assignedUsers);
        }
    }, [searchQuery, assignedUsers]);

    const renderUserCard = (user) => {
        const amountDue = amountDueMap[user.cust_id];
        const cashInput = cashInputMap[user.cust_id] || '';
        const isLoading = loadingAmounts[user.cust_id];
        const isUpdating = updatingCash[user.cust_id];

        return (
            <Card style={styles.userCard} key={user.cust_id}>
                <Card.Content>
                    <View style={styles.cardHeader}>
                        <View style={styles.userAvatar}>
                            <Icon name="account-circle" size={32} color={COLORS.primary} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.name}</Text>
                            <View style={styles.userMeta}>
                                <Icon name="identifier" size={16} color={COLORS.text.secondary} />
                                <Text style={styles.userId}>ID: {user.cust_id}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.amountSection}>
                        <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>Amount Due:</Text>
                            {isLoading ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <Text style={styles.amountValue}>
                                    ₹{amountDue === 'Error' ? 'Error' : parseFloat(amountDue).toFixed(2)}
                                </Text>
                            )}
                        </View>

                        <View style={styles.inputSection}>
                            <TextInput
                                style={styles.cashInput}
                                placeholder="Enter amount"
                                placeholderTextColor={COLORS.text.tertiary}
                                keyboardType="numeric"
                                value={cashInput}
                                onChangeText={(text) => handleCashInputChange(user.cust_id, text)}
                            />
                            <Button
                                mode="contained"
                                onPress={() => handleCollectCash(user.cust_id, cashInput)}
                                style={styles.collectButton}
                                labelStyle={styles.collectButtonLabel}
                                disabled={isUpdating || !cashInput || isLoading}
                                loading={isUpdating}
                                icon="cash-multiple"
                            >
                                {isUpdating ? 'Processing...' : 'Collect'}
                            </Button>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    const renderContent = () => {
        return (
            <View style={styles.contentContainer}>
                <Searchbar
                    placeholder="Search customers..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    iconColor={COLORS.primary}
                    inputStyle={styles.searchInput}
                />

                <ScrollView
                    style={styles.scrollView}
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
                        filteredUsers.map(user => renderUserCard(user))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Icon name="account-question" size={48} color={COLORS.primary} />
                                <Text style={styles.emptyText}>No customers found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'No customers assigned to you'}
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
                    <Icon name="cash-multiple" size={28} color={COLORS.text.light} />
                    <Text style={styles.headerTitle}>Cash Collection</Text>
                </View>
            </Animated.View>

            {loadingUsers ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading customers...</Text>
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

            <Modal
                animationType="slide"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Icon name="cash-check" size={24} color={COLORS.primary} />
                            <Text style={styles.modalTitle}>Confirm Collection</Text>
                        </View>
                        <Text style={styles.modalText}>
                            Are you sure you want to collect ₹{modalCash ? parseFloat(modalCash).toFixed(2) : '0.00'} from customer {modalCustomerId}?
                        </Text>
                        <View style={styles.modalButtons}>
                            <Button
                                mode="outlined"
                                onPress={() => setIsModalVisible(false)}
                                style={styles.modalCancelButton}
                                labelStyle={styles.modalButtonLabel}
                            >
                                Cancel
                            </Button>
                            <Button
                                mode="contained"
                                onPress={confirmCollectCash}
                                style={styles.modalConfirmButton}
                                labelStyle={styles.modalButtonLabel}
                            >
                                Confirm
                            </Button>
                        </View>
                    </View>
                </View>
            </Modal>
            <Toast />
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
    scrollView: {
        flex: 1,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
    },
    cardHeader: {
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
    userId: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginLeft: 4,
    },
    amountSection: {
        gap: 12,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background,
        padding: 12,
        borderRadius: 8,
    },
    amountLabel: {
        fontSize: 16,
        color: COLORS.text.secondary,
    },
    amountValue: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    inputSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cashInput: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: COLORS.text.primary,
    },
    collectButton: {
        backgroundColor: COLORS.success,
    },
    collectButtonLabel: {
        color: COLORS.text.light,
        fontWeight: '500',
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
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginLeft: 12,
    },
    modalText: {
        fontSize: 16,
        color: COLORS.text.secondary,
        marginBottom: 24,
        textAlign: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        borderColor: COLORS.error,
    },
    modalConfirmButton: {
        flex: 1,
        backgroundColor: COLORS.success,
    },
    modalButtonLabel: {
        fontWeight: '500',
    },
});

export default CollectCashPage;