import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import axios from 'axios';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ipAddress } from '../../urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CashCollectedReport = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [routeData, setRouteData] = useState({});
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [errorRoute, setErrorRoute] = useState(null);
  const [uniqueRoutes, setUniqueRoutes] = useState(['All Routes']);
  const [loadingUniqueRoutes, setLoadingUniqueRoutes] = useState(false);
  const [errorUniqueRoutes, setErrorUniqueRoutes] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('All Routes');
  const primaryColor = '#003366';

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`http://${ipAddress}:8090/fetch-all-payment-transactions`);
      const allTransactions = response.data.transactions || [];
      const cashTransactions = allTransactions.filter(t => t.payment_method.toLowerCase() === 'cash');

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
            setLoadingRoute(true);
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
            } finally {
              setLoadingRoute(false);
            }
          }

          return { ...transaction, customerName };
        })
      );

      setTransactions(transactionsWithNamesAndRoutes);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError("Failed to load cash transactions. Please try again.");
      Alert.alert("Error", "Failed to load cash transactions.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUniqueRoutes = async () => {
    setLoadingUniqueRoutes(true);
    setErrorUniqueRoutes(null);
    try {
      const response = await axios.get(`http://${ipAddress}:8090/get-unique-routes`);
      if (response.status === 200) {
        setUniqueRoutes(['All Routes', ...response.data.routes]);
      } else {
        throw new Error(`Failed to fetch routes: Status ${response.status}`);
      }
    } catch (err) {
      setErrorUniqueRoutes("Failed to fetch routes. Please try again.");
      console.error("Error fetching unique routes:", err);
    } finally {
      setLoadingUniqueRoutes(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchUniqueRoutes();
  }, []);

  useEffect(() => {
    let filtered = transactions;
    if (selectedDate) {
      filtered = filtered.filter(t => moment(t.payment_date).isSame(selectedDate, 'day'));
    }
    if (selectedRoute !== 'All Routes') {
      filtered = filtered.filter(t => routeData[t.customer_id] === selectedRoute);
    }
    setFilteredTransactions(filtered);
  }, [transactions, selectedDate, selectedRoute, routeData]);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  const totalCashCollected = filteredTransactions.reduce(
    (sum, t) => sum + parseFloat(t.payment_amount || 0),
    0
  ).toFixed(2);

  const exportToExcel = async () => {
    if (!filteredTransactions.length) {
      Alert.alert("No Data", "No cash transactions available to export.");
      return;
    }
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
      if (Platform.OS === 'android') {
        Alert.alert('Success', 'Cash Collected Report Saved Successfully!');
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      Alert.alert('Error', 'Failed to export cash collected report.');
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
            await Sharing.shareAsync(uri, {
              dialogTitle: `Share ${reportType}`,
              mimeType: mimetype,
              UTI: 'com.microsoft.excel.xlsx',
            });
            return;
          }
        }
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUriToUse, filename, mimetype);
        await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } catch (error) {
        console.error("Error saving file:", error);
        Alert.alert('Error', `Failed to save ${reportType}.`);
      }
    } else {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share ${reportType}`,
        mimeType: mimetype,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  };

  const renderTransactionItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Customer ID:</Text>
          <Text style={styles.cardValue}>{item.customer_id}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Customer:</Text>
          <Text style={styles.cardValue}>{item.customerName}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Route:</Text>
          <Text style={styles.cardValue}>{routeData[item.customer_id] || 'N/A'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Cash Collected:</Text>
          <Text style={styles.cardValue}>₹{parseFloat(item.payment_amount).toFixed(2)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Date:</Text>
          <Text style={styles.cardValue}>{moment(item.payment_date).format('DD/MM/YYYY')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
     
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
          <Icon name="calendar-today" size={20} color="#fff" />
          <Text style={styles.dateButtonText}>{moment(selectedDate).format('DD/MM/YYYY')}</Text>
        </TouchableOpacity>
        <View style={styles.pickerContainer}>
          {loadingUniqueRoutes ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : errorUniqueRoutes ? (
            <Text style={styles.errorText}>{errorUniqueRoutes}</Text>
          ) : (
            <Picker
              selectedValue={selectedRoute}
              onValueChange={(itemValue) => setSelectedRoute(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {uniqueRoutes.map((route, index) => (
                <Picker.Item key={index} label={route} value={route} />
              ))}
            </Picker>
          )}
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
          <Icon name="file-download" size={20} color="#fff" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Cash Collected</Text>
        <Text style={styles.totalValue}>₹{totalCashCollected}</Text>
      </View>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={selectedDate}
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
      />
      {loading || loadingRoute ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={styles.loadingText}>Loading cash transactions...</Text>
        </View>
      ) : error || errorRoute || errorUniqueRoutes ? (
        <View style={styles.errorContainer}>
          <Icon name="error" size={40} color="#dc3545" />
          <Text style={styles.errorText}>{error || errorRoute || errorUniqueRoutes}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { fetchTransactions(); fetchUniqueRoutes(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item, index) => index.toString()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={40} color={primaryColor} />
              <Text style={styles.emptyText}>No cash transactions found</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#003366',
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    flexWrap: 'wrap',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003366',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 3,
    marginRight: 10,
    minWidth: 150,
  },
  picker: {
    height: 48,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003366',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#003366',
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28a745',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#003366',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginVertical: 10,
  },
  retryButton: {
    backgroundColor: '#003366',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003366',
    width: 120,
  },
  cardValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#003366',
    marginTop: 10,
    textAlign: 'center pulse',
  },
});

export default CashCollectedReport;