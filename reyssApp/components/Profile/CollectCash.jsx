import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, TouchableOpacity } from 'react-native'; // Added Modal and TouchableOpacity
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';
import Toast from 'react-native-toast-message';

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
    const [isModalVisible, setIsModalVisible] = useState(false); // Modal visibility state
    const [modalCustomerId, setModalCustomerId] = useState(null); // Customer ID for modal
    const [modalCash, setModalCash] = useState(null); // Cash amount for modal

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
            console.log("Assigned Users fetched:", data);

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
        console.log("Fetching amount due for customerId:", customerId);
        setLoadingAmounts(prevLoadingAmounts => ({ ...prevLoadingAmounts, [customerId]: true }));
        try {
            const response = await fetch(`http://${ipAddress}:8090/collect_cash?customerId=${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch amount due for customer ${customerId}. Status: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();
            setAmountDueMap(prevAmountDueMap => ({ ...prevAmountDueMap, [customerId]: data.amountDue }));
        } catch (error) {
            setError(error.message || `Error fetching amount due for customer ${customerId}.`);
            setAmountDueMap(prevAmountDueMap => ({ ...prevAmountDueMap, [customerId]: 'Error' }));
        } finally {
            setLoadingAmounts(prevLoadingAmounts => ({ ...prevLoadingAmounts, [customerId]: false }));
        }
    }, []);

    const handleCollectCash = async (customerId, cash) => {
        if (isNaN(cash) || cash < 0) {
            Alert.alert("Invalid Input", "Please enter a valid non-negative cash amount.");
            return;
        }

        const currentAmountDue = amountDueMap[customerId];
        if (currentAmountDue !== 'Error' && parseFloat(cash) > parseFloat(currentAmountDue)) {
            Toast.show({
                type: 'info',
                text1: 'Info',
                text2: `Can collect up to Amount Due: ${parseFloat(currentAmountDue).toFixed(2)}`,
                position: 'bottom',
            });
            return;
        }

        // Show confirmation modal instead of directly collecting cash
        setModalCustomerId(customerId);
        setModalCash(cash);
        setIsModalVisible(true);
    };

    const confirmCollectCash = async () => {
        const customerId = modalCustomerId;
        const cash = modalCash;

        setUpdatingCash(prevUpdatingCash => ({ ...prevUpdatingCash, [customerId]: true }));
        setIsModalVisible(false); // Hide modal

        try {
            const response = await fetch(`http://${ipAddress}:8090/collect_cash?customerId=${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cash: parseFloat(cash) }),
            });

            if (!response.ok) {
                const message = `Failed to collect cash for customer ${customerId}. Status: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();
            setAmountDueMap(prevAmountDueMap => ({ ...prevAmountDueMap, [customerId]: data.updatedAmountDue }));
            setCashInputMap(prevCashInputMap => ({ ...prevCashInputMap, [customerId]: '' }));
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: data.message || "Cash collected successfully!",
                position: 'bottom',
            });
        } catch (error) {
            setError(error.message || `Error collecting cash for customer ${customerId}.`);
            Alert.alert("Error", error.message || "Failed to collect cash. Please try again.");
        } finally {
            setUpdatingCash(prevUpdatingCash => ({ ...prevUpdatingCash, [customerId]: false }));
        }
    };

    const cancelCollectCash = () => {
        setIsModalVisible(false); // Simply hide the modal
    };

    const handleCashInputChange = (customerId, text) => {
        const sanitizedText = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        if (!isNaN(Number(sanitizedText)) && Number(sanitizedText) >= 0) {
            setCashInputMap(prevCashInputMap => ({ ...prevCashInputMap, [customerId]: sanitizedText }));
        } else if (text === '') {
            setCashInputMap(prevCashInputMap => ({ ...prevCashInputMap, [customerId]: '' }));
        }
    };

    const handleSearchChange = (text) => {
        setSearchQuery(text);
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

    const usersToDisplay = searchQuery ? filteredUsers : assignedUsers;

    if (loadingUsers) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007bff" /><Text>Loading Customers...</Text></View>;
    }

    if (error) {
        return <View style={styles.errorContainer}><Text style={styles.errorText}>Error: {error}</Text></View>;
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.header}>Collect Cash</Text>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search Customer Name"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                />

                {usersToDisplay.length === 0 && !loadingUsers && !error ? (
                    <Text style={styles.noDataText}>No customers assigned to you.</Text>
                ) : (
                    <FlatList
                        data={usersToDisplay}
                        keyExtractor={(item) => item.cust_id}
                        renderItem={({ item }) => (
                            <View style={styles.listItem}>
                                <Text style={styles.customerName}>{item.name}</Text>
                                <View style={styles.amountDueContainer}>
                                    {loadingAmounts[item.cust_id] ? (
                                        <ActivityIndicator size="small" color="#007bff" />
                                    ) : (
                                        <Text style={styles.amountDue}>
                                            Amount Due: {amountDueMap[item.cust_id] !== 'Error' ? parseFloat(amountDueMap[item.cust_id]).toFixed(2) : 'Error'}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.collectCashContainer}>
                                    <TextInput
                                        style={styles.cashInput}
                                        placeholder="Enter Cash"
                                        keyboardType="numeric"
                                        value={cashInputMap[item.cust_id] || ''}
                                        onChangeText={(text) => handleCashInputChange(item.cust_id, text)}
                                    />
                                    <View style={styles.buttonWrapper}>
                                        <ActivityIndicator animating={updatingCash[item.cust_id]} color="#fff" style={styles.updateLoadingIndicator} />
                                        {!updatingCash[item.cust_id] && (
                                            <Text
                                                style={styles.collectButton}
                                                onPress={() => handleCollectCash(item.cust_id, cashInputMap[item.cust_id])}
                                            >
                                                Collect
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                    />
                )}

                {/* Confirmation Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={isModalVisible}
                    onRequestClose={cancelCollectCash}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>Confirm Cash Collection</Text>
                            <Text style={styles.modalText}>
                                Are you sure you want to collect {modalCash} from customer {modalCustomerId}?
                            </Text>
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={cancelCollectCash}
                                >
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.confirmButton]}
                                    onPress={confirmCollectCash}
                                >
                                    <Text style={styles.modalButtonText}>Collect</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
            <Toast ref={(ref) => Toast.setRef(ref)} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        paddingVertical: 20,
    },
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#212529',
        textAlign: 'center',
    },
    searchInput: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#dc3545',
        textAlign: 'center',
    },
    noDataText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        color: '#6c757d',
    },
    listItem: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212529',
        flex: 1,
    },
    amountDueContainer: {
        flex: 1.5,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingHorizontal: 8,
    },
    amountDue: {
        fontSize: 16,
        color: '#495057',
        fontWeight: '500',
    },
    collectCashContainer: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cashInput: {
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flex: 1,
        maxWidth: 100,
        backgroundColor: '#fff',
    },
    collectButton: {
        backgroundColor: '#FFBF00',
        color: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        fontWeight: '600',
        textAlign: 'center',
        minWidth: 80,
    },
    buttonWrapper: {
        position: 'relative',
    },
    updateLoadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(13, 110, 253, 0.8)',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent overlay
    },
    modalContainer: {
        width: 300,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#212529',
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
        paddingVertical: 10,
        borderRadius: 6,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#dc3545', // Red for cancel
    },
    confirmButton: {
        backgroundColor: '#28a745', // Green for confirm
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CollectCashPage;