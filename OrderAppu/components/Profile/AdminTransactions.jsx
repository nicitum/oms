import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity, TextInput, Platform, ToastAndroid } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../urls';

const AdminTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch all payment transactions and customer names
    const fetchTransactions = async () => {
        try {
            let url = `http://${ipAddress}:8090/fetch-all-payment-transactions`;
            if (selectedDate) {
                const formattedDate = selectedDate.toISOString().split('T')[0];
                url += `?date=${formattedDate}`;
            }
            if (paymentFilter !== 'All') {
                url += selectedDate ? `&payment_method=${paymentFilter.toLowerCase()}` : `?payment_method=${paymentFilter.toLowerCase()}`;
            }

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

            const transactionsWithNames = await Promise.all(
                data.transactions.map(async (transaction) => {
                    try {
                        const nameResponse = await fetch(
                            `http://${ipAddress}:8090/fetch-names?customer_id=${transaction.customer_id}`,
                            {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            }
                        );

                        if (!nameResponse.ok) {
                            const errorData = await nameResponse.json();
                            console.warn(`No name found for customer_id ${transaction.customer_id}: ${errorData.message}`);
                            return { ...transaction, customerName: 'Unknown' };
                        }

                        const nameData = await nameResponse.json();
                        return { ...transaction, customerName: nameData.name };
                    } catch (err) {
                        console.error(`Error fetching name for customer_id ${transaction.customer_id}:`, err);
                        return { ...transaction, customerName: 'Unknown' };
                    }
                })
            );

            console.log("Transactions with names:", transactionsWithNames);
            setTransactions(transactionsWithNames);
            filterTransactions(transactionsWithNames, searchQuery);
            setError(null);
        } catch (err) {
            console.error("Error fetching transactions:", err);
            setError(err.message);
            setTransactions([]);
            setFilteredTransactions([]);
            Alert.alert("Error", `Failed to load transactions: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Filter transactions by search query
    const filterTransactions = (data, query) => {
        if (!query) {
            setFilteredTransactions(data);
            return;
        }
        const filtered = data.filter(transaction =>
            transaction.customerName.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredTransactions(filtered);
    };

    // Handle search input change
    const handleSearch = (text) => {
        setSearchQuery(text);
        filterTransactions(transactions, text);
    };

    // Export to Excel
    const exportToExcel = async () => {
        if (!filteredTransactions || filteredTransactions.length === 0) {
            Alert.alert("No Data", "There are no transactions to export.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Transaction ID", "Customer Name", "Payment Method", "Amount", "Date"],
            ...filteredTransactions.map(t => [
                t.transaction_id,
                t.customerName,
                t.payment_method,
                parseFloat(t.payment_amount).toFixed(2),
                new Date(t.payment_date).toLocaleDateString(),
            ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "AdminTransactions");
        const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
        const uri = FileSystem.cacheDirectory + "AdminTransactionsReport.xlsx";

        await FileSystem.writeAsStringAsync(uri, wbout, {
            encoding: FileSystem.EncodingType.Base64,
        });

        save(uri, "TransactionsReport.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Admin Transactions Report");
    };

    // Save function
    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem('orderReportDirectoryUri');

                if (!directoryUriToUse) {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        directoryUriToUse = permissions.directoryUri;
                        await AsyncStorage.setItem('orderReportDirectoryUri', directoryUriToUse);
                    } else {
                        shareAsync(uri, reportType);
                        return;
                    }
                }

                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    directoryUriToUse,
                    filename,
                    mimetype
                );
                await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });

                if (Platform.OS === 'android') {
                    ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Success', `${reportType} Saved Successfully!`);
                }
            } catch (error) {
                console.error("Error saving file:", error);
                if (error.message.includes('permission')) {
                    await AsyncStorage.removeItem('orderReportDirectoryUri');
                }
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`Failed to save ${reportType}. Please try again.`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Error', `Failed to save ${reportType}. Please try again.`);
                }
            }
        } else {
            shareAsync(uri, reportType);
        }
    };

    // Share function for non-Android platforms
    const shareAsync = async (uri, reportType) => {
        try {
            await Sharing.shareAsync(uri, {
                dialogTitle: `Share ${reportType}`,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                UTI: "com.microsoft.excel.xlsx",
            });
        } catch (error) {
            console.error("Error sharing file:", error);
            Alert.alert("Error", `Failed to share ${reportType}.`);
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
            {/* Header with Date Picker, Filter, and Export */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={showDatePicker} style={styles.datePickerButton}>
                    <Text style={styles.datePickerText}>
                        {selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePaymentFilter} style={styles.filterButton}>
                    <Text style={styles.filterText}>{paymentFilter}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={exportToExcel} style={styles.exportButton}>
                    <Text style={styles.exportText}>Export</Text>
                </TouchableOpacity>
            </View>

            {/* Search Input */}
            <TextInput
                style={styles.searchInput}
                placeholder="Search by Customer Name"
                value={searchQuery}
                onChangeText={handleSearch}
            />

            {/* Date Picker Modal */}
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            <Text style={styles.headerText}>All Payment Transactions</Text>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : filteredTransactions.length === 0 ? (
                <Text style={styles.noDataText}>No transactions found.</Text>
            ) : (
                <View style={styles.tableContainer}>
                    {/* Table Header */}
                    <View style={styles.tableRow}>
                        <Text style={styles.tableHeader}>Trans. ID</Text>
                        <Text style={styles.tableHeader}>Customer Name</Text>
                        <Text style={styles.tableHeader}>Method</Text>
                        <Text style={styles.tableHeader}>Amount</Text>
                        <Text style={styles.tableHeader}>Date</Text>
                    </View>
                    {/* Table Rows */}
                    {filteredTransactions.map((transaction, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={styles.tableCell}>{transaction.transaction_id}</Text>
                            <Text style={styles.tableCell}>{transaction.customerName}</Text>
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
        marginBottom: 10,
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
    exportButton: {
        backgroundColor: '#FFBF00',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    exportText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    searchInput: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 15,
        backgroundColor: '#fff',
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

export default AdminTransactions;