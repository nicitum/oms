import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { ipAddress } from '../../urls';

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [userAuthToken, setUserAuthToken] = useState(null);
    const [adminId, setAdminId] = useState(null);

    // Fetch token and admin ID
    const getTokenAndAdminId = async () => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token not found");
            }
            setUserAuthToken(token);
            const decodedToken = jwtDecode(token);
            const currentAdminId = decodedToken.id1; // Assuming id1 is the admin ID
            setAdminId(currentAdminId);
            return { currentAdminId, token };
        } catch (err) {
            setError(err.message || "Failed to retrieve token and admin ID.");
            return { currentAdminId: null, token: null };
        }
    };

    // Fetch assigned users
    const fetchAssignedUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const { currentAdminId, token } = await getTokenAndAdminId();
            if (!currentAdminId || !token) {
                throw new Error("Admin ID or token missing");
            }

            const response = await fetch(`http://${ipAddress}:8090/assigned-users/${currentAdminId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const message = `Failed to fetch assigned users. Status: ${response.status}`;
                throw new Error(message);
            }

            const responseData = await response.json();
            console.log("Assigned Users Response:", responseData);

            if (responseData.success) {
                setAssignedUsers(responseData.assignedUsers);
            } else {
                throw new Error("No assigned users found in response");
            }
        } catch (error) {
            console.error("Error fetching assigned users:", error);
            setError(error.message || "Error fetching assigned users.");
            setAssignedUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch transactions for all assigned users individually
    const fetchTransactions = async () => {
        setLoading(true);
        setError(null);
        try {
            if (assignedUsers.length === 0) {
                return; // Wait until assigned users are fetched
            }

            const allTransactions = [];
            for (const user of assignedUsers) {
                const customerId = user.cust_id;
                console.log("Fetching transactions for customer ID:", customerId);

                // Build query params for one customer at a time
                let url = `http://${ipAddress}:8090/fetch-payment-transactions?customer_id=${customerId}`;
                if (selectedDate) {
                    const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
                    url += `&date=${formattedDate}`;
                }
                if (paymentFilter !== 'All') {
                    url += `&payment_method=${paymentFilter.toLowerCase()}`;
                }

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${userAuthToken}`,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.warn(`Failed to fetch transactions for customer ${customerId}: ${response.status}`);
                    continue; // Skip this customer and move to the next
                }

                const data = await response.json();
                if (data.transactions && data.transactions.length > 0) {
                    allTransactions.push(...data.transactions);
                }
            }

            console.log("All Transactions fetched:", allTransactions);
            setTransactions(allTransactions);
            if (allTransactions.length === 0) {
                setError("No transactions found for the assigned customers.");
            } else {
                setError(null);
            }
        } catch (err) {
            console.error("Error fetching transactions:", err);
            setError(err.message || "Failed to fetch transactions.");
            setTransactions([]);
            Alert.alert("Error", `Failed to load transactions: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch assigned users on mount, then transactions when users or filters change
    useEffect(() => {
        fetchAssignedUsers();
    }, []);

    useEffect(() => {
        if (assignedUsers.length > 0) {
            fetchTransactions();
        }
    }, [assignedUsers, selectedDate, paymentFilter]);

    // Date picker handlers
    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirmDate = (date) => {
        setSelectedDate(date);
        hideDatePicker();
    };

    // Payment method filter handler
    const togglePaymentFilter = () => {
        setPaymentFilter(prev => {
            if (prev === 'All') return 'Cash';
            if (prev === 'Cash') return 'Online';
            return 'All';
        });
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header with Date Picker and Filter */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={showDatePicker} style={styles.datePickerButton}>
                    <Text style={styles.datePickerText}>
                        {selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePaymentFilter} style={styles.filterButton}>
                    <Text style={styles.filterText}>{paymentFilter}</Text>
                </TouchableOpacity>
            </View>

            {/* Date Picker Modal */}
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            <Text style={styles.headerText}>Customers Payment Transactions</Text>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : transactions.length === 0 ? (
                <Text style={styles.noDataText}>No transactions found.</Text>
            ) : (
                <View style={styles.tableContainer}>
                    {/* Table Header */}
                    <View style={styles.tableRow}>
                        <Text style={styles.tableHeader}>Trans. ID</Text>
                        <Text style={styles.tableHeader}>Cust. ID</Text>
                        <Text style={styles.tableHeader}>Method</Text>
                        <Text style={styles.tableHeader}>Amount</Text>
                        <Text style={styles.tableHeader}>Date</Text>
                    </View>
                    {/* Table Rows */}
                    {transactions.map((transaction, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={styles.tableCell}>{transaction.transaction_id}</Text>
                            <Text style={styles.tableCell}>{transaction.customer_id}</Text>
                            <Text style={styles.tableCell}>{transaction.payment_method}</Text>
                            <Text style={styles.tableCell}>₹{parseFloat(transaction.payment_amount).toFixed(2)}</Text>
                            <Text style={styles.tableCell}>
                                {new Date(transaction.payment_date).toLocaleDateString()}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    datePickerButton: {
        backgroundColor: '#007bff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    datePickerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    filterButton: {
        backgroundColor: '#28a745',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    filterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#6c757d',
    },
    errorText: {
        fontSize: 16,
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
    noDataText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    },
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tableHeader: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
});

export default TransactionsPage;