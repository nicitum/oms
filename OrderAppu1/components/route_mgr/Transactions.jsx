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
            const currentAdminId = decodedToken.id1;
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

            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
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
                throw new Error("No assigned users found in response");
            }
        } catch (error) {
            setError(error.message || "Error fetching assigned users.");
            setAssignedUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch transactions
    const fetchTransactions = async () => {
        setLoading(true);
        setError(null);
        try {
            if (assignedUsers.length === 0) {
                return;
            }

            const allTransactions = [];
            for (const user of assignedUsers) {
                const customerId = user.cust_id;
                let url = `http://${ipAddress}:8091/fetch-payment-transactions?customer_id=${customerId}`;
                if (selectedDate) {
                    const formattedDate = selectedDate.toISOString().split('T')[0];
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
                    console.warn(`Failed to fetch transactions for customer ${customerId}: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                if (data.transactions && data.transactions.length > 0) {
                    allTransactions.push(...data.transactions);
                }
            }

            setTransactions(allTransactions);
            if (allTransactions.length === 0) {
                setError("No transactions found for the assigned customers.");
            } else {
                setError(null);
            }
        } catch (err) {
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
                    <ActivityIndicator size="large" color="#003366" />
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
        backgroundColor: '#e6e9ef', // Light blue-gray for subtle contrast
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    datePickerButton: {
        backgroundColor: '#003366', // Deep blue accent
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    datePickerText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    filterButton: {
        backgroundColor: '#004d99', // Slightly lighter deep blue for distinction
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    filterText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    headerText: {
        fontSize: 26,
        fontWeight: '700',
        color: '#003366', // Deep blue for header
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
        color: '#4a5a6b', // Muted blue-gray for text
    },
    errorText: {
        fontSize: 16,
        color: '#cc0000', // Red for errors to stand out
        textAlign: 'center',
        marginTop: 20,
    },
    noDataText: {
        fontSize: 16,
        color: '#4a5a6b', // Muted blue-gray
        textAlign: 'center',
        marginTop: 20,
    },
    tableContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#d6deeb', // Light blue-gray for borders
    },
    tableHeader: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#003366', // Deep blue for headers
        textAlign: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 14,
        color: '#2e3b4e', // Darker blue-gray for readability
        textAlign: 'center',
    },
});

export default TransactionsPage;