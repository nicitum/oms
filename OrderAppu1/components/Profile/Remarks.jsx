import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    SafeAreaView
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../urls";
import { Picker } from '@react-native-picker/picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastAndroid, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Added for icons

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

    const exportToExcel = async () => {
        try {
            const exportData = filteredRemarks.map(remark => ({
                'Customer ID': remark.customer_id,
                'Order ID': remark.order_id,
                'Route': routeData || 'N/A',
                'Remarks': remark.remarks
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Remarks');

            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const uri = FileSystem.cacheDirectory + 'Remarks_Report.xlsx';
            
            await FileSystem.writeAsStringAsync(uri, wbout, {
                encoding: FileSystem.EncodingType.Base64
            });

            await save(uri, 'Remarks_Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Remarks Report');
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            Alert.alert('Error', 'Failed to export remarks to Excel');
        }
    };

    useEffect(() => {
        const fetchRemarks = async () => {
            setLoadingRemarks(true);
            setErrorRemarks(null);
            try {
                const response = await axios.get(`http://${ipAddress}:8091/fetch-remarks`);
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
                    const response = await axios.get(`http://${ipAddress}:8091/fetch-routes?customer_id=${customerId}`);
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
                const response = await axios.get(`http://${ipAddress}:8091/get-unique-routes`);
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
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#003366" />
                    <Text style={styles.loadingText}>Loading Data...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (hasError) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Error: {errorRemarks || errorRoute || errorUniqueRoutes}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
                <View style={styles.container}>
                    <View style={styles.headerContainer}>
                        <Text style={styles.headerTitle}>Remarks Dashboard</Text>
                        <View style={styles.controlsContainer}>
                            <View style={styles.filterContainer}>
                                <Picker
                                    selectedValue={selectedRoute}
                                    style={styles.routePicker}
                                    onValueChange={(itemValue) => setSelectedRoute(itemValue)}
                                    dropdownIconColor={'#fff'}
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
                                <Ionicons name="download-outline" size={20} color="#fff" style={styles.buttonIcon} />
                                <Text style={styles.exportButtonText}>Export</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.table}>
                        <View style={styles.tableRowHeader}>
                            <Text style={[styles.tableHeaderCell, styles.customerIdHeader]}>Customer ID</Text>
                            <Text style={[styles.tableHeaderCell, styles.orderIdHeader]}>Order ID</Text>
                            <Text style={[styles.tableHeaderCell, styles.routeHeader]}>Route</Text>
                            <Text style={[styles.tableHeaderCell, styles.remarksHeader]}>Remarks</Text>
                        </View>

                        {filteredRemarks.map((remark, index) => (
                            <View 
                                style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]} 
                                key={remark.id}
                            >
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
                        <Text style={styles.routeErrorText}>Error fetching Route: {errorRoute}</Text>
                    )}
                    {!routeData && remarksData.length > 0 && !errorRoute && (
                        <Text style={styles.noRouteText}>Route not available for Customer ID: {remarksData[0].customer_id}</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    scrollContainer: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingVertical: 20,
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
        backgroundColor: '#003366',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    filterContainer: {
        flex: 1,
        marginRight: 12,
    },
    routePicker: {
        height: 50,
        width: '75%',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 8,
        color: '#003366',
        fontSize: 16,
    },
    exportButton: {
        flexDirection: 'row',
        backgroundColor: '#005b96',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        elevation: 3,
    },
    exportButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonIcon: {
        marginRight: 8,
    },
    table: {
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 20,
        overflow: 'hidden',
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#003366',
        paddingVertical: 14,
        borderBottomWidth: 0,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    evenRow: {
        backgroundColor: '#fff',
    },
    oddRow: {
        backgroundColor: '#f8f9fa',
    },
    tableHeaderCell: {
        fontWeight: '600',
        fontSize: 14,
        color: '#fff',
        paddingHorizontal: 12,
        textAlign: 'left',
        textTransform: 'uppercase',
    },
    customerIdHeader: { flex: 1.5 },
    orderIdHeader: { flex: 1.5 },
    routeHeader: { flex: 2 },
    remarksHeader: { flex: 3 },
    tableCell: {
        fontSize: 14,
        color: '#2d3748',
        paddingHorizontal: 12,
        lineHeight: 20,
        textAlign: 'left',
    },
    customerIdCell: { flex: 1.5 },
    orderIdCell: { flex: 1.5 },
    routeCell: { flex: 2 },
    remarksCell: { flex: 3 },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#4a5568',
        fontWeight: '500',
    },
    errorText: {
        fontSize: 16,
        color: '#e53e3e',
        textAlign: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginTop: 20,
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 16,
        color: '#718096',
        textAlign: 'center',
        marginTop: 24,
        fontWeight: '500',
    },
    routeErrorText: {
        fontSize: 14,
        color: '#dd6b20',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '500',
    },
    noRouteText: {
        fontSize: 14,
        color: '#718096',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '500',
    },
});

export default Remarks;