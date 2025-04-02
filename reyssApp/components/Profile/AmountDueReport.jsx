import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Button, TextInput, Alert, Platform, ToastAndroid, ScrollView, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ipAddress } from "../../urls"; // Ensure this is correctly set in your project
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import moment from "moment";
import XLSX from "xlsx"; // Install via `npm install xlsx`

const AmountDueReport = () => {
    const [creditLimitData, setCreditLimitData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);
    const handleConfirmDate = (date) => {
        setSelectedDate(date);
        filterDataByDateAndSearch(date, searchQuery);
        hideDatePicker();
    };

    // Fetch Credit Limit Data
    const fetchCreditLimitData = useCallback(async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const response = await axios.get(`http://${ipAddress}:8090/amount_due`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.status !== 200) {
                throw new Error("Failed to fetch credit limit data");
            }

            const data = response.data.creditLimitData;
            setCreditLimitData(data);
            filterDataByDateAndSearch(selectedDate, searchQuery, data); // Initial filter
        } catch (err) {
            console.error("Error fetching credit limit data:", err);
            setError(err.message || "Failed to fetch credit limit data.");
            Alert.alert("Error", err.message || "Failed to fetch credit limit data.");
        } finally {
            setLoading(false);
        }
    }, [selectedDate, searchQuery]);

    // Filter Data by Date and Search Query
    const filterDataByDateAndSearch = (date, query, data = creditLimitData) => {
        const filterDateFormatted = moment(date).format("YYYY-MM-DD");
        let filtered = data;

        // Filter by date
        filtered = filtered.filter(item => {
            const cashDate = item.cash_paid_date ? moment.unix(item.cash_paid_date).format("YYYY-MM-DD") : null;
            const onlineDate = item.online_paid_date ? moment.unix(item.online_paid_date).format("YYYY-MM-DD") : null;
            return (!cashDate && !onlineDate) || cashDate === filterDateFormatted || onlineDate === filterDateFormatted;
        });

        // Filter by search query
        if (query) {
            filtered = filtered.filter(item =>
                item.customer_name.toLowerCase().includes(query.toLowerCase())
            );
        }

        setFilteredData(filtered);
    };

    // Handle Search Input Change
    const handleSearch = (text) => {
        setSearchQuery(text);
        filterDataByDateAndSearch(selectedDate, text);
    };

    // Calculate Total Amount Paid
    const calculateTotalAmountPaid = (item) => {
        const cash = parseFloat(item.amount_paid_cash || 0);
        const online = parseFloat(item.amount_paid_online || 0);
        return (cash + online).toFixed(2);
    };

    // Export to Excel
    const exportToExcel = async () => {
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
                    ToastAndroid.show("Excel Report Saved Successfully!", ToastAndroid.SHORT);
                } else {
                    await Sharing.shareAsync(uri);
                    ToastAndroid.show("Excel Report Shared!", ToastAndroid.SHORT);
                }
            } else {
                await Sharing.shareAsync(uri);
                Alert.alert("Success", "Excel Report Shared!");
            }
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            Alert.alert("Error", "Failed to export report to Excel.");
        }
    };

    // Initial Fetch on Component Mount
    useEffect(() => {
        fetchCreditLimitData();
    }, [fetchCreditLimitData]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.datePickerContainer}>
                    <Button
                        title={`Date: ${selectedDate.toISOString().split("T")[0]}`}
                        onPress={showDatePicker}
                    />
                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={handleConfirmDate}
                        onCancel={hideDatePicker}
                        date={selectedDate}
                    />
                </View>
                <Button title="Export Excel Report" onPress={exportToExcel} />
            </View>

            <TextInput
                style={styles.searchInput}
                placeholder="Search by Customer Name"
                value={searchQuery}
                onChangeText={handleSearch}
            />

            <ScrollView style={styles.tableContainer}>
                {loading && <Text>Loading...</Text>}
                {error && <Text>Error: ${error}</Text>}
                {!loading && !error && filteredData.length > 0 ? (
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={styles.headerText}>Customer Name</Text>
                            <Text style={styles.headerText}>Total Paid</Text>
                            <Text style={styles.headerText}>Amount Due</Text>
                        </View>
                        {filteredData.map((item, index) => (
                            <View key={index} style={styles.tableRow}>
                                <Text style={styles.rowText}>{item.customer_name}</Text>
                                <Text style={styles.rowText}>{calculateTotalAmountPaid(item)}</Text>
                                <Text style={styles.rowText}>{item.amount_due || 0}</Text>
                            </View>
                        ))}
                    </View>
                ) : !loading && !error ? (
                    <Text>No data found for the selected criteria.</Text>
                ) : null}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
    },
    datePickerContainer: {
        flex: 1,
        marginRight: 10,
    },
    searchInput: {
        height: 40,
        borderColor: "#ccc",
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    tableContainer: {
        flex: 1,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f5f5f5",
        padding: 10,
        borderBottomWidth: 2,
        borderBottomColor: "#000",
    },
    headerText: {
        flex: 1,
        fontWeight: "bold",
        textAlign: "center",
    },
    tableRow: {
        flexDirection: "row",
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#ccc",
    },
    rowText: {
        flex: 1,
        textAlign: "center",
    },
});

export default AmountDueReport;