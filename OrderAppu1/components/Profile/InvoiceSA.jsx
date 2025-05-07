import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Button, Platform, ScrollView, StyleSheet,ToastAndroid,Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Checkbox } from "react-native-paper";
import moment from "moment";
import Toast from "react-native-toast-message";
import { ipAddress } from "../../urls";
import { MaterialIcons } from '@expo/vector-icons';

const InvoiceSA = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectAllChecked, setSelectAllChecked] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);
    const handleConfirmDate = (date) => {
        setSelectedDate(date);
        fetchOrders(date);
        hideDatePicker();
    };

    // Define fetchAssignedUsers
    const fetchAssignedUsers = useCallback(async () => {
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
                const filteredUsers = responseJson.data.filter(user => user.role === "user");
                setAssignedUsers(filteredUsers);
            } else {
                setAssignedUsers([]);
                setError("No users found.");
            }
        } catch (fetchError) {
            const errorMessage = fetchError.message || "Failed to fetch users.";
            setError(errorMessage);
            Toast.show({ type: "error", text1: "Fetch Error", text2: errorMessage });
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOrders = useCallback(async (dateFilter) => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token not found. Please log in.");
            }
    
            // Use dateFilter if provided, else default to today
            const dateFormatted = dateFilter ? moment(dateFilter).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
    
            const response = await axios.get(`http://${ipAddress}:8091/get-orders-sa?date=${dateFormatted}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
    
            if (!response.data || !response.data.status) {
                throw new Error(response.data?.message || "No valid data received from server");
            }
    
            const fetchedOrders = response.data.orders || [];
            console.log("Fetched orders for date", dateFormatted, ":", fetchedOrders);
    
            setOrders(fetchedOrders);
            setSelectAllChecked(false);
            setSelectedOrderIds([]);
            await fetchAssignedUsers();
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Failed to fetch orders";
            setError(errorMessage);
            Toast.show({ type: "error", text1: "Fetch Error", text2: errorMessage });
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchAssignedUsers]);

    // Fetch Order Products
    const fetchOrderProducts = useCallback(async (orderId) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("No authorization token found.");

            const response = await axios.get(
                `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching order products:", error);
            Alert.alert("Error", "Failed to fetch order details.");
            return [];
        }
    }, []);

    // Fetch Products with Customer-Specific Pricing
    const fetchProducts = useCallback(async (customerId) => {
        try {
            setLoading(true);
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");

            // Fetch all products
            const response = await axios.get(`http://${ipAddress}:8091/products`, {
                headers: {
                    Authorization: `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });
            const products = response.data;

            if (!customerId) {
                console.warn("No customer ID provided; using default product prices.");
                return products.map(product => ({
                    ...product,
                    price: parseFloat(product.price || 0),
                    gstRate: parseFloat(product.gst_rate || 0),
                }));
            }

            // Fetch customer-specific prices for each product
            const productsWithPricesPromises = products.map(async (product) => {
                try {
                    const priceResponse = await axios.get(`http://${ipAddress}:8091/customer-product-price`, {
                        params: {
                            product_id: product.id,
                            customer_id: customerId,
                        },
                        headers: {
                            Authorization: `Bearer ${userAuthToken}`,
                        },
                    });
                    const basePrice = parseFloat(priceResponse.data.effectivePrice || product.price || 0);
                    const gstRate = parseFloat(product.gst_rate || 0);
                    const gstAmount = (basePrice * gstRate) / 100;
                    const finalPrice = basePrice + gstAmount;

                    return {
                        ...product,
                        price: basePrice, // Base price (customer-specific or default)
                        gstRate: gstRate,
                        gstAmount: gstAmount,
                        finalPrice: finalPrice,
                    };
                } catch (priceError) {
                    console.error(`Error fetching price for product ${product.id}:`, priceError);
                    const basePrice = parseFloat(product.price || 0);
                    const gstRate = parseFloat(product.gst_rate || 0);
                    const gstAmount = (basePrice * gstRate) / 100;
                    const finalPrice = basePrice + gstAmount;
                    return {
                        ...product,
                        price: basePrice,
                        gstRate: gstRate,
                        gstAmount: gstAmount,
                        finalPrice: finalPrice,
                    };
                }
            });

            const productsWithPrices = await Promise.all(productsWithPricesPromises);
            return productsWithPrices;
        } catch (error) {
            console.error("Error fetching products:", error);
            Alert.alert("Error", "Failed to fetch products.");
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Save Function
    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem("orderReportDirectoryUri");

                if (!directoryUriToUse) {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        directoryUriToUse = permissions.directoryUri;
                        await AsyncStorage.setItem("orderReportDirectoryUri", directoryUriToUse);
                    } else {
                        await Sharing.shareAsync(uri);
                        ToastAndroid.show(`${reportType} shared instead (permission denied).`, ToastAndroid.SHORT);
                        return;
                    }
                }

                const base64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    directoryUriToUse,
                    filename,
                    mimetype
                );
                await FileSystem.writeAsStringAsync(newUri, base64, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
            } catch (error) {
                console.error("Error saving file:", error);
                if (error.message.includes("permission")) {
                    await AsyncStorage.removeItem("orderReportDirectoryUri");
                    ToastAndroid.show("Permission issue detected. Cleared directory URI. Please try again.", ToastAndroid.SHORT);
                } else {
                    ToastAndroid.show(`Failed to save ${reportType}. Sharing instead.`, ToastAndroid.SHORT);
                    await Sharing.shareAsync(uri);
                }
            }
        } else {
            await Sharing.shareAsync(uri);
            Alert.alert("Success", `${reportType} shared successfully!`);
        }
    };

    // Number to Words Function
    const numberToWords = (num) => {
        const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
        const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        const thousands = ["", "Thousand", "Million", "Billion"];

        if (num === 0) return "Zero Rupees Only";

        const rupees = Math.floor(num);
        const paise = Math.round((num - rupees) * 100);

        const rupeesToWords = (num) => {
            if (num === 0) return "";
            let numStr = num.toString();
            let words = [];
            let chunkCount = 0;

            while (numStr.length > 0) {
                let chunk = parseInt(numStr.slice(-3)) || 0;
                numStr = numStr.slice(0, -3);

                if (chunk > 0) {
                    let chunkWords = [];
                    let hundreds = Math.floor(chunk / 100);
                    let remainder = chunk % 100;

                    if (hundreds > 0) {
                        chunkWords.push(`${units[hundreds]} Hundred`);
                    }

                    if (remainder > 0) {
                        if (remainder < 10) {
                            chunkWords.push(units[remainder]);
                        } else if (remainder < 20) {
                            chunkWords.push(teens[remainder - 10]);
                        } else {
                            let ten = Math.floor(remainder / 10);
                            let unit = remainder % 10;
                            chunkWords.push(tens[ten] + (unit > 0 ? ` ${units[unit]}` : ""));
                        }
                    }

                    if (chunkCount > 0) {
                        chunkWords.push(thousands[chunkCount]);
                    }
                    words.unshift(chunkWords.join(" "));
                }
                chunkCount++;
            }
            return words.join(" ");
        };

        const paiseToWords = (num) => {
            if (num === 0) return "";
            if (num < 10) return units[num];
            if (num < 20) return teens[num - 10];
            let ten = Math.floor(num / 10);
            let unit = num % 10;
            return tens[ten] + (unit > 0 ? ` ${units[unit]}` : "");
        };

        const rupeesPart = rupeesToWords(rupees);
        const paisePart = paiseToWords(paise);

        let result = "";
        if (rupeesPart) {
            result += `${rupeesPart} Rupees`;
        }
        if (paisePart) {
            result += `${rupeesPart ? " and " : ""}${paisePart} Paise`;
        }
        result += " Only";

        return result.trim() || "Zero Rupees Only";
    };

    // Post Invoice to API
    const postInvoiceToAPI = useCallback(async (orderId, invoiceId, orderPlacedOn) => {
        
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const invoiceDate = moment().unix(); // Current time in epoch seconds

            const response = await axios.post(
                `http://${ipAddress}:8091/invoice`,
                {
                    order_id: orderId,
                    invoice_id: invoiceId,
                    order_date: parseInt(orderPlacedOn),
                    invoice_date: invoiceDate,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log("Invoice posted successfully:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error posting invoice to API:", error.response?.data || error.message);
            throw new Error("Failed to save invoice data to server.");
        }
    }, []);
   
    // Generate Invoice and Save as PDF
    const generateInvoice = useCallback(
        async (order) => {
            const orderId = order.id;
            const orderProducts = await fetchOrderProducts(orderId);
    
            const invoiceProducts = orderProducts
                .map((op, index) => {
                    // Calculate base price by removing GST from the stored price
                    const priceIncludingGst = parseFloat(op.price);
                    const gstRate = parseFloat(op.gst_rate || 0);
                    
                    // Calculate base price (price before GST)
                    const basePrice = gstRate > 0 
                        ? priceIncludingGst / (1 + (gstRate / 100))
                        : priceIncludingGst;
    
                    // Calculate values
                    const value = (op.quantity * basePrice);
                    const gstAmount = value * (gstRate / 100);
    
                    return {
                        serialNumber: index + 1,
                        name: op.name,
                        hsn_code: op.hsn_code || " ",
                        quantity: op.quantity,
                        uom: 'Pkts',
                        rate: basePrice.toFixed(2),
                        value: value.toFixed(2),
                        gstRate: gstRate.toFixed(2),
                        gstAmount: gstAmount.toFixed(2),
                    };
                })
                .filter(Boolean);

            if (invoiceProducts.length === 0) {
                Alert.alert("Error", "Could not generate invoice due to missing product information.");
                return;
            }

            const customer = assignedUsers.find((user) => user.customer_id === order.customer_id) || {
                name: "Unknown",
                phone: "N/A",
                customer_id: "N/A",
                route: "N/A",
            };

           // In the invoice generation code
            const subTotal = invoiceProducts.reduce((acc, item) => acc + parseFloat(item.value), 0).toFixed(2);
            const totalGstAmount = invoiceProducts.reduce((acc, item) => acc + parseFloat(item.gstAmount), 0).toFixed(2);
            const cgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
            const sgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
            const grandTotal = (parseFloat(subTotal) + parseFloat(totalGstAmount)).toFixed(2);

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const invoiceNumber = `INV-${dateStr}-${randomNum}`;
            const totalInWords = numberToWords(parseFloat(grandTotal));

            const htmlContent = `
                <div style="
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    width: 800px; 
                    margin: 0 auto; 
                    font-size: 16px; 
                    line-height: 1.4; 
                    box-sizing: border-box;
                ">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="font-size: 32px; margin: 0; font-weight: bold; letter-spacing: 1px;">Order Appu</h1>
                        <div style="font-size: 14px; color: #333;">
                    
                            <p style="margin: 3px 0;">Bangalore - 560068</p>
                        </div>
                    </div>

                    <!-- Invoice and Customer Information in two columns -->
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                        <div style="flex: 1;">
                            <h3 style="font-size: 18px; margin: 0 0 5px 0; font-weight: bold;">Customer Information</h3>
                            <p style="margin: 3px 0; font-weight:bold;">Name: ${customer.name}</p>
                            <p style="margin: 3px 0;font-weight:bold;">Phone: ${customer.phone}</p>
                            ${customer.delivery_address?.split(',').map(line => 
                                `<p style="margin: 3px 0;">${line.trim()}</p>`
                            ).join('') || '<p style="margin: 3px 0;">N/A</p>'}
                        </div>
                        <div style="flex: 1; text-align: right;">
                            <p style="font-weight: bold; margin: 3px 0;">Invoice No: ${invoiceNumber}</p>
                            <p style="margin: 3px 0;">Order ID: ${orderId}</p>
                            <p style="margin: 3px 0;">Date: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <!-- Products Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f2f2f2; border-bottom: 2px solid #000; border-top: 2px solid #000;">
                                <th style="padding: 8px; text-align: left; font-weight: bold;">S.No</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">Item Name</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">HSN</th>
                                <th style="padding: 8px; text-align: right; font-weight: bold;">Qty</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">UOM</th>
                                <th style="padding: 8px; text-align: right; font-weight: bold;">Rate</th>
                                <th style="padding: 8px; text-align: right; font-weight: bold;">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceProducts
                                .map(
                                    (item) => `
                                        <tr style="border-bottom: 1px solid #ddd;">
                                            <td style="padding: 8px;">${item.serialNumber}</td>
                                            <td style="padding: 8px;">${item.name}</td>
                                            <td style="padding: 8px;">${item.hsn_code}</td>
                                            <td style="padding: 8px; text-align: right;">${item.quantity}</td>
                                            <td style="padding: 8px;">${item.uom}</td>
                                            <td style="padding: 8px; text-align: right;">₹${item.rate}</td>
                                            <td style="padding: 8px; text-align: right;">₹${item.value}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                   <!-- Total and Certification Section -->
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                        <!-- Certification Text on Left -->
                        <div style="width: 50%; text-align: left;">
                            <div style="margin: 10px 0;">
                                <p style="margin: 3px 0;">We hereby certify that its products mentioned in the said</p>
                                <p style="margin: 3px 0;">invoices are warranted to be of the nature and quality</p>
                                <p style="margin: 3px 0;">which they are purported to be.</p>
                                <br>
                                <p style="font-style: italic; font-weight: bold ; font-size: 18px; margin: 3px 0;">(${totalInWords})</p>
                            </div>
                        </div>
                        <!-- Total on Right -->
                        <div style="width: 40%; text-align: right;">
                            <p style="margin: 3px 0; font-weight: bold;">Subtotal: ₹${subTotal}</p>
                            <p style="margin: 3px 0;">CGST: ₹${cgstAmount}</p>
                            <p style="margin: 3px 0;">SGST: ₹${sgstAmount}</p>
                            <p style="font-weight: bold; margin: 3px 0; font-size: 20px;">Total: ₹${grandTotal}</p>
                            <br>
                             <p style="font-weight: bold; font-size: 20px; margin: 3px 0; text-align:right;">Order Appu</p>
                             <br>
                             <br>
                            <p style="font-weight: bold; font-size: 18px; margin: 3px 0;text-align:right;">Authorized Signatory</p>

                          
                        </div>
                    </div>

                </div>
            `;

            try {
                const { uri } = await Print.printToFileAsync({
                    html: htmlContent,
                    base64: false,
                });
                const filename = `Invoice_${invoiceNumber}.pdf`;
                await save(uri, filename, "application/pdf", "Invoice");
                await postInvoiceToAPI(orderId, invoiceNumber, order.placed_on);
                Toast.show({
                  type: 'success',
                  text1: 'Invoice Generated',
                  text2: `Invoice for Order #${orderId} generated successfully!`,
                  position: 'bottom',
                  visibilityTime: 3000,
                });
                console.log("PDF saved at:", uri);
            } catch (error) {
                console.error("Error generating or saving PDF:", error);
                Alert.alert("Error", "Failed to generate or save the invoice.");
            }
        },
        [fetchOrderProducts, fetchProducts, assignedUsers]
    );
    // Generate Bulk Invoices
    const generateBulkInvoices = useCallback(async () => {
        let ordersToProcess = [];
        if (selectAllChecked) {
            ordersToProcess = orders;
        } else {
            ordersToProcess = orders.filter(order => selectedOrderIds.includes(order.id));
        }

        if (ordersToProcess.length === 0) {
            Alert.alert("Alert", "No orders selected to generate invoices.");
            return;
        }

        setLoading(true);
        try {
            for (const order of ordersToProcess) {
                await generateInvoice(order);
            }
            if (Platform.OS === "android") {
                ToastAndroid.show("Invoices generated and saved successfully!", ToastAndroid.SHORT);
            } else {
                Alert.alert("Success", "Invoices generated and shared!");
            }
        } catch (error) {
            console.error("Error generating bulk invoices:", error);
            Alert.alert("Error", "Failed to generate all invoices.");
        } finally {
            setLoading(false);
        }
    }, [orders, selectedOrderIds, selectAllChecked, generateInvoice]);

    // Handle Order Checkbox Change
    const handleOrderCheckboxChange = useCallback((orderId) => {
        setSelectedOrderIds(prevSelected =>
            prevSelected.includes(orderId)
                ? prevSelected.filter(id => id !== orderId)
                : [...prevSelected, orderId]
        );
    }, []);

    // Handle Select All Checkbox Change
    const handleSelectAllCheckboxChange = useCallback(() => {
        setSelectAllChecked(prev => !prev);
        setSelectedOrderIds([]);
    }, []);

    // Initial Fetch on Component Mount
    useEffect(() => {
        fetchOrders(selectedDate);
    }, [fetchOrders, selectedDate]);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Invoice Generation</Text>
                <View style={styles.headerActions}>
                    <Button color="#003366" title={`Date: ${selectedDate.toISOString().split("T")[0]}`} onPress={showDatePicker} />
                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={handleConfirmDate}
                        onCancel={hideDatePicker}
                        date={selectedDate}
                    />
                </View>
            </View>
            <View style={styles.selectAllContainer}>
                <Text style={styles.selectAllText}>Select All</Text>
                <Checkbox
                    status={selectAllChecked ? "checked" : "unchecked"}
                    onPress={handleSelectAllCheckboxChange}
                    color="#003366"
                />
            </View>
            <ScrollView style={styles.ordersContainer} contentContainerStyle={styles.ordersContent}>
                {loading && <Text style={styles.loadingText}>Loading Orders...</Text>}
                {error && <Text style={styles.errorText}>Error: {error}</Text>}
                {!loading && !error && orders.length > 0 ? (
                    orders.map((order) => (
                        <View key={order.id} style={styles.orderCard}>
                            {!selectAllChecked && (
                                <Checkbox
                                    status={selectedOrderIds.includes(order.id) ? "checked" : "unchecked"}
                                    onPress={() => handleOrderCheckboxChange(order.id)}
                                    color="#003366"
                                />
                            )}
                            <View style={styles.orderDetails}>
                                <View style={styles.orderRow}>
                                    <MaterialIcons name="receipt" size={20} color="#003366" />
                                    <Text style={styles.orderId}>Order ID: {order.id}</Text>
                                </View>
                                <View style={styles.orderRow}>
                                    <MaterialIcons name="person" size={18} color="#666" />
                                    <Text style={styles.orderLabel}>Customer ID:</Text>
                                    <Text style={styles.orderValue}>{order.customer_id}</Text>
                                </View>
                                <View style={styles.orderRow}>
                                    <MaterialIcons name="event" size={18} color="#666" />
                                    <Text style={styles.orderLabel}>Placed On:</Text>
                                    <Text style={styles.orderValue}>{moment.unix(order.placed_on).format('DD MMM YYYY')}</Text>
                                </View>
                            </View>
                            <Button color="#003366" title="Generate Invoice" onPress={() => generateInvoice(order)} />
                        </View>
                    ))
                ) : !loading && !error ? (
                    <Text style={styles.noOrdersText}>No orders found for selected date.</Text>
                ) : null}
            </ScrollView>
            {!loading && orders.length > 0 && (
                <Button
                    title="Generate Selected Invoices"
                    onPress={generateBulkInvoices}
                    color="#003366"
                    disabled={selectAllChecked ? false : selectedOrderIds.length === 0}
                />
            )}
            <Toast ref={(ref) => Toast.setRef(ref)} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f7fa',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#003366',
    },
    headerTitle: {
        color: '#003366',
        fontSize: 22,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#003366',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        marginBottom: 10,
    },
    selectAllText: {
        color: '#003366',
        fontWeight: '600',
        fontSize: 16,
        marginRight: 8,
    },
    ordersContainer: {
        backgroundColor: '#f5f7fa',
        borderRadius: 10,
        padding: 2,
        marginBottom: 20,
    },
    ordersContent: {
        paddingBottom: 20,
    },
    orderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#003366',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    orderDetails: {
        flex: 1,
        marginLeft: 10,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    orderId: {
        fontSize: 16,
        color: '#003366',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    orderLabel: {
        fontSize: 15,
        color: '#6B7280',
        marginLeft: 8,
        fontWeight: '500',
    },
    orderValue: {
        fontSize: 15,
        color: '#1F2937',
        marginLeft: 4,
        fontWeight: '500',
    },
    loadingText: {
        color: '#003366',
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 20,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 20,
    },
    noOrdersText: {
        color: '#6B7280',
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 20,
    },
});

export default InvoiceSA;