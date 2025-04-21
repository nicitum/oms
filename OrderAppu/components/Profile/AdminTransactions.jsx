import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  Platform,
  ToastAndroid,
  FlatList,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
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
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transactionsWithNames = await Promise.all(
        data.transactions.map(async (transaction) => {
          try {
            const nameResponse = await fetch(
              `http://${ipAddress}:8090/fetch-names?customer_id=${transaction.customer_id}`,
              { method: 'GET', headers: { 'Content-Type': 'application/json' } }
            );

            if (!nameResponse.ok) {
              console.warn(`No name found for customer_id ${transaction.customer_id}`);
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

      setTransactions(transactionsWithNames);
      filterTransactions(transactionsWithNames, searchQuery);
      setError(null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
      setTransactions([]);
      setFilteredTransactions([]);
      ToastAndroid.show(`Failed to load transactions: ${err.message}`, ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, paymentFilter, searchQuery]);

  // Filter transactions
  const filterTransactions = useCallback((data, query) => {
    if (!query) {
      setFilteredTransactions(data);
      return;
    }
    const filtered = data.filter((transaction) =>
      transaction.customerName.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredTransactions(filtered);
  }, []);

  // Handle search
  const handleSearch = (text) => {
    setSearchQuery(text);
    filterTransactions(transactions, text);
  };

  // Export to Excel
  const exportToExcel = async () => {
    if (!filteredTransactions.length) {
      ToastAndroid.show('No transactions to export.', ToastAndroid.SHORT);
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Transaction ID', 'Customer Name', 'Payment Method', 'Amount', 'Date'],
      ...filteredTransactions.map((t) => [
        t.transaction_id,
        t.customerName,
        t.payment_method,
        parseFloat(t.payment_amount).toFixed(2),
        new Date(t.payment_date).toLocaleDateString(),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'AdminTransactions');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + 'AdminTransactionsReport.xlsx';

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    save(uri, 'TransactionsReport.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Admin Transactions Report');
  };

  // Save file
  const save = async (uri, filename, mimetype, reportType) => {
    if (Platform.OS === 'android') {
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
        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUriToUse, filename, mimetype);
        await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });

        ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
      } catch (error) {
        console.error('Error saving file:', error);
        if (error.message.includes('permission')) {
          await AsyncStorage.removeItem('orderReportDirectoryUri');
        }
        ToastAndroid.show(`Failed to save ${reportType}.`, ToastAndroid.SHORT);
      }
    } else {
      shareAsync(uri, reportType);
    }
  };

  // Share file
  const shareAsync = async (uri, reportType) => {
    try {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share ${reportType}`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      ToastAndroid.show(`Failed to share ${reportType}.`, ToastAndroid.SHORT);
    }
  };

  // Date picker handlers
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  // Toggle payment filter
  const togglePaymentFilter = () => {
    setPaymentFilter((prev) => (prev === 'All' ? 'Cash' : prev === 'Cash' ? 'Online' : 'All'));
  };

  // Fetch data on mount or filter change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Render table row
  const renderTransaction = ({ item, index }) => (
    <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }]}>
      <Text style={styles.tableCell}>{item.transaction_id}</Text>
      <Text style={styles.tableCell}>{item.customerName}</Text>
      <Text style={styles.tableCell}>{item.payment_method}</Text>
      <Text style={styles.tableCell}>₹{parseFloat(item.payment_amount).toFixed(2)}</Text>
      <Text style={styles.tableCell}>{new Date(item.payment_date).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Date Picker, Filter, and Export */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={showDatePicker} style={styles.button}>
          <Text style={styles.buttonText}>
            {selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePaymentFilter} style={styles.button}>
          <Text style={styles.buttonText}>{paymentFilter}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={exportToExcel} style={styles.button}>
          <Text style={styles.buttonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Customer Name"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
      />

      <Text style={styles.headerText}>Payment Transactions</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003366" />
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
            <Text style={styles.tableHeader}>Customer</Text>
            <Text style={styles.tableHeader}>Method</Text>
            <Text style={styles.tableHeader}>Amount</Text>
            <Text style={styles.tableHeader}>Date</Text>
          </View>
          {/* Table Rows */}
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.transaction_id.toString()}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#003366',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#1F2937',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#003366',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeader: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#003366',
    textAlign: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
  },
});

export default React.memo(AdminTransactions);