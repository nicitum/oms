import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../urls';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CollectCashSA = () => {
    const [users, setUsers] = useState([]);
    const [amountDueMap, setAmountDueMap] = useState({});
    const [cashInputMap, setCashInputMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingAmounts, setLoadingAmounts] = useState({});
    const [updatingCash, setUpdatingCash] = useState({});
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalCustomerId, setModalCustomerId] = useState(null);
    const [modalCash, setModalCash] = useState(null);

    const fetchAllUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token not found. Please log in.");
            }

            const url = `http://${ipAddress}:8091/allUsers/`;
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch users: ${response.status} - ${errorText}`);
            }

            const responseJson = await response.json();
            if (responseJson && responseJson.data && Array.isArray(responseJson.data)) {
                const userRoleOnly = responseJson.data.filter(user => user.role === 'user');
                setUsers(userRoleOnly);
                const initialLoadingAmounts = {};
                userRoleOnly.forEach(user => {
                    initialLoadingAmounts[user.customer_id] = false;
                });
                setLoadingAmounts(initialLoadingAmounts);
            } else {
                setUsers([]);
                setError("No customers found.");
            }
        } catch (fetchError) {
            setError(fetchError.message || "Failed to fetch users.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: fetchError.message });
        } finally {
            setLoading(false);
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

    const handleSearchChange = (text) => {
        setSearchQuery(text);
        if (text) {
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(users);
        }
    };

    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    useEffect(() => {
        if (users.length > 0) {
            users.forEach(user => {
                fetchAmountDue(user.customer_id);
            });
        }
    }, [users, fetchAmountDue]);

    const usersToDisplay = searchQuery ? filteredUsers : users;

    if (loading) {
        return (
            <View style={styles.loadingContainerModern}>
                <ActivityIndicator size="large" color="#003366" />
                <Text style={styles.loadingTextModern}>Loading Customers...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainerModern}>
                <Icon name="error-outline" size={44} color="#dc3545" />
                <Text style={styles.errorTextModern}>{error}</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainerModern}>
            {/* Modern Header */}
            <View style={styles.headerShadowWrap}>
                <View style={styles.headerModern}>
                    <Icon name="payments" size={30} color="#fff" style={{ marginRight: 12 }} />
                    <Text style={styles.headerTitleModern}>Cash Collection</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBarCardModern}>
                <Icon name="search" size={22} color="#003366" style={styles.searchIconModern} />
                <TextInput
                    style={styles.searchInputModern}
                    placeholder="Search by customer name..."
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    placeholderTextColor="#666"
                />
            </View>

            {usersToDisplay.length === 0 ? (
                <View style={styles.noDataContainerModern}>
                    <Icon name="inbox" size={44} color="#6c757d" />
                    <Text style={styles.noDataTextModern}>No customers found.</Text>
                </View>
            ) : (
                <FlatList
                    data={usersToDisplay}
                    keyExtractor={(item) => item.customer_id}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    renderItem={({ item }) => (
                        <View style={styles.cardModern}>
                            <View style={styles.cardHeaderModern}>
                                <View style={styles.avatarModern}>
                                    <Icon name="person" size={22} color="#003366" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.customerNameModern}>{item.name}</Text>
                                    <Text style={styles.customerIdModern}>ID: {item.customer_id}</Text>
                                </View>
                            </View>
                            <View style={styles.cardBodyModern}>
                                <View style={styles.amountDueRowModern}>
                                    <Text style={styles.amountDueLabelModern}>Amount Due:</Text>
                                    {loadingAmounts[item.customer_id] ? (
                                        <ActivityIndicator size="small" color="#003366" />
                                    ) : amountDueMap[item.customer_id] !== 'Error' ? (
                                        <Text style={styles.amountDueValueModern}>{parseFloat(amountDueMap[item.customer_id]).toFixed(2)}</Text>
                                    ) : (
                                        <Text style={styles.amountDueErrorModern}>Error</Text>
                                    )}
                                </View>
                                <View style={styles.inputContainerModern}>
                                    <TextInput
                                        style={styles.cashInputModern}
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={cashInputMap[item.customer_id] || ''}
                                        onChangeText={(text) => handleCashInputChange(item.customer_id, text)}
                                        placeholderTextColor="#aaa"
                                    />
                                    <TouchableOpacity
                                        style={[styles.collectButtonModern, updatingCash[item.customer_id] && styles.disabledButtonModern]}
                                        onPress={() => handleCollectCash(item.customer_id, cashInputMap[item.customer_id])}
                                        disabled={updatingCash[item.customer_id]}
                                    >
                                        {updatingCash[item.customer_id] ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.collectButtonTextModern}>Collect</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlayModern}>
                    <View style={styles.modalContainerModern}>
                        <Text style={styles.modalTitleModern}>Confirm Collection</Text>
                        <Text style={styles.modalTextModern}>
                            Collect {modalCash ? `${parseFloat(modalCash).toFixed(2)}` : ''} from customer {modalCustomerId}?
                        </Text>
                        <View style={styles.modalButtonContainerModern}>
                            <TouchableOpacity
                                style={[styles.modalButtonModern, styles.cancelButtonModern]}
                                onPress={() => setIsModalVisible(false)}
                            >
                                <Text style={styles.modalButtonTextModern}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButtonModern, styles.confirmButtonModern]}
                                onPress={confirmCollectCash}
                            >
                                <Text style={styles.modalButtonTextModern}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Toast />
        </ScrollView>
    );
};

// Modernized Styles
const styles = StyleSheet.create({
    scrollContainerModern: {
        flexGrow: 1,
        backgroundColor: '#f0f4f8',
        paddingBottom: 20,
    },
    headerShadowWrap: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 6,
        backgroundColor: 'transparent',
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        marginBottom: 10,
    },
    headerModern: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#003366',
        paddingVertical: 22,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
    },
    headerTitleModern: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    searchBarCardModern: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginHorizontal: 18,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    searchIconModern: {
        marginRight: 10,
    },
    searchInputModern: {
        flex: 1,
        fontSize: 16,
        color: '#003366',
        paddingVertical: 6,
    },
    loadingContainerModern: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingTextModern: {
        marginTop: 10,
        fontSize: 16,
        color: '#003366',
        fontWeight: '600',
    },
    errorContainerModern: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorTextModern: {
        fontSize: 18,
        color: '#dc3545',
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '700',
    },
    noDataContainerModern: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noDataTextModern: {
        fontSize: 18,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '600',
    },
    cardModern: {
        backgroundColor: '#fff',
        borderRadius: 14,
        marginHorizontal: 18,
        marginBottom: 18,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeaderModern: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarModern: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e6ecf3',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    customerNameModern: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
    },
    customerIdModern: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
    },
    cardBodyModern: {
        paddingTop: 6,
    },
    amountDueRowModern: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    amountDueLabelModern: {
        fontSize: 15,
        color: '#495057',
        fontWeight: '600',
        marginRight: 8,
    },
    amountDueValueModern: {
        fontSize: 16,
        color: '#28a745',
        fontWeight: '700',
    },
    amountDueErrorModern: {
        fontSize: 16,
        color: '#dc3545',
        fontWeight: '700',
    },
    inputContainerModern: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cashInputModern: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        backgroundColor: '#f8f9fa',
        color: '#003366',
    },
    collectButtonModern: {
        backgroundColor: '#28a745',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButtonModern: {
        backgroundColor: '#6c757d',
    },
    collectButtonTextModern: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlayModern: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainerModern: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
    },
    modalTitleModern: {
        fontSize: 20,
        fontWeight: '700',
        color: '#003366',
        marginBottom: 15,
    },
    modalTextModern: {
        fontSize: 16,
        color: '#495057',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalButtonContainerModern: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalButtonModern: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButtonModern: {
        backgroundColor: '#dc3545',
    },
    confirmButtonModern: {
        backgroundColor: '#28a745',
    },
    modalButtonTextModern: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CollectCashSA;