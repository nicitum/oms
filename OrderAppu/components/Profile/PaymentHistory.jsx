import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const PaymentHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null); // For date filter
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false); // Date picker modal visibility
    const [paymentFilter, setPaymentFilter] = useState('All'); // Filter: All, Cash, Online

    // Fetch customer_id and payment transactions
    const fetchTransactions = async () => {
        try {
            // Get customer_id from JWT token
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token not found");
            }
            const decoded = jwtDecode(token);
            const fetchedCustomerId = decoded.id;
            console.log("Fetched Customer ID:", fetchedCustomerId);

            // Build query params
            let url = `http://192.168.1.13:8090/fetch-payment-transactions?customer_id=${fetchedCustomerId}`;
            if (selectedDate) {
                const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
                url += `&date=${formattedDate}`;
            }
            if (paymentFilter !== 'All') {
                url += `&payment_method=${paymentFilter.toLowerCase()}`;
            }

            // Fetch transactions from API
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Transactions fetched:", data.transactions);
            setTransactions(data.transactions);
            setError(null);
        } catch (err) {
            console.error("Error fetching transactions:", err);
            setError(err.message);
            setTransactions([]);
            Alert.alert("Error", `Failed to load transactions: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when component mounts or filters change
    useEffect(() => {
        fetchTransactions();
    }, [selectedDate, paymentFilter]);

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

            <Text style={styles.headerText}>Your Payment Transactions</Text>

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
                                {new Date(transaction.payment_date).toLocaleDateString('en-gb')}
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

export default PaymentHistory;