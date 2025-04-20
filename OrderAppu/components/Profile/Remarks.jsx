import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity // Added for button
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../urls";
import { Picker } from '@react-native-picker/picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastAndroid, Alert } from 'react-native'; // Added necessary imports

const Remarks = () => {
    const [remarksData, setRemarksData] = useState([]);
    const [loadingRemarks, setLoadingRemarks] = useState(true);
    const [errorRemarks, setErrorRemarks] = useState(null);

    const [routeData, setRouteData] = useState(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [errorRoute, setErrorRoute] = useState(null);

    const [uniqueRoutes, setUniqueRoutes] = useState([]);
    const [loadingUniqueRoutes, setLoadingUniqueRoutes] = useState(false);
    const [errorUniqueRoutes, setErrorUniqueRoutes] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState("All Routes");

    // Save function from your code
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

                ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
            } catch (error) {
                console.error("Error saving file:", error);
                if (error.message.includes('permission')) {
                    await AsyncStorage.removeItem('orderReportDirectoryUri');
                }
                ToastAndroid.show(`Failed to save ${reportType}. Please try again.`, ToastAndroid.SHORT);
            }
        } else {
            shareAsync(uri, reportType);
        }
    };

    const shareAsync = async (uri, reportType) => {
        try {
            await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(`Error sharing ${reportType}:`, error);
            Alert.alert('Error', `Failed to share ${reportType}.`);
        }
    };

    // Export to Excel function
    const exportToExcel = async () => {
        try {
            // Prepare data for Excel
            const exportData = filteredRemarks.map(remark => ({
                'Customer ID': remark.customer_id,
                'Order ID': remark.order_id,
                'Route': routeData || 'N/A',
                'Remarks': remark.remarks
            }));

            // Create worksheet and workbook
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Remarks');

            // Generate Excel file
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const uri = FileSystem.cacheDirectory + 'Remarks_Report.xlsx';
            
            // Write file
            await FileSystem.writeAsStringAsync(uri, wbout, {
                encoding: FileSystem.EncodingType.Base64
            });

            // Save or share the file
            await save(uri, 'Remarks_Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Remarks Report');
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            Alert.alert('Error', 'Failed to export remarks to Excel');
        }
    };

    // Existing useEffect hooks remain the same
    useEffect(() => {
        const fetchRemarks = async () => {
            setLoadingRemarks(true);
            setErrorRemarks(null);
            try {
                const response = await axios.get(`http://${ipAddress}:8090/fetch-remarks`);
                if (response.status === 200) {
                    setRemarksData(response.data.remarks);
                } else {
                    setErrorRemarks(`Failed to fetch remarks: Server responded with status ${response.status}`);
                }
            } catch (err) {
                setErrorRemarks("Error fetching remarks. Please check your network.");
                console.error("Error fetching remarks:", err);
            } finally {
                setLoadingRemarks(false);
            }
        };
        fetchRemarks();
    }, []);

    useEffect(() => {
        const fetchRoute = async () => {
            if (remarksData.length > 0) {
                setLoadingRoute(true);
                setErrorRoute(null);
                const customerId = remarksData[0].customer_id;

                try {
                    const response = await axios.get(`http://${ipAddress}:8090/fetch-routes?customer_id=${customerId}`);
                    if (response.status === 200) {
                        setRouteData(response.data.route);
                    } else {
                        setErrorRoute(`Failed to fetch route: Server responded with status ${response.status}`);
                    }
                } catch (err) {
                    setErrorRoute("Error fetching route. Please check your network.");
                    console.error("Error fetching route:", err);
                } finally {
                    setLoadingRoute(false);
                }
            }
        };
        fetchRoute();
    }, [remarksData]);

    useEffect(() => {
        const fetchUniqueRoutes = async () => {
            setLoadingUniqueRoutes(true);
            setErrorUniqueRoutes(null);
            try {
                const response = await axios.get(`http://${ipAddress}:8090/get-unique-routes`);
                if (response.status === 200) {
                    setUniqueRoutes(["All Routes", ...response.data.routes]);
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
        fetchUniqueRoutes();
    }, []);

    const filteredRemarks = selectedRoute === "All Routes"
        ? remarksData
        : remarksData.filter(remark => routeData === selectedRoute);

    const isLoading = loadingRemarks || loadingRoute || loadingUniqueRoutes;
    const hasError = errorRemarks || errorRoute || errorUniqueRoutes;

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading Data...</Text>
            </View>
        );
    }

    if (hasError) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Error: {errorRemarks || errorRoute || errorUniqueRoutes}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
            <View style={styles.container}>
                <View style={styles.headerContainer}>
                    <View style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>Filter Route:</Text>
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
                    <TouchableOpacity 
                        style={styles.exportButton}
                        onPress={exportToExcel}
                    >
                        <Text style={styles.exportButtonText}>Export to Excel</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.tableHeaderCell, styles.headerCell, styles.customerIdHeader]}>Customer ID</Text>
                        <Text style={[styles.tableHeaderCell, styles.headerCell, styles.orderIdHeader]}>Order ID</Text>
                        <Text style={[styles.tableHeaderCell, styles.headerCell, styles.routeHeader]}>Route</Text>
                        <Text style={[styles.tableHeaderCell, styles.headerCell, styles.remarksHeader]}>Remarks</Text>
                    </View>

                    {filteredRemarks.map((remark, index) => (
                        <View style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]} key={remark.id}>
                            <Text style={[styles.tableCell, styles.customerIdCell]}>{remark.customer_id}</Text>
                            <Text style={[styles.tableCell, styles.orderIdCell]}>{remark.order_id}</Text>
                            <Text style={[styles.tableCell, styles.routeCell]}>{routeData || "N/A"}</Text>
                            <Text style={[styles.tableCell, styles.remarksCell]}>{remark.remarks}</Text>
                        </View>
                    ))}
                </View>

                {filteredRemarks.length === 0 && !isLoading && !hasError && (
                    <Text style={styles.emptyText}>No remarks found for the selected route.</Text>
                )}
                {errorRoute && remarksData.length > 0 && (
                    <Text style={styles.routeErrorText}>Error fetching Route: {errorRoute}. Route information may be unavailable.</Text>
                )}
                {!routeData && remarksData.length > 0 && !errorRoute && (
                    <Text style={styles.noRouteText}>Route not available for Customer ID: {remarksData[0].customer_id} </Text>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    // Existing styles remain the same, adding new styles for export button
    scrollContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingVertical: 25,
    },
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabel: {
        fontSize: 16,
        color: '#2c3e50',
        marginRight: 8,
        fontWeight: '500',
    },
    routePicker: {
        height: 50,
        width: 150,
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        borderWidth: 1,
        borderRadius: 8,
        color: '#2c3e50',
    },
    exportButton: {
        backgroundColor: '#28a745', // Green color for export button
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        elevation: 2,
    },
    exportButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Rest of the existing styles...
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    errorText: {
        fontSize: 16,
        color: '#dc3545',
        textAlign: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginTop: 20,
    },
    table: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 20,
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#ffd700',
        paddingVertical: 16,
        borderBottomWidth: 0,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eef0f2',
    },
    evenRow: {
        backgroundColor: '#ffffff',
    },
    oddRow: {
        backgroundColor: '#fafbfc',
    },
    tableHeaderCell: {
        fontWeight: '600',
        fontSize: 15,
        color: '#000000',
        paddingHorizontal: 15,
        textAlign: 'left',
    },
    headerCell: {
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    customerIdHeader: { flex: 1.5 },
    orderIdHeader: { flex: 1.5 },
    routeHeader: { flex: 2 },
    remarksHeader: { flex: 3 },
    tableCell: {
        fontSize: 14,
        color: '#495057',
        paddingHorizontal: 15,
        lineHeight: 22,
        textAlign: 'left',
    },
    customerIdCell: { flex: 1.5 },
    orderIdCell: { flex: 1.5 },
    routeCell: { flex: 2 },
    remarksCell: { flex: 3 },
    emptyText: {
        fontSize: 15,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 25,
        fontStyle: 'italic',
    },
    routeErrorText: {
        fontSize: 15,
        color: '#ff9800',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
    },
    noRouteText: {
        fontSize: 15,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
    },
});

export default Remarks;