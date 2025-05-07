import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    Platform,
    TouchableOpacity,
    ToastAndroid,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../../urls";
import { useNavigation } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import moment from 'moment';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import Toast from "react-native-toast-message";
import { useFocusEffect } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const LOADING_SLIP_DIR_URI_KEY = 'loadingSlipDirectoryUri';

const COLORS = {
    primary: '#003366',
    secondary: '#004d99',
    accent: '#0066cc',
    background: '#f5f7fa',
    surface: '#ffffff',
    text: {
        primary: '#1a1a1a',
        secondary: '#666666',
        light: '#ffffff',
    },
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    status: {
        pending: '#ff9800',
        accepted: '#4caf50',
        altered: '#2196f3',
    }
};

const LoadingSlipSA = () => {
    const [users, setUsers] = useState([]);
    const [amOrders, setAmOrders] = useState([]);
    const [pmOrders, setPmOrders] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [adminUsersWithOrdersToday, setAdminUsersWithOrdersToday] = useState([]);
    const [adminId, setAdminId] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [orderTypeFilter, setOrderTypeFilter] = useState('AM');
    const navigation = useNavigation();
    const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);

    const showDatePicker = () => {
        setDatePickerVisible(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisible(false);
    };

    const handleConfirm = (date) => {
        setSelectedDate(moment(date).format("YYYY-MM-DD"));
        hideDatePicker();
    };

    useEffect(() => {
        const loadSavedState = async () => {
            try {
                const storedUri = await AsyncStorage.getItem(LOADING_SLIP_DIR_URI_KEY);
                if (storedUri) {
                    console.log("Loaded savedDirectoryUri from AsyncStorage:", storedUri);
                }
            } catch (e) {
                console.error("Error loading state from AsyncStorage:", e);
            }
        };
        loadSavedState();
    }, []);

    const fetchAllUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token not found. Please log in.");
            }

            const url = `http://${ipAddress}:8091/allUsers/`;
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch users: ${response.status} - ${errorText}`);
            }

            const responseJson = await response.json();
            if (responseJson && responseJson.data && Array.isArray(responseJson.data)) {
                // Filter users to only include those with role === 'user'
                const filteredUsers = responseJson.data.filter(user => user.role === 'user');
                setUsers(filteredUsers);
            } else {
                setUsers([]);
                setError("No customers found.");
            }
        } catch (fetchError) {
            setError(fetchError.message || "Failed to fetch users.");
            Toast.show({ type: 'error', text1: 'Fetch Error', text2: fetchError.message });
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAllOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("No authentication token found");

            const response = await axios.get(`http://${ipAddress}:8091/get-orders-sa?date=${selectedDate}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            console.log("Response from get-orders-sa:", response.data);

            if (!response.data || !response.data.status) {
                throw new Error(response.data?.message || "No valid data received from server");
            }

            const orders = response.data.orders;
            console.log("Fetched orders:", orders);

            setAdminOrders(orders); // Store all orders
            const amOrdersToday = orders.filter(order => order.order_type === 'AM');
            const pmOrdersToday = orders.filter(order => order.order_type === 'PM');

            setAmOrders(amOrdersToday);
            setPmOrders(pmOrdersToday);

        } catch (error) {
            const errorMessage = error.response?.data?.message ||
                error.message ||
                "Failed to fetch orders";
            setError(errorMessage);
            Toast.show({
                type: 'error',
                text1: 'Fetch Error',
                text2: errorMessage
            });
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useFocusEffect(
        useCallback(() => {
            const fetchData = async () => {
                try {
                    const userAuthToken = await checkTokenAndRedirect(navigation);
                    if (!userAuthToken) {
                        setError("User authentication token not found.");
                        setLoading(false);
                        return;
                    }

                    const decodedToken = jwtDecode(userAuthToken);
                    const currentAdminId = decodedToken.id1;
                    setAdminId(currentAdminId);

                    await Promise.all([fetchAllUsers(), fetchAllOrders()]);
                } catch (err) {
                    setError("Failed to load data. Please try again.");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();

            return () => {
                setAmOrders([]);
                setPmOrders([]);
                setUsers([]);
                setAdminOrders([]);
            };
        }, [fetchAllUsers, fetchAllOrders, navigation])
    );

    useEffect(() => {
        if (users.length && (amOrders.length || pmOrders.length)) {
            const ordersToUse = orderTypeFilter === 'AM' ? amOrders : pmOrders;
            const usersWithOrders = users.filter(user =>
                ordersToUse.some(order => order.customer_id === user.customer_id)
            );
            setAdminUsersWithOrdersToday(usersWithOrders);
            console.log("adminUsersWithOrdersToday:", usersWithOrders);
        }
    }, [users, amOrders, pmOrders, orderTypeFilter]);

    const renderItem = ({ item }) => {
        const orderForUser = adminOrders.find(order =>
            order.customer_id === item.customer_id && order.order_type === orderTypeFilter
        );
        console.log("orderForUser for", item.customer_id, ":", orderForUser);

        return (
            <View style={styles.dataRow}>
                <Text style={[styles.dataCell, { flex: 1.1 }]}>{item?.name || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 1.6 }]}>{item?.route || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 1.5 }]}>{orderForUser?.id || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 2.1 }]}>₹ {orderForUser?.total_amount?.toFixed(2) || '0.00'}</Text>
                <Text style={[styles.dataCell, { flex: 1.5 }]}>{orderForUser?.approve_status || 'N/A'}</Text>
            </View>
        );
    };

    // Rest of the component (shareAsync, save, generateExcelReport, etc.) remains unchanged
    // Include these functions as provided in your original code
    const shareAsync = async (uri, reportType) => {
        try {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: `${reportType} Report`,
                UTI: 'com.microsoft.excel.xlsx'
            });
            if (Platform.OS !== 'android') {
                Alert.alert('Success', `${reportType} Generated and Shared Successfully!`);
            }
        } catch (shareError) {
            console.error("Sharing Error:", shareError);
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Sharing ${reportType} Failed.`, ToastAndroid.SHORT);
            } else {
                Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
            }
            setError("Error sharing file.");
        }
    };

    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem(LOADING_SLIP_DIR_URI_KEY);
                if (!directoryUriToUse) {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        directoryUriToUse = permissions.directoryUri;
                        await AsyncStorage.setItem(LOADING_SLIP_DIR_URI_KEY, directoryUriToUse);
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
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Success', `${reportType} Saved Successfully!`);
                }
            } catch (error) {
                console.error("Error saving file:", error);
                if (error.message.includes('permission')) {
                    await AsyncStorage.removeItem(LOADING_SLIP_DIR_URI_KEY);
                }
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`Failed to save ${reportType}. Please try again.`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Error', `Failed to save ${reportType}. Please try again.`);
                }
            }
        } else {
            shareAsync(uri, reportType);
        }
    };

    const generateExcelReport = async (productsData, reportType, routeName = '') => {
        if (!productsData || (Array.isArray(productsData) && productsData.length === 0) || (typeof productsData === 'object' && productsData.productList.length === 0)) {
            Alert.alert("No Products", "No products to include in the loading slip.");
            return;
        }
        setLoading(true);
        try {
            const wb = XLSX.utils.book_new();
            let wsData;
            let filename;
            if (reportType === 'Loading Slip') {
                const { productList, brandTotals } = productsData;
                let totalQuantity = 0;
                let totalBaseUnitQuantity = 0;
                let totalCrates = 0;
                productList.forEach(product => {
                    totalQuantity += product.quantity;
                    totalBaseUnitQuantity += parseFloat(product.baseUnitQuantity);
                    totalCrates += product.crates;
                });
                wsData = [
                    [`${reportType} - Route ${routeName}`],
                    [],
                    ["Products", "Quantity in base units (eaches)", "Quantity in base units (kgs/lts)", "Crates"],
                    ...productList.map(product => [
                        product.name,
                        product.quantity,
                        product.baseUnitQuantity,
                        product.crates
                    ]),
                    ["Totals", totalQuantity.toFixed(2), totalBaseUnitQuantity.toFixed(2), totalCrates],
                    [],
                    ["Brand", "Total Crates"],
                    ...brandTotals.map(brandTotal => [brandTotal.brand, brandTotal.totalCrates])
                ];
                filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            } else {
                let totalQuantity = 0;
                let totalBaseUnitQuantity = 0;
                let totalCrates = 0;
                productsData.forEach(product => {
                    totalQuantity += product.quantity;
                    totalBaseUnitQuantity += parseFloat(product.baseUnitQuantity);
                    totalCrates += product.crates;
                });
                wsData = [
                    [`${reportType} - Route ${routeName}`],
                    [],
                    ["Products", "Quantity in base units (eaches)", "Quantity in base units (kgs/lts)", "Crates"],
                    ...productsData.map(product => [
                        product.name,
                        product.quantity,
                        product.baseUnitQuantity,
                        product.crates
                    ]),
                    ["Totals", totalQuantity.toFixed(2), totalBaseUnitQuantity.toFixed(2), totalCrates]
                ];
                filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            }
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, `${reportType} Data`);
            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const base64Workbook = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            if (Platform.OS === 'web') {
                const blob = new Blob([wbout], { type: mimetype });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                if (Platform.OS === 'web') {
                    Alert.alert('Success', `${reportType} Generated Successfully! File downloaded in your browser.`);
                }
            } else {
                const fileDir = FileSystem.documentDirectory;
                const fileUri = fileDir + filename;
                await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
                    encoding: FileSystem.EncodingType.Base64
                });
                if (Platform.OS === 'android') {
                    save(fileUri, filename, mimetype, reportType);
                } else {
                    try {
                        await Sharing.shareAsync(fileUri, {
                            mimeType: mimetype,
                            dialogTitle: `${reportType} Report`,
                            UTI: 'com.microsoft.excel.xlsx'
                        });
                        if (Platform.OS !== 'android') {
                            Alert.alert('Success', `${reportType} Generated and Shared Successfully!`);
                        }
                    } catch (shareError) {
                        console.error("Sharing Error:", shareError);
                        if (Platform.OS === 'android') {
                            ToastAndroid.show(`Sharing ${reportType} Failed.`, ToastAndroid.SHORT);
                        } else {
                            Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
                        }
                        setError("Error sharing file.");
                    }
                }
            }
        } catch (e) {
            console.error("Excel Generation Error:", e);
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Failed to generate ${reportType}.`, ToastAndroid.SHORT);
            } else {
                Alert.alert("Generation Failed", `Error generating Excel ${reportType.toLowerCase()}.`);
            }
            setError("Error generating Excel file.");
        } finally {
            setLoading(false);
        }
    };

    const generateDeliveryExcelReport = async (usersForRoute, routeName) => {
        const reportType = 'Delivery Slip';
        setLoading(true);
        try {
            const wb = XLSX.utils.book_new();
            const deliverySlipData = await createDeliverySlipDataForExcelForRoute(usersForRoute);
    
            // Modify headers to include newline characters (assuming headers are in deliverySlipData[3])
            deliverySlipData[3] = deliverySlipData[3].map(header => {
                if (typeof header === 'string' && header.includes(' ')) {
                    // Split by space and join with newline
                    return header.split(' ').join('\n');
                }
                return header;
            });
    
            const ws = XLSX.utils.aoa_to_sheet(deliverySlipData);
    
            // Set column widths
            if (!ws['!cols']) ws['!cols'] = [];
            ws['!cols'][0] = { wch: 30 }; // First column width
            for (let i = 1; i < deliverySlipData[3].length; i++) {
                ws['!cols'][i] = { wch: 15 }; // Increased width to accommodate wrapped text
                const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
                if (!ws[cellRef]) continue;
                ws[cellRef].s = {
                    alignment: {
                        vertical: 'center',
                        horizontal: 'center',
                        wrapText: true, // Enable text wrapping
                        textRotation: 90 // Keep rotated text
                    },
                    font: {
                        bold: true
                    }
                };
            }
    
            // Style the first header cell (Items header)
            const itemsHeaderRef = XLSX.utils.encode_cell({ r: 3, c: 0 });
            if (ws[itemsHeaderRef]) {
                ws[itemsHeaderRef].s = {
                    alignment: {
                        vertical: 'center',
                        horizontal: 'center',
                        wrapText: true // Enable text wrapping
                    },
                    font: {
                        bold: true
                    }
                };
            }
    
            // Adjust row height for the header row to fit wrapped text
            if (!ws['!rows']) ws['!rows'] = [];
            ws['!rows'][3] = { hpt: 60 };
            XLSX.utils.book_append_sheet(wb, ws, `${reportType}`);
            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const base64Workbook = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            if (Platform.OS === 'web') {
                const blob = new Blob([wbout], { type: mimetype });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                if (Platform.OS === 'web') {
                    Alert.alert('Success', `${reportType} Generated Successfully! File downloaded in your browser.`);
                }
            } else {
                const fileDir = FileSystem.documentDirectory;
                const fileUri = fileDir + filename;
                await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
                    encoding: FileSystem.EncodingType.Base64
                });
                console.log(`${reportType} File written to documentDirectory:`, fileUri);
                if (Platform.OS === 'android') {
                    save(fileUri, filename, mimetype, reportType);
                } else {
                    try {
                        await Sharing.shareAsync(fileUri, {
                            mimeType: mimetype,
                            dialogTitle: `${reportType} Report`,
                            UTI: 'com.microsoft.excel.xlsx'
                        });
                        if (Platform.OS !== 'android') {
                            Alert.alert('Success', `${reportType} Generated and Shared Successfully!`);
                        }
                    } catch (shareError) {
                        console.error(`${reportType} Sharing Error:`, shareError);
                        if (Platform.OS === 'android') {
                            ToastAndroid.show(`Sharing ${reportType} Failed.`, ToastAndroid.SHORT);
                        } else {
                            Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
                        }
                        setError("Error sharing delivery slip file.");
                    }
                }
            }
        } catch (e) {
            console.error(`${reportType} Excel Generation Error:`, e);
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Failed to generate ${reportType}.`, ToastAndroid.SHORT);
            } else {
                Alert.alert("Generation Failed", `Error generating Excel ${reportType.toLowerCase()}.`);
            }
            setError("Error generating delivery slip Excel file.");
        } finally {
            setLoading(false);
        }
    };

    const createDeliverySlipDataForExcelForRoute = async (usersForRoute) => {
        const orderMap = new Map();
        const allProducts = new Set();
        const unitRegex = /(\d+\.?\d*)\s*(ML|LTR|KG|GRMS|G|GM|ML)/i;

        usersForRoute.forEach(user => {
            const order = adminOrders.find(ord => ord.customer_id === user.customer_id && ord.order_type === orderTypeFilter);
            if (order) {
                orderMap.set(user.customer_id, { 
                    name: user.name, 
                    orderId: order.id, 
                    products: [], 
                    route: user.route,
                    productCrates: {}
                });
            }
        });

        for (const customerId of orderMap.keys()) {
            const orderData = orderMap.get(customerId);
            try {
                const token = await AsyncStorage.getItem("userAuthToken");
                const url = `http://${ipAddress}:8091/order-products?orderId=${orderData.orderId}`;
                const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
                const productsResponse = await fetch(url, { headers });
                if (!productsResponse.ok) continue;
                const productsData = await productsResponse.json();
                
                productsData.forEach(product => {
                    const match = product.name.match(unitRegex);
                    let quantityValue = match ? parseFloat(match[1]) : 1;
                    let unit = match ? match[2].toLowerCase() : 'unit';
                    if (unit === 'grms' || unit === 'g' || unit === 'gm') unit = 'gm';
                    else if (unit === 'ltr') unit = 'ltr';
                    else if (unit === 'kg') unit = 'kg';
                    else if (unit === 'ml') unit = 'ml';

                    let baseUnitQuantity = 0;
                    if (unit === 'ml') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                    else if (unit === 'gm') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                    else if (unit === 'ltr') baseUnitQuantity = quantityValue * product.quantity;
                    else if (unit === 'kg') baseUnitQuantity = quantityValue * product.quantity;
                    else baseUnitQuantity = product.quantity;

                    const crates = Math.floor(baseUnitQuantity / 12);
                    
                    orderData.products.push(product);
                    orderData.productCrates[product.name] = crates;
                    allProducts.add(product.name);
                });
            } catch (fetchError) {
                console.error("Error fetching order products:", fetchError);
            }
        }

        const productList = Array.from(allProducts);
        
        const formatVerticalHeader = (text) => {
           return text
        };

        const excelData = [
            ["Delivery Slip"], 
            [`Route: ${usersForRoute[0]?.route || ''}`],
            [],
            ["Items", ...usersForRoute.map(u => formatVerticalHeader(u.name)), formatVerticalHeader("Total Crates")]
        ];

        productList.forEach(productName => {
            const productRow = [productName];
            let totalCratesForProduct = 0;
            
            usersForRoute.forEach(user => {
                const orderData = orderMap.get(user.customer_id);
                const quantity = orderData?.products?.find(p => p.name === productName)?.quantity || 0;
                productRow.push(quantity);
                
                totalCratesForProduct += orderData?.productCrates[productName] || 0;
            });
            
            productRow.push(totalCratesForProduct);
            excelData.push(productRow);
        });

        const totalsRow = ["Totals"];
        let grandTotalQuantity = 0;
        let grandTotalCrates = 0;
        
        usersForRoute.forEach(user => {
            const orderData = orderMap.get(user.customer_id);
            const customerTotal = orderData?.products?.reduce((sum, product) => sum + product.quantity, 0) || 0;
            totalsRow.push(customerTotal);
            grandTotalQuantity += customerTotal;
        });
        
        grandTotalCrates = usersForRoute.reduce((total, user) => {
            const orderData = orderMap.get(user.customer_id);
            return total + Object.values(orderData?.productCrates || {}).reduce((sum, crates) => sum + crates, 0);
        }, 0);
        
        totalsRow.push(grandTotalCrates);
        excelData.push(totalsRow);

        const customerIdRow = ["Customer ID", ...usersForRoute.map(u => u.customer_id || ""), ""];
        excelData.push(customerIdRow);

        return excelData;
    };

    const createLoadingSlipDataForExcelForRoute = async (usersForRoute) => {
        const consolidatedProducts = new Map();
        const unitRegex = /(\d+\.?\d*)\s*(ML|LTR|KG|GRMS|G|GM|ML)/i;
    
        for (const user of usersForRoute) {
            const order = adminOrders.find(ord => ord.customer_id === user.customer_id && ord.order_type === orderTypeFilter);
            if (order) {
                try {
                    const token = await AsyncStorage.getItem("userAuthToken");
                    const url = `http://${ipAddress}:8091/order-products?orderId=${order.id}`;
                    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
                    const productsResponse = await fetch(url, { headers });
                    if (!productsResponse.ok) {
                        console.error(`Failed to fetch products for order ID ${order.id}. Status: ${productsResponse.status}`);
                        continue;
                    }
                    const productsData = await productsResponse.json();
                    productsData.forEach(product => {
                        const match = product.name.match(unitRegex);
                        let quantityValue = 0;
                        let unit = '';
    
                        if (match) {
                            quantityValue = parseFloat(match[1]);
                            unit = match[2].toLowerCase();
                            if (unit === 'grms' || unit === 'g' || unit === 'gm') unit = 'gm';
                            else if (unit === 'ltr') unit = 'ltr';
                            else if (unit === 'kg') unit = 'kg';
                            else if (unit === 'ml') unit = 'ml';
                        } else {
                            quantityValue = 1;
                            unit = 'unit';
                        }
    
                        let baseUnitQuantity = 0;
                        if (unit === 'ml') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                        else if (unit === 'gm') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                        else if (unit === 'ltr') baseUnitQuantity = quantityValue * product.quantity;
                        else if (unit === 'kg') baseUnitQuantity = quantityValue * product.quantity;
                        else baseUnitQuantity = product.quantity;
    
                        const crates = Math.floor(baseUnitQuantity / 12);
    
                        const currentProductInfo = consolidatedProducts.get(product.name);
                        if (currentProductInfo) {
                            consolidatedProducts.set(product.name, {
                                totalQuantity: currentProductInfo.totalQuantity + product.quantity,
                                category: currentProductInfo.category,
                                totalBaseUnitQuantity: currentProductInfo.totalBaseUnitQuantity + baseUnitQuantity,
                                totalCrates: currentProductInfo.totalCrates + crates,
                            });
                        } else {
                            consolidatedProducts.set(product.name, {
                                totalQuantity: product.quantity,
                                category: product.category || 'Unknown',
                                totalBaseUnitQuantity: baseUnitQuantity,
                                totalCrates: crates,
                            });
                        }
                    });
                } catch (fetchError) {
                    console.error("Error fetching order products:", fetchError);
                }
            }
        }
    
        const productListForExcel = Array.from(consolidatedProducts.entries()).map(([productName, productInfo]) => ({
            name: productName,
            quantity: productInfo.totalQuantity,
            category: productInfo.category,
            baseUnitQuantity: productInfo.totalBaseUnitQuantity.toFixed(2),
            crates: productInfo.totalCrates
        }));
    
        const brandTotalsMap = new Map();
        for (const [productName, productInfo] of consolidatedProducts.entries()) {
            const brand = productName.split(' ')[0].toUpperCase();
            const currentTotal = brandTotalsMap.get(brand) || 0;
            brandTotalsMap.set(brand, currentTotal + productInfo.totalCrates);
        }
        const brandTotals = Array.from(brandTotalsMap, ([brand, totalCrates]) => ({ brand, totalCrates }));
    
        return {
            productList: productListForExcel,
            brandTotals: brandTotals
        };
    };

    const groupUsersByRoute = (usersWithOrders) => {
        const routesMap = new Map();
        usersWithOrders.forEach(user => {
            const route = user.route || 'Unrouted';
            if (!routesMap.has(route)) {
                routesMap.set(route, []);
            }
            routesMap.get(route).push(user);
        });
        return routesMap;
    };

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        style={{
                            marginRight: 10,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: '#003366'
                        }}
                        onPress={async () => {
                            if (adminUsersWithOrdersToday.length > 0) {
                                const routesMap = groupUsersByRoute(adminUsersWithOrdersToday);
                                for (const [routeName, usersForRoute] of routesMap.entries()) {
                                    const loadingSlipDataForRoute = await createLoadingSlipDataForExcelForRoute(usersForRoute);
                                    await generateExcelReport(loadingSlipDataForRoute, 'Loading Slip', routeName);
                                    for (const user of usersForRoute) {
                                        const order = adminOrders.find(ord => ord.customer_id === user.customer_id && ord.order_type === orderTypeFilter);
                                        if (order) {
                                            try {
                                                const token = await AsyncStorage.getItem("userAuthToken");
                                                const response = await fetch(`http://${ipAddress}:8091/update-loading-slip-status`, {
                                                    method: 'POST',
                                                    headers: {
                                                        "Authorization": `Bearer ${token}`,
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({ orderId: order.id })
                                                });
                                                if (!response.ok) {
                                                    console.error(`Failed to update loading slip status for order ${order.id}. Status: ${response.status}`);
                                                    Alert.alert("Error", `Failed to update loading slip status for order ${order.id}`);
                                                    continue;
                                                }
                                                const responseData = await response.json();
                                                console.log(`Loading slip status updated for order ${order.id}:`, responseData.message);
                                            } catch (error) {
                                                console.error("Error updating loading slip status:", error);
                                                Alert.alert("Error", "Failed to update loading slip status due to a network or server error.");
                                            }
                                        }
                                    }
                                }
                                Alert.alert("Slips Generated", "Loading Slips generated and statuses updated for each route.");
                            } else {
                                Alert.alert("No Orders", "No orders available to generate loading slips for the current filter.");
                            }
                        }}
                    >
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Generate Loading Slip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            marginRight: 15,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: '#003366'
                        }}
                        onPress={async () => {
                            if (adminUsersWithOrdersToday.length > 0) {
                                const routesMap = groupUsersByRoute(adminUsersWithOrdersToday);
                                for (const [routeName, usersForRoute] of routesMap.entries()) {
                                    generateDeliveryExcelReport(usersForRoute, routeName);
                                }
                                Alert.alert("Slips Generated", "Delivery Slips generated for each route.");
                            } else {
                                Alert.alert("No Orders", "No orders available to generate delivery slips for the current filter.");
                            }
                        }}
                    >
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Generate Delivery Slip</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, adminOrders, adminUsersWithOrdersToday, orderTypeFilter]);


   
  const toggleOrderType = (type) => {
    setOrderTypeFilter(type);
  };
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <MaterialCommunityIcons name="truck-delivery" size={28} color={COLORS.text.light} />
                    <Text style={styles.headerTitle}>Loading Slips</Text>
                    <TouchableOpacity 
                        style={styles.datePickerButton}
                        onPress={showDatePicker}
                    >
                        <MaterialCommunityIcons name="calendar" size={24} color={COLORS.text.light} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.contentContainer}>
                <View style={styles.filterContainer}>
                    <Text style={styles.filterLabel}>Filter Order Type:</Text>
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, orderTypeFilter === 'AM' && styles.toggleButtonActive]}
                            onPress={() => toggleOrderType('AM')}
                            accessible
                            accessibilityLabel="Filter by AM orders"
                        >
                            <MaterialCommunityIcons 
                                name="weather-sunny" 
                                size={20} 
                                color={orderTypeFilter === 'AM' ? COLORS.text.light : COLORS.primary} 
                            />
                            <Text style={[styles.toggleText, orderTypeFilter === 'AM' && styles.toggleTextActive]}>AM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, orderTypeFilter === 'PM' && styles.toggleButtonActive]}
                            onPress={() => toggleOrderType('PM')}
                            accessible
                            accessibilityLabel="Filter by PM orders"
                        >
                            <MaterialCommunityIcons 
                                name="weather-night" 
                                size={20} 
                                color={orderTypeFilter === 'PM' ? COLORS.text.light : COLORS.primary} 
                            />
                            <Text style={[styles.toggleText, orderTypeFilter === 'PM' && styles.toggleTextActive]}>PM</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.columnHeader}>
                    <Text style={[styles.columnHeaderText, { flex: 1.1 }]}>Name</Text>
                    <Text style={[styles.columnHeaderText, { flex: 1.6 }]}>Route</Text>
                    <Text style={[styles.columnHeaderText, { flex: 1.5 }]}>Order ID</Text>
                    <Text style={[styles.columnHeaderText, { flex: 2.1 }]}>Amount</Text>
                    <Text style={[styles.columnHeaderText, { flex: 1.5 }]}>Status</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading orders...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={adminUsersWithOrdersToday}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => item?.customer_id?.toString() || index.toString()}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyListContainer}>
                                <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.text.secondary} />
                                <Text style={styles.emptyListText}>No {orderTypeFilter} orders on {selectedDate}.</Text>
                            </View>
                        )}
                        contentContainerStyle={styles.listContent}
                    />
                )}

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={COLORS.text.light} />
                        <Text style={styles.loadingText}>Generating Slip...</Text>
                    </View>
                )}
            </View>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                date={moment(selectedDate).toDate()}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: 16,
        paddingTop: 40,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "600",
        color: COLORS.text.light,
        flex: 1,
        marginLeft: 10,
    },
    datePickerButton: {
        padding: 8,
    },
    contentContainer: {
        flex: 1,
        padding: 16,
    },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginRight: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        flex: 0.4,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.secondary,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    toggleButtonActive: {
        backgroundColor: COLORS.primary,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 4,
    },
    toggleTextActive: {
        color: COLORS.text.light,
    },
    columnHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    columnHeaderText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text.light,
        textAlign: 'center',
    },
    dataRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dataCell: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text.primary,
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 16,
    },
    emptyListContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginTop: 16,
    },
    emptyListText: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginTop: 16,
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
        fontWeight: '600',
        color: COLORS.primary,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: `${COLORS.primary}90`,
    },
});
export default LoadingSlipSA;