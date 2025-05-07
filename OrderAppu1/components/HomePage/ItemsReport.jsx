import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  ToastAndroid,
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import moment from "moment";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/MaterialIcons";

const ItemsReport = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [uniqueRoutes, setUniqueRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("All Routes");
  const [loadingUniqueRoutes, setLoadingUniqueRoutes] = useState(false);
  const [errorUniqueRoutes, setErrorUniqueRoutes] = useState(null);
  const primaryColor = "#003366";

  const fetchUniqueRoutes = useCallback(async () => {
    setLoadingUniqueRoutes(true);
    setErrorUniqueRoutes(null);
    try {
      const response = await axios.get(`http://${ipAddress}:8091/get-unique-routes`);
      if (response.status === 200) {
        setUniqueRoutes(["All Routes", ...response.data.routes]);
      } else {
        throw new Error(`Failed to fetch unique routes: Status ${response.status}`);
      }
    } catch (err) {
      setErrorUniqueRoutes("Failed to fetch routes. Please try again.");
      console.error("Error fetching unique routes:", err);
    } finally {
      setLoadingUniqueRoutes(false);
    }
  }, []);

  const fetchItemReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await checkTokenAndRedirect(navigation);
      const token = await AsyncStorage.getItem("token");
      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");

      const response = await axios.get(`http://${ipAddress}:8091/item-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: formattedDate },
      });

      if (response.status === 200) {
        const data = response.data.itemReportData || [];
        setReportData(data);
        if (data.length === 0) {
          setError("No data available for the selected date.");
        }
      } else {
        throw new Error(`Failed to fetch report: Status ${response.status}`);
      }
    } catch (err) {
      console.error("Error fetching item report:", err);
      setError("Failed to fetch report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigation, selectedDate]);

  useEffect(() => {
    fetchUniqueRoutes();
    fetchItemReport();
  }, [fetchUniqueRoutes, fetchItemReport]);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (date) => {
    hideDatePicker();
    setSelectedDate(date);
  };

  const exportToExcel = async () => {
    if (!filteredReportData.length) {
      Alert.alert("No Data", "No data available to export.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Route", "Product Name", "Quantity"],
        ...filteredReportData.map((item) => [item.route, item.product_name, item.total_quantity]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "ItemReport");
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const uri = FileSystem.cacheDirectory + "ItemReport.xlsx";

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
      const filename = `ItemReport_${selectedRoute.replace(/\s+/g, '_')}_${formattedDate}.xlsx`;
      save(uri, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Item Report");
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      Alert.alert("Error", "Failed to export report.");
    }
  };

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

  const save = async (uri, filename, mimetype, reportType) => {
    if (Platform.OS === "android") {
      try {
        let directoryUriToUse = await AsyncStorage.getItem("itemReportDirectoryUri");
        if (!directoryUriToUse) {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            directoryUriToUse = permissions.directoryUri;
            await AsyncStorage.setItem("itemReportDirectoryUri", directoryUriToUse);
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
        console.error("Error saving file:", error);
        if (error.message.includes("permission")) await AsyncStorage.removeItem("itemReportDirectoryUri");
        ToastAndroid.show(`Failed to save ${reportType}.`, ToastAndroid.SHORT);
      }
    } else {
      shareAsync(uri, reportType);
    }
  };

  const filteredReportData = selectedRoute === "All Routes"
    ? reportData
    : reportData.filter((item) => item.route === selectedRoute);

  const renderReportItem = ({ item, index }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Route:</Text>
          <Text style={styles.cardValue}>{item.route}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Product:</Text>
          <Text style={styles.cardValue}>{item.product_name}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Quantity:</Text>
          <Text style={styles.cardValue}>{item.total_quantity}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
          <Icon name="calendar-today" size={20} color="#fff" />
          <Text style={styles.dateButtonText}>{moment(selectedDate).format("DD/MM/YYYY")}</Text>
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
              {uniqueRoutes.map((route) => (
                <Picker.Item key={route} label={route} value={route} />
              ))}
            </Picker>
          )}
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
          <Icon name="file-download" size={20} color="#fff" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={selectedDate}
        onConfirm={handleConfirm}
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchItemReport}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReportData}
          renderItem={renderReportItem}
          keyExtractor={(item, index) => index.toString()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={40} color={primaryColor} />
              <Text style={styles.emptyText}>No data found for selected date and route</Text>
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
  pickerContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 3,
    marginRight: 10,
    minWidth: 150,
  },
  picker: {
    height: 48,
    color: "#333",
  },
  pickerItem: {
    fontSize: 16,
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
    width: 100,
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

export default ItemsReport;