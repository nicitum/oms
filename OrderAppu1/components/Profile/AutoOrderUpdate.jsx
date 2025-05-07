import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { ipAddress } from '../../urls';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AutoOrderUpdate = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);

    // Fetch all users from /allUsers/ API
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
            console.log("Response from fetchAllUsers:", response);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch users: ${response.status} - ${errorText}`);
            }

            const responseJson = await response.json();
            console.log("Parsed usersData:", responseJson);

            if (responseJson && responseJson.data && Array.isArray(responseJson.data)) {
                const filteredUsers = responseJson.data.filter(user => user.role === 'user');
                if (filteredUsers.length > 0) {
                    setUsers(filteredUsers);
                } else {
                    setUsers([]);
                    setError("No customers found.");
                }
            }
        } catch (fetchError) {
            setError(fetchError.message || "Failed to fetch users.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: fetchError.message });
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch users when the screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchAllUsers();
        }, [fetchAllUsers])
    );

    // Update filtered users based on search query
    useEffect(() => {
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            const results = users.filter(user =>
                user.name && user.name.toLowerCase().includes(lowerCaseQuery)
            );
            setFilteredUsers(results);
        } else {
            setFilteredUsers(users);
        }
    }, [searchQuery, users]);

    // Update auto order preferences for a customer
    const updateAutoOrderPreferences = async (customerId, autoAmOrder, autoPmOrder) => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const url = `http://${ipAddress}:8091/update-auto-order-preferences`;
            const payload = {
                customer_id: customerId,
                auto_am_order: autoAmOrder,
                auto_pm_order: autoPmOrder
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update preferences: ${response.status}, ${errorText}`);
            }

            const result = await response.json();
            if (result.success) {
                setUsers(prevUsers => prevUsers.map(user =>
                    user.customer_id === customerId
                        ? { ...user, auto_am_order: autoAmOrder, auto_pm_order: autoPmOrder }
                        : user
                ));
                Toast.show({
                    type: 'success',
                    text1: 'Preferences Updated',
                    text2: `Auto orders updated for customer ${customerId}.`,
                    backgroundColor: '#003366'
                });
            } else {
                throw new Error(result.message || "Failed to update preferences.");
            }
        } catch (updateError) {
            setError(updateError.message || "Failed to update auto order preferences.");
            Toast.show({
                type: 'error',
                text1: 'Update Error',
                text2: updateError.message,
                backgroundColor: '#dc3545'
            });
            if (updateError.message.includes("Customer not found")) {
                setUsers(prevUsers => prevUsers.filter(user => user.customer_id !== customerId));
            }
        } finally {
            setLoading(false);
        }
    };

    // Toggle AM order preference
    const toggleAmOrder = (customerId, currentValue) => {
        const newValue = currentValue === 'Yes' ? 'No' : 'Yes';
        const user = users.find(u => u.customer_id === customerId);
        if (user) {
            updateAutoOrderPreferences(customerId, newValue, user.auto_pm_order);
        }
    };

    // Toggle PM order preference
    const togglePmOrder = (customerId, currentValue) => {
        const newValue = currentValue === 'Yes' ? 'No' : 'Yes';
        const user = users.find(u => u.customer_id === customerId);
        if (user) {
            updateAutoOrderPreferences(customerId, user.auto_am_order, newValue);
        }
    };

    // Render each customer item
    const renderCustomerItem = ({ item }) => (
        <View style={styles.customerCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{item.name}</Text>
                <Text style={styles.customerId}>ID: {item.customer_id}</Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>Auto AM Order</Text>
                    <TouchableOpacity
                        style={[styles.toggleButton, item.auto_am_order === 'Yes' ? styles.toggleOn : styles.toggleOff]}
                        onPress={() => toggleAmOrder(item.customer_id, item.auto_am_order)}
                        disabled={loading}
                        activeOpacity={0.7}
                        accessibilityLabel={`Toggle AM order for ${item.name}`}
                    >
                        <Text style={styles.toggleText}>{item.auto_am_order || 'No'}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>Auto PM Order</Text>
                    <TouchableOpacity
                        style={[styles.toggleButton, item.auto_pm_order === 'Yes' ? styles.toggleOn : styles.toggleOff]}
                        onPress={() => togglePmOrder(item.customer_id, item.auto_pm_order)}
                        disabled={loading}
                        activeOpacity={0.7}
                        accessibilityLabel={`Toggle PM order for ${item.name}`}
                    >
                        <Text style={styles.toggleText}>{item.auto_pm_order || 'No'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerText}>Auto Order Preferences</Text>
                <View style={styles.searchContainer}>
                    <Icon name="search" size={24} color="#6c757d" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by customer name..."
                        placeholderTextColor="#6c757d"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        accessibilityLabel="Search customers"
                    />
                </View>
            </View>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#003366" />
                    <Text style={styles.loadingText}>Loading Customers...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={40} color="#dc3545" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.customer_id.toString()}
                renderItem={renderCustomerItem}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="inbox" size={40} color="#6c757d" />
                        <Text style={styles.emptyText}>No customers found.</Text>
                    </View>
                }
                contentContainerStyle={styles.listContainer}
            />

            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#003366',
        padding: 20,
        paddingTop: 40,
        borderBottomWidth: 1,
        borderBottomColor: '#002244',
    },
    headerText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 15,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingHorizontal: 10,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 18,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 10,
    },
    listContainer: {
        padding: 15,
    },
    customerCard: {
        backgroundColor: '#ffffff',
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
        color: '#333',
    },
    customerId: {
        fontSize: 14,
        color: '#6c757d',
    },
    cardBody: {
        paddingTop: 10,
    },
    preferenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 8,
    },
    preferenceLabel: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    toggleButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleOn: {
        backgroundColor: '#28a745',
    },
    toggleOff: {
        backgroundColor: '#dc3545',
    },
    toggleText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default AutoOrderUpdate;