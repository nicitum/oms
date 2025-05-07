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
  StatusBar,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
      let url = `http://${ipAddress}:8091/fetch-all-payment-transactions`;
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
              `http://${ipAddress}:8091/fetch-names?customer_id=${transaction.customer_id}`,
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
    <View style={styles.transactionCard}>
      <View style={styles.cardRow}>
        <MaterialIcons name="receipt" size={22} color="#003366" style={{ marginRight: 10 }} />
        <Text style={styles.transactionIdLabel}>Transaction ID:</Text>
        <Text style={styles.transactionId}>#{item.transaction_id}</Text>
      </View>
      <View style={styles.cardRow}>
        <MaterialIcons name="person" size={20} color="#666666" style={{ marginRight: 10 }} />
        <Text style={styles.label}>Customer:</Text>
        <Text style={styles.value}>{item.customerName}</Text>
      </View>
      <View style={styles.cardRow}>
        <MaterialIcons name={item.payment_method.toLowerCase() === 'cash' ? 'payments' : 'account-balance'} size={20} color={item.payment_method.toLowerCase() === 'cash' ? '#34A853' : '#4285F4'} style={{ marginRight: 10 }} />
        <Text style={styles.label}>Method:</Text>
        <Text style={[styles.value, { color: item.payment_method.toLowerCase() === 'cash' ? '#34A853' : '#4285F4', fontWeight: 'bold' }]}>{item.payment_method}</Text>
      </View>
      <View style={styles.cardRow}>
        <MaterialIcons name="attach-money" size={20} color="#059669" style={{ marginRight: 10 }} />
        <Text style={styles.label}>Amount:</Text>
        <Text style={styles.amount}>₹{parseFloat(item.payment_amount).toFixed(2)}</Text>
      </View>
      <View style={styles.cardRow}>
        <MaterialIcons name="event" size={20} color="#666666" style={{ marginRight: 10 }} />
        <Text style={styles.label}>Date:</Text>
        <Text style={styles.value}>{new Date(item.payment_date).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#003366" barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment Transactions</Text>
        <TouchableOpacity onPress={exportToExcel} style={styles.exportButton}>
          <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={showDatePicker} style={styles.datePickerButton}>
            <MaterialIcons name="calendar-today" size={20} color="#003366" />
            <Text style={styles.datePickerText}>
              {selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePaymentFilter} style={styles.filterButton}>
            <MaterialIcons name="filter-list" size={20} color="#003366" />
            <Text style={styles.filterButtonText}>{paymentFilter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003366" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
          <Text style={styles.noDataText}>No transactions found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.transaction_id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#003366',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  filterSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  datePickerText: {
    marginLeft: 8,
    color: '#003366',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    width: 120,
  },
  filterButtonText: {
    marginLeft: 8,
    color: '#003366',
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  listContainer: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 22,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    width: '100%',
    alignSelf: 'center',
    minHeight: 170,
    justifyContent: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionIdLabel: {
    fontSize: 16,
    color: '#003366',
    fontWeight: '600',
    marginRight: 6,
  },
  transactionId: {
    fontSize: 16,
    color: '#003366',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginRight: 6,
  },
  value: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  amount: {
    fontSize: 18,
    color: '#059669',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});

export default React.memo(AdminTransactions);