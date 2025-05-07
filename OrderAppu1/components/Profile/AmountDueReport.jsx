import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  Platform,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import moment from "moment";
import XLSX from "xlsx";
import Icon from "react-native-vector-icons/MaterialIcons";
import { ipAddress } from "../../urls";

const AmountDueReport = ({ navigation }) => {
  const [creditLimitData, setCreditLimitData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [totalAmountDue, setTotalAmountDue] = useState(0);
  const [totalAmountPaid, setTotalAmountPaid] = useState(0);
  const [isTotalDueLoading, setIsTotalDueLoading] = useState(false);
  const [totalDueError, setTotalDueError] = useState(null);
  const primaryColor = "#003366";

  const checkTokenAndRedirect = async (navigation) => {
    const token = await AsyncStorage.getItem("userAuthToken");
    if (!token) {
      navigation.navigate("Login");
      throw new Error("No token found");
    }
    return token;
  };

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setSelectedDate(date);
    filterDataByDateAndSearch(date, searchQuery);
    hideDatePicker();
  };

  const fetchTotalAmountDue = useCallback(async () => {
    setIsTotalDueLoading(true);
    setTotalDueError(null);
    try {
      const token = await checkTokenAndRedirect(navigation);
      const response = await fetch(`http://${ipAddress}:8091/admin/total-amount-due`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const message = `Failed to fetch total amount due. Status: ${response.status}`;
        throw new Error(message);
      }
      const data = await response.json();
      setTotalAmountDue(data.totalAmountDue.toFixed(2));
    } catch (error) {
      console.error("Error fetching total amount due:", error);
      setTotalDueError("Error fetching total amount due.");
      setTotalAmountDue('Error');
    } finally {
      setIsTotalDueLoading(false);
    }
  }, [navigation]);


   const fetchTotalAmountPaid = useCallback(async () => {
      try {
        const token = await checkTokenAndRedirect(navigation);
        const response = await fetch(`http://${ipAddress}:8091/admin/total-amount-paid`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const message = `Failed to fetch total amount paid. Status: ${response.status}`;
          throw new Error(message);
        }
        const data = await response.json();
        setTotalAmountPaid(data.totalAmountPaid);
        
      } catch (error) {
        console.error("Error fetching total amount paid:", error);
       
      } 
    }, [navigation]);

  const fetchCreditLimitData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const response = await axios.get(`http://${ipAddress}:8091/amount_due`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status !== 200) {
        throw new Error("Failed to fetch amount due data");
      }

      const data = response.data.creditLimitData || [];
      setCreditLimitData(data);
      filterDataByDateAndSearch(selectedDate, searchQuery, data);
    } catch (err) {
      console.error("Error fetching amount due data:", err);
      setError("Failed to fetch amount due data. Please try again.");
      Alert.alert("Error", "Failed to fetch amount due data.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, searchQuery]);

  const filterDataByDateAndSearch = (date, query, data = creditLimitData) => {
    const filterDateFormatted = moment(date).format("YYYY-MM-DD");
    let filtered = data;

    filtered = filtered.filter(item => {
      const cashDate = item.cash_paid_date ? moment.unix(item.cash_paid_date).format("YYYY-MM-DD") : null;
      const onlineDate = item.online_paid_date ? moment.unix(item.online_paid_date).format("YYYY-MM-DD") : null;
      return (!cashDate && !onlineDate) || cashDate === filterDateFormatted || onlineDate === filterDateFormatted;
    });

    if (query) {
      filtered = filtered.filter(item =>
        item.customer_name.toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    filterDataByDateAndSearch(selectedDate, text);
  };

  const calculateTotalAmountPaid = (item) => {
    const cash = parseFloat(item.amount_paid_cash || 0);
    const online = parseFloat(item.amount_paid_online || 0);
    return (cash + online).toFixed(2);
  };

  const exportToExcel = async () => {
    if (!filteredData.length) {
      Alert.alert("No Data", "No data available to export.");
      return;
    }
    try {
      const dataForExport = filteredData.map(item => ({
        "Customer ID": item.customer_id,
        "Customer Name": item.customer_name,
        "Credit Limit": item.credit_limit,
        "Amount Paid Cash": item.amount_paid_cash || 0,
        "Cash Paid Date": item.cash_paid_date
          ? moment.unix(item.cash_paid_date).format("YYYY-MM-DD")
          : "N/A",
        "Amount Paid Online": item.amount_paid_online || 0,
        "Online Paid Date": item.online_paid_date
          ? moment.unix(item.online_paid_date).format("YYYY-MM-DD")
          : "N/A",
        "Total Amount Paid": calculateTotalAmountPaid(item),
        "Amount Due": item.amount_due || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(dataForExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Amount Due Report");

      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const uri = FileSystem.cacheDirectory + `Amount_Due_Report_${moment().format("YYYYMMDD_HHmmss")}.xlsx`;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            `Amount_Due_Report_${moment().format("YYYYMMDD_HHmmss")}.xlsx`,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(newUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert("Success", "Excel Report Saved Successfully!");
        } else {
          await Sharing.shareAsync(uri, {
            dialogTitle: "Share Amount Due Report",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            UTI: "com.microsoft.excel.xlsx",
          });
          Alert.alert("Success", "Excel Report Shared!");
        }
      } else {
        await Sharing.shareAsync(uri, {
          dialogTitle: "Share Amount Due Report",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          UTI: "com.microsoft.excel.xlsx",
        });
        Alert.alert("Success", "Excel Report Shared!");
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      Alert.alert("Error", "Failed to export report to Excel.");
    }
  };

  useEffect(() => {
    fetchCreditLimitData();
    fetchTotalAmountDue();
    fetchTotalAmountPaid();
  }, [fetchCreditLimitData, fetchTotalAmountDue]);

  const renderReportItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Customer:</Text>
          <Text style={styles.cardValue}>{item.customer_name}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Credit Limit:</Text>
          <Text style={styles.cardValue}>₹{item.credit_limit}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Total Paid:</Text>
          <Text style={styles.cardValue}>₹{calculateTotalAmountPaid(item)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Amount Due:</Text>
          <Text style={styles.cardValue}>₹{item.amount_due || 0}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Cash Paid:</Text>
          <Text style={styles.cardValue}>₹{item.amount_paid_cash || 0}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Cash Date:</Text>
          <Text style={styles.cardValue}>
            {item.cash_paid_date ? moment.unix(item.cash_paid_date).format("DD/MM/YYYY") : "N/A"}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Online Paid:</Text>
          <Text style={styles.cardValue}>₹{item.amount_paid_online || 0}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Online Date:</Text>
          <Text style={styles.cardValue}>
            {item.online_paid_date ? moment.unix(item.online_paid_date).format("DD/MM/YYYY") : "N/A"}
          </Text>
        </View>
      </View>
    </View>
  );

return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Amount Due Report</Text>
        </View>
        <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
                <Icon name="calendar-today" size={20} color="#fff" />
                <Text style={styles.dateButtonText}>{moment(selectedDate).format("DD/MM/YYYY")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
                <Icon name="file-download" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
            <Icon name="search" size={24} color="#666" style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                placeholder="Search by customer name"
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor="#999"
            />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>

        <View style={[styles.totalCard, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.totalLabel}>Total Amount Paid</Text>
                {isTotalDueLoading ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                ) : totalDueError ? (
                    <Text style={[styles.totalValue, { color: '#dc3545' }]}>Error</Text>
                ) : (
                    <Text style={styles.totalValue}>₹{totalAmountPaid}</Text>
                )}
            </View>

            <View style={[styles.totalCard, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.totalLabel}>Total Amount Due</Text>
                {isTotalDueLoading ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                ) : totalDueError ? (
                    <Text style={[styles.totalValue, { color: 'red' }]}>Error</Text>
                ) : (
                    <Text style={[styles.totalValue, { color: 'red' }]}>₹{totalAmountDue}</Text>
                )}
            </View>
            
        </View>
        <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            date={selectedDate}
            onConfirm={handleConfirmDate}
            onCancel={hideDatePicker}
        />
        {loading ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={styles.loadingText}>Loading report...</Text>
            </View>
        ) : error ? (
            <View style={styles.errorContainer}>
                <Icon name="error" size={40} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchCreditLimitData}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <FlatList
                data={filteredData}
                renderItem={renderReportItem}
                keyExtractor={(item, index) => index.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="inbox" size={40} color={primaryColor} />
                        <Text style={styles.emptyText}>No data found for the selected criteria</Text>
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
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#003366",
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    flexWrap: "wrap",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#003366",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 8,
    fontWeight: "600",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#003366",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 8,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 3,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },
  totalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#003366",
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#28a745",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#003366",
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#dc3545",
    textAlign: "center",
    marginVertical: 10,
  },
  retryButton: {
    backgroundColor: "#003366",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
    width: 120,
  },
  cardValue: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#003366",
    marginTop: 10,
    textAlign: "center",
  },
});

export default AmountDueReport;