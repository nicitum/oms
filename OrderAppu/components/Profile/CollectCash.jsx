import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, ScrollView, Modal, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

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

            const data = await response.json();
            let usersArray = [];
            if (Array.isArray(data.assignedUsers)) {
                usersArray = data.assignedUsers;
            } else if (data.assignedUsers) {
                usersArray = [data.assignedUsers];
            }

            setAssignedUsers(usersArray);

            const initialLoadingAmounts = {};
            usersArray.forEach(user => {
                initialLoadingAmounts[user.cust_id] = false;
            });
            setLoadingAmounts(initialLoadingAmounts);
        } catch (error) {
            setError(error.message || "Error fetching assigned users.");
            setAssignedUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const fetchAmountDue = useCallback(async (customerId) => {
        setLoadingAmounts(prev => ({ ...prev, [customerId]: true }));
        try {
            const response = await fetch(`http://${ipAddress}:8090/collect_cash?customerId=${customerId}`, {
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
            const response = await fetch(`http://${ipAddress}:8090/collect_cash?customerId=${customerId}`, {
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
            const filtered = assignedUsers.filter(user =>
                user.name.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(assignedUsers);
        }
    };

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

    const usersToDisplay = searchQuery ? filteredUsers : assignedUsers;

    if (loadingUsers) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading Customers...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="error-outline" size={40} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.header}>Cash Collection</Text>

                <View style={styles.searchContainer}>
                    <Icon name="search" size={24} color="#6c757d" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by customer name..."
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                    />
                </View>

                {usersToDisplay.length === 0 ? (
                    <View style={styles.noDataContainer}>
                        <Icon name="inbox" size={40} color="#6c757d" />
                        <Text style={styles.noDataText}>No customers found.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={usersToDisplay}
                        keyExtractor={(item) => item.cust_id}
                        renderItem={({ item }) => (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.customerName}>{item.name}</Text>
                                    <Text style={styles.customerId}>ID: {item.cust_id}</Text>
                                </View>
                                <View style={styles.cardBody}>
                                    <Text style={styles.amountDue}>
                                        Amount Due: {loadingAmounts[item.cust_id] ? (
                                            <ActivityIndicator size="small" color="#007bff" />
                                        ) : amountDueMap[item.cust_id] !== 'Error' ? (
                                            `${parseFloat(amountDueMap[item.cust_id]).toFixed(2)}`
                                        ) : (
                                            'Error'
                                        )}
                                    </Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={styles.cashInput}
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={cashInputMap[item.cust_id] || ''}
                                            onChangeText={(text) => handleCashInputChange(item.cust_id, text)}
                                        />
                                        <TouchableOpacity
                                            style={[styles.collectButton, updatingCash[item.cust_id] && styles.disabledButton]}
                                            onPress={() => handleCollectCash(item.cust_id, cashInputMap[item.cust_id])}
                                            disabled={updatingCash[item.cust_id]}
                                        >
                                            {updatingCash[item.cust_id] ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={styles.collectButtonText}>Collect</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    />
                )}

                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isModalVisible}
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>Confirm Collection</Text>
                            <Text style={styles.modalText}>
                                Collect {modalCash ? `${parseFloat(modalCash).toFixed(2)}` : ''} from customer {modalCustomerId}?
                            </Text>
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setIsModalVisible(false)}
                                >
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.confirmButton]}
                                    onPress={confirmCollectCash}
                                >
                                    <Text style={styles.modalButtonText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
            <Toast />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        backgroundColor: '#f0f4f8',
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a3c34',
        textAlign: 'center',
        marginBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 10,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#dc3545',
        textAlign: 'center',
        marginTop: 10,
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noDataText: {
        fontSize: 18,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 10,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a3c34',
    },
    customerId: {
        fontSize: 14,
        color: '#6c757d',
    },
    cardBody: {
        paddingTop: 10,
    },
    amountDue: {
        fontSize: 16,
        color: '#495057',
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cashInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        backgroundColor: '#f8f9fa',
    },
    collectButton: {
        backgroundColor: '#28a745',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        backgroundColor: '#6c757d',
    },
    collectButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a3c34',
        marginBottom: 15,
    },
    modalText: {
        fontSize: 16,
        color: '#495057',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#dc3545',
    },
    confirmButton: {
        backgroundColor: '#28a745',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CollectCashPage;