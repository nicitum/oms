import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { ipAddress } from '../../urls';

export default function Payments() {
    const [paymentResponse, setPaymentResponse] = useState(null);
    const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
    const [refreshData, setRefreshData] = useState(false);
    const [currentCustomerId, setCurrentCustomerId] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(null);
    const route = useRoute(); // Access navigation params

    // Initiates the online payment flow
    const initiatePaymentFlow = useCallback(async (amount) => {
        let fetchedCustomerId = null;

        console.log("initiatePaymentFlow called with amount:", amount);

        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                console.warn("Authentication token not found in initiatePaymentFlow.");
                Alert.alert("Error", "Authentication token is missing. Cannot process payment.");
                return;
            }
            const decoded = jwtDecode(token);
            fetchedCustomerId = decoded.id;
            setCurrentCustomerId(fetchedCustomerId);
            console.log("Customer ID fetched inside initiatePaymentFlow:", fetchedCustomerId);
        } catch (tokenError) {
            console.error("Error fetching or decoding token in initiatePaymentFlow:", tokenError);
            Alert.alert("Error", "Failed to retrieve user information. Cannot process payment.");
            setIsInitiatingPayment(false);
            return;
        }

        if (isNaN(amount) || amount < 0) {
            console.log("Validation failed: Invalid amount");
            Alert.alert("Invalid Amount", "Payment amount is invalid.");
            return;
        }

        if (!fetchedCustomerId) {
            console.log("Validation failed: Customer ID missing (even after fetching)");
            Alert.alert("Error", "Customer information is missing. Cannot process payment.");
            return;
        }
        setPaymentAmount(amount);
        setIsInitiatingPayment(true);
        try {
            const tokenResponse = await fetch(`http://${ipAddress}:8090/generate-payment-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: amount }),
            });

            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                const errorMessage = errorData?.error || `Failed to fetch token: HTTP ${tokenResponse.status}`;
                throw new Error(errorMessage);
            }

            const tokenData = await tokenResponse.json();
            const paymentToken = tokenData.token;
            const merchantId = tokenData.merchantId;
            const txnId = tokenData.txnId;

            console.log("Payment Token Received:", paymentToken);

            const reqJson = {
                "features": {
                    "enableAbortResponse": true,
                    "enableExpressPay": true,
                    "enableInstrumentDeRegistration": true,
                    "enableMerTxnDetails": true,
                    "enableNewWindowFlow": true
                },
                "consumerData": {
                    "deviceId": "WEBSH2",
                    "token": paymentToken,
                    "returnUrl": "http://82.112.226.135:8090/payment-response",
                    "responseHandler": "handleResponse",
                    "paymentMode": "all",
                    "merchantLogoUrl": "https://www.paynimo.com/CompanyDocs/company-logo-vertical.png",
                    "merchantId": merchantId,
                    "currency": "INR",
                    "consumerId": fetchedCustomerId,
                    "txnId": txnId,
                    "items": [{
                        "itemId": "first",
                        "amount": amount.toString(),
                        "comAmt": "0"
                    }],
                    "customStyle": {
                        "PRIMARY_COLOR_CODE": "#45beaa",
                        "SECONDARY_COLOR_CODE": "#FFFFFF",
                        "BUTTON_COLOR_CODE_1": "#2d8c8c",
                        "BUTTON_COLOR_CODE_2": "#FFFFFF"
                    }
                }
            };

            const reqJsonString = JSON.stringify(reqJson);
            const params = new URLSearchParams();
            params.append('reqJson', reqJsonString);
            console.log("Payments.jsx - consumerData BEFORE URL:", reqJson.consumerData);
            const paymentUrl = `http://${ipAddress}:8090/payments.html?${params.toString()}`;
            console.log("Opening Payment URL in Browser:", paymentUrl);
            await Linking.openURL(paymentUrl).catch(err => {
                console.error('Error opening URL:', err);
                Alert.alert('Error', 'Could not open payment page. Please check your connection.');
            });
        } catch (error) {
            console.error("Error in initiatePaymentFlow:", error);
            Alert.alert("Payment Error", `Failed to initiate payment: ${error.message}`);
        } finally {
            setIsInitiatingPayment(false);
        }
    }, [setRefreshData]);

    // Get latest payment status from server
    const getLatestPaymentResponse = useCallback(async () => {
        try {
            console.log("Fetching latest payment response data...");
            const response = await fetch(`http://${ipAddress}:8090/get-payment-response-data`);
            if (!response.ok) {
                if (response.status === 404) {
                    setPaymentResponse({ message: 'No payment response data found yet.' });
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return;
            }
            const textData = await response.text();

            try {
                const jsonData = JSON.parse(textData.substring(textData.indexOf('{')));
                setPaymentResponse(jsonData);
                console.log("Payment data loaded and parsed:", jsonData);

                if (jsonData && jsonData.txn_status_code === '0300') {
                    console.log("Transaction successful (0300), calling collectOnlinePayment API");
                    await collectOnlinePayment(jsonData.txn_amt, currentCustomerId);
                } else if (jsonData && jsonData.txn_status_code !== '0300' && jsonData.txn_status_code) {
                    Toast.show({
                        type: 'error',
                        text1: 'Payment Failed',
                        text2: jsonData.txn_msg || 'Transaction was not successful.',
                        visibilityTime: 4000,
                        autoHide: true,
                    });
                }
            } catch (jsonError) {
                console.error("Error parsing JSON from text:", jsonError);
                setPaymentResponse({ message: 'Error displaying payment data: Could not parse JSON.' });
            }
        } catch (error) {
            console.error("Fetching payment data failed:", error);
            setPaymentResponse({ message: 'Failed to load payment response data.' });
        }
    }, [currentCustomerId]);

    // Call backend API to collect online payment
    const collectOnlinePayment = useCallback(async (amount, customerId) => {
        console.log("Calling collectOnlinePayment API with amount:", amount, "customerId:", customerId);
        if (!customerId) {
            console.error("Customer ID is missing, cannot call collectOnlinePayment API.");
            Alert.alert("Error", "Customer ID is missing, cannot finalize payment.");
            return;
        }
        if (amount === undefined || amount === null) {
            console.error("Payment amount is missing, cannot call collectOnlinePayment API.");
            Alert.alert("Error", "Payment amount is missing, cannot finalize payment.");
            return;
        }

        try {
            const backendResponse = await fetch(`http://${ipAddress}:8090/collect_online?customerId=${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ online: amount.toString() }),
            });

            if (!backendResponse.ok) {
                const errorData = await backendResponse.json();
                const errorMessage = errorData?.message || `Failed to finalize payment: HTTP ${backendResponse.status}`;
                throw new Error(errorMessage);
            }

            const successData = await backendResponse.json();
            console.log("Backend payment collection API success:", successData);
            Toast.show({
                type: 'success',
                text1: 'Payment Successful!',
                text2: successData.message || 'Payment recorded successfully.',
                visibilityTime: 3000,
                autoHide: true,
            });
            setRefreshData(prev => !prev);
        } catch (error) {
            console.error("Error calling collectOnlinePayment API:", error);
            Toast.show({
                type: 'error',
                text1: 'Payment Finalization Failed',
                text2: error.message || 'Could not finalize payment with backend.',
                visibilityTime: 4000,
                autoHide: true,
            });
        }
    }, [setRefreshData]);

    // Initiate payment flow when screen loads with amount from navigation params
    useEffect(() => {
        const amount = route.params?.amount; // Get amount from navigation params
        if (amount !== undefined && amount !== null) {
            initiatePaymentFlow(amount); // Use passed amount instead of hardcoded value
        } else {
            console.warn("No amount provided in navigation params.");
            Alert.alert("Error", "No payment amount specified.");
        }
    }, [route.params?.amount, initiatePaymentFlow]);

    // Handle deep link for automatic return
    useEffect(() => {
        const handleDeepLink = async (event) => {
            console.log("Deep link received:", event.url);
            if (event.url && event.url.startsWith('reyss-app://')) {
                console.log("App reopened via deep link, fetching payment response...");
                await getLatestPaymentResponse();
            } else {
                console.log("Unhandled deep link:", event.url);
            }
        };

        Linking.getInitialURL().then((url) => {
            if (url && url.startsWith('reyss-app://')) {
                console.log("Initial URL detected:", url);
                getLatestPaymentResponse();
            }
        }).catch(err => console.error("Error getting initial URL:", err));

        const subscription = Linking.addEventListener('url', handleDeepLink);
        return () => subscription.remove();
    }, [getLatestPaymentResponse]);

    // Refresh payment status when screen is focused (fallback)
    useFocusEffect(
        useCallback(() => {
            console.log("Payments screen focused, checking payment status...");
            getLatestPaymentResponse();
            return () => {
                console.log("Payments screen went out of focus");
            };
        }, [getLatestPaymentResponse])
    );

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Payment Response Data:</Text>
            {paymentResponse ? (
                paymentResponse.message ? (
                    <Text style={styles.errorText}>{paymentResponse.message}</Text>
                ) : (
                    <View style={styles.dataContainer}>
                        {Object.entries(paymentResponse).map(([key, value]) => (
                            <View style={styles.dataRow} key={key}>
                                <Text style={styles.dataKey}>{key}: </Text>
                                <Text style={styles.dataValue}>{value}</Text>
                            </View>
                        ))}
                        {isInitiatingPayment && (
                            <ActivityIndicator size="large" color="#007bff" style={styles.collectingIndicator} />
                        )}
                    </View>
                )
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.loadingText}>Loading payment data...</Text>
                </View>
            )}
            <Toast ref={(ref) => Toast.setRef(ref)} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    errorText: { color: 'red', marginTop: 10, textAlign: 'center' },
    dataContainer: { marginTop: 10, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5 },
    dataRow: { flexDirection: 'row', marginBottom: 5 },
    dataKey: { fontWeight: 'bold', marginRight: 5 },
    dataValue: { flex: 1, flexWrap: 'wrap' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#6c757d',
    },
    collectingIndicator: {
        marginTop: 20,
    },
});