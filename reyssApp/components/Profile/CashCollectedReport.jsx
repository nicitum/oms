import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import axios from 'axios';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ipAddress } from '../../urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker'; // Added Picker import

const CashCollectedReport = () => {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date()); // Default to today
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [routeData, setRouteData] = useState({}); // Store routes by customer ID
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [errorRoute, setErrorRoute] = useState(null);
    const [uniqueRoutes, setUniqueRoutes] = useState(['All Routes']); // Default with "All Routes"
    const [loadingUniqueRoutes, setLoadingUniqueRoutes] = useState(false);
    const [errorUniqueRoutes, setErrorUniqueRoutes] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState('All Routes'); // Default route filter

    // Fetch all transactions and filter cash transactions locally
    const fetchTransactions = async () => {
        try {
            const response = await axios.get(`http://${ipAddress}:8090/fetch-all-payment-transactions`);
            const allTransactions = response.data.transactions;

            // Filter only cash transactions
            const cashTransactions = allTransactions.filter(t => t.payment_method.toLowerCase() === 'cash');

            // Fetch customer names and routes for each cash transaction
            const transactionsWithNamesAndRoutes = await Promise.all(
                cashTransactions.map(async (transaction) => {
                    let customerName = 'Unknown';
                    try {
                        const nameResponse = await axios.get(`http://${ipAddress}:8090/fetch-names?customer_id=${transaction.customer_id}`);
                        customerName = nameResponse.data.name || 'Unknown';
                    } catch (err) {
                        console.warn(`Error fetching name for customer_id ${transaction.customer_id}:`, err);
                    }

                    if (!routeData[transaction.customer_id]) {
                        try {
                            const routeResponse = await axios.get(`http://${ipAddress}:8090/fetch-routes?customer_id=${transaction.customer_id}`);
                            setRouteData(prev => ({
                                ...prev,
                                [transaction.customer_id]: routeResponse.data.route || 'N/A'
                            }));
                        } catch (err) {
                            console.warn(`Error fetching route for customer_id ${transaction.customer_id}:`, err);
                            setRouteData(prev => ({
                                ...prev,
                                [transaction.customer_id]: 'N/A'
                            }));
                        }
                    }

                    return { ...transaction, customerName };
                })
            );

            setTransactions(transactionsWithNamesAndRoutes);
            setError(null);
        } catch (err) {
            console.error("Error fetching transactions:", err);
            setError(err.message);
            setTransactions([]);
            Alert.alert("Error", `Failed to load cash transactions: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch unique routes
    const fetchUniqueRoutes = async () => {
        setLoadingUniqueRoutes(true);
        setErrorUniqueRoutes(null);
        try {
            const response = await axios.get(`http://${ipAddress}:8090/get-unique-routes`);
            if (response.status === 200) {
                setUniqueRoutes(['All Routes', ...response.data.routes]);
            } else {
                setErrorUniqueRoutes(`Failed to fetch unique routes: Server responded with status ${response.status}`);
            }
        } catch (err) {
            setErrorUniqueRoutes("Error fetching unique routes. Please check your network.");
            console.error("Error fetching unique routes:", err);
        } finally {
            setLoadingUniqueRoutes(false);
        }
    };

    // Filter transactions by date and route
    useEffect(() => {
        let filtered = transactions;

        // Filter by date
        if (selectedDate) {
            filtered = filtered.filter(t => 
                moment(t.payment_date).isSame(selectedDate, 'day')
            );
        }

        // Filter by route
        if (selectedRoute !== 'All Routes') {
            filtered = filtered.filter(t => 
                routeData[t.customer_id] === selectedRoute
            );
        }

        setFilteredTransactions(filtered);
    }, [transactions, selectedDate, selectedRoute]);

    // Fetch data on mount
    useEffect(() => {
        fetchTransactions();
        fetchUniqueRoutes();
    }, []);

    // Date picker handlers
    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);
    const handleConfirmDate = (date) => {
        setSelectedDate(date);
        hideDatePicker();
    };

    // Calculate total cash collected
    const totalCashCollected = filteredTransactions.reduce(
        (sum, t) => sum + parseFloat(t.payment_amount || 0),
        0
    ).toFixed(2);

    // Export to Excel
    const exportToExcel = async () => {
        try {
            const exportData = filteredTransactions.map(t => ({
                'Customer ID': t.customer_id,
                'Customer Name': t.customerName,
                'Route': routeData[t.customer_id] || 'N/A',
                'Cash Collected': `₹${parseFloat(t.payment_amount).toFixed(2)}`,
                'Date': moment(t.payment_date).format('YYYY-MM-DD'),
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Cash Collected');
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const uri = FileSystem.cacheDirectory + 'Cash_Collected_Report.xlsx';
            await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
            await save(uri, 'Cash_Collected_Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cash Collected Report');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            Alert.alert('Error', 'Failed to export cash collected report');
        }
    };

    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem('cashReportDirectoryUri');
                if (!directoryUriToUse) {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        directoryUriToUse = permissions.directoryUri;
                        await AsyncStorage.setItem('cashReportDirectoryUri', directoryUriToUse);
                    } else {
                        await Sharing.shareAsync(uri);
                        return;
                    }
                }
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                await FileSystem.StorageAccessFramework.createFileAsync(directoryUriToUse, filename, mimetype)
                    .then(newUri => FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 }));
                Alert.alert('Success', `${reportType} Saved Successfully!`);
            } catch (error) {
                console.error("Error saving file:", error);
                Alert.alert('Error', `Failed to save ${reportType}.`);
            }
        } else {
            await Sharing.shareAsync(uri);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header with Date Picker, Route Filter, Total Cash, and Export */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={showDatePicker} style={styles.datePickerButton}>
                    <Text style={styles.datePickerText}>
                        {selectedDate ? moment(selectedDate).format('YYYY-MM-DD') : 'Select Date'}
                    </Text>
                </TouchableOpacity>
                <View style={styles.routeFilterContainer}>
                    <Text style={styles.filterLabel}>Route:</Text>
                    <Picker
                        selectedValue={selectedRoute}
                        style={styles.routePicker}
                        onValueChange={(itemValue) => setSelectedRoute(itemValue)}
                        dropdownIconColor={'#777'}
                    >
                        {uniqueRoutes.map((route, index) => (
                            <Picker.Item key={index} label={route} value={route} />
                        ))}
                    </Picker>
                </View>
                <Text style={styles.totalCashText}>Total: ₹{totalCashCollected}</Text>
                <TouchableOpacity onPress={exportToExcel} style={styles.exportButton}>
                    <Text style={styles.exportText}>Export</Text>
                </TouchableOpacity>
            </View>

            {/* Date Picker Modal */}
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            <Text style={styles.headerText}>Cash Collected Report</Text>

            {loading || loadingRoute || loadingUniqueRoutes ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.loadingText}>Loading cash collected data...</Text>
                </View>
            ) : error || errorRoute || errorUniqueRoutes ? (
                <Text style={styles.errorText}>{error || errorRoute || errorUniqueRoutes}</Text>
            ) : filteredTransactions.length === 0 ? (
                <Text style={styles.noDataText}>No cash transactions found.</Text>
            ) : (
                <View style={styles.tableContainer}>
                    {/* Table Header */}
                    <View style={styles.tableRow}>
                        <Text style={styles.tableHeader}>Customer ID</Text>
                        <Text style={styles.tableHeader}>Route</Text>
                        <Text style={styles.tableHeader}>Cash Collected</Text>
                    </View>
                    {/* Table Rows */}
                    {filteredTransactions.map((transaction, index) => (
                        <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                            <Text style={styles.tableCell}>{transaction.customer_id}</Text>
                            <Text style={styles.tableCell}>{routeData[transaction.customer_id] || 'N/A'}</Text>
                            <Text style={styles.tableCell}>₹{parseFloat(transaction.payment_amount).toFixed(2)}</Text>
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
    },
    contentContainer: {
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        flexWrap: 'wrap', // Allow wrapping if needed
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
    routeFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabel: {
        fontSize: 14,
        color: '#2c3e50',
        marginRight: 8,
        fontWeight: '500',
    },
    routePicker: {
        height: 50,
        width: 100,
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        borderWidth: 1,
        borderRadius: 5,
    },
    totalCashText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#28a745',
        textAlign: 'center',
        flex: 1,
    },
    exportButton: {
        backgroundColor: '#28a745',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    exportText: {
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    evenRow: {
        backgroundColor: '#ffffff',
    },
    oddRow: {
        backgroundColor: '#fafbfc',
    },
    tableHeader: {
        flex: 1,
        fontSize: 15,
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

export default CashCollectedReport;