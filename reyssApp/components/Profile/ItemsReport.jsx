import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

  useEffect(() => {
    fetchUniqueRoutes();
    fetchItemReport();
  }, [selectedDate]); // Fetch data only when date changes

  const fetchUniqueRoutes = async () => {
    setLoadingUniqueRoutes(true);
    setErrorUniqueRoutes(null);
    try {
      const response = await axios.get(`http://${ipAddress}:8090/get-unique-routes`);
      console.log("Unique Routes Response:", response.data);
      if (response.status === 200) {
        setUniqueRoutes(["All Routes", ...response.data.routes]);
      } else {
        setErrorUniqueRoutes(`Failed to fetch unique routes: Status ${response.status}`);
      }
    } catch (err) {
      setErrorUniqueRoutes("Error fetching unique routes. Please check your network.");
      console.error("Error fetching unique routes:", err);
    } finally {
      setLoadingUniqueRoutes(false);
    }
  };

  const fetchItemReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await checkTokenAndRedirect(navigation);
      const token = await AsyncStorage.getItem("token");
      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");

      const response = await axios.get(`http://${ipAddress}:8090/item-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: formattedDate }, // Fetch all data for the date
      });

      console.log("Item Report Response:", response.data);

      if (response.status === 200) {
        const data = response.data.itemReportData || [];
        setReportData(data);
        if (data.length === 0) {
          setError("No data available for the selected date.");
        }
      } else {
        setError(`Failed to fetch report: Status ${response.status}`);
      }
    } catch (err) {
      console.error("Error fetching item report:", err);
      setError("Failed to fetch item report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigation, selectedDate]);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (date) => {
    hideDatePicker();
    setSelectedDate(date);
  };

  const exportToExcel = async () => {
    if (!reportData || reportData.length === 0) {
      Alert.alert("No data to export", "Please ensure there is report data to export.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Route", "Product Name", "Quantity"],
      ...reportData.map((item) => [item.route, item.product_name, item.total_quantity]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "ItemReport");
    const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const uri = FileSystem.cacheDirectory + "ItemReport.xlsx";

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
    save(
      uri,
      `ItemReport_${selectedRoute.replace(/\s+/g, '_')}_${formattedDate}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Item Report"
    );
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
        ToastAndroid.show(`Failed to save ${reportType}. Please try again.`, ToastAndroid.SHORT);
      }
    } else {
      shareAsync(uri, reportType);
    }
  };

  // Filter report data based on selected route
  const filteredReportData = selectedRoute === "All Routes"
    ? reportData
    : reportData.filter((item) => item.route === selectedRoute);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
          <Text style={styles.dateText}>{moment(selectedDate).format("DD/MM/YYYY")}</Text>
        </TouchableOpacity>
        <View style={styles.routePickerContainer}>
          {loadingUniqueRoutes ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : errorUniqueRoutes ? (
            <Text style={styles.error}>{errorUniqueRoutes}</Text>
          ) : (
            <Picker
              selectedValue={selectedRoute}
              onValueChange={(itemValue) => setSelectedRoute(itemValue)}
              style={styles.routePicker}
            >
              {uniqueRoutes.map((route) => (
                <Picker.Item key={route} label={route} value={route} />
              ))}
            </Picker>
          )}
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={selectedDate}
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />

      <Text style={styles.title}>Item Order Report</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : filteredReportData.length > 0 ? (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 1 }]}>Route</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Product Name</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Qty</Text>
          </View>
          {filteredReportData.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 1 }]}>{item.route}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{item.product_name}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{item.total_quantity}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.noData}>No data found for selected date and route</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  dateButton: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#333",
  },
  routePickerContainer: {
    flex: 1,
    marginHorizontal: 10,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    justifyContent: "center",
  },
  routePicker: {
    height: 50,
    color: "#333",
  },
  exportButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  loader: {
    marginTop: 50,
  },
  error: {
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    marginTop: 20,
  },
  noData: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F7F7F7",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerCell: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  cell: {
    fontSize: 15,
    color: "#555",
    paddingHorizontal: 10,
  },
});

export default ItemsReport;