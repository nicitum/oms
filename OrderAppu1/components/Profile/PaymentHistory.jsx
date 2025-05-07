import React, { useEffect, useState } from 'react';
import { 
    StyleSheet, 
    View, 
    Text, 
    ScrollView, 
    ActivityIndicator, 
    Alert, 
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { ipAddress } from '../../urls';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PaymentHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('All');

    const fetchTransactions = async () => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication required");
            }
            const decoded = jwtDecode(token);
            const fetchedCustomerId = decoded.id;

            let url = `http://${ipAddress}:8091/fetch-payment-transactions?customer_id=${fetchedCustomerId}`;
            if (selectedDate) {
                const formattedDate = selectedDate.toISOString().split('T')[0];
                url += `&date=${formattedDate}`;
            }
            if (paymentFilter !== 'All') {
                url += `&payment_method=${paymentFilter.toLowerCase()}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch transactions');
            }

            const data = await response.json();
            setTransactions(data.transactions);
            setError(null);
        } catch (err) {
            setError(err.message);
            setTransactions([]);
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [selectedDate, paymentFilter]);

    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        setSelectedDate(date);
        hideDatePicker();
    };

    const togglePaymentFilter = () => {
        setPaymentFilter(prev => {
            if (prev === 'All') return 'Cash';
            if (prev === 'Cash') return 'Online';
            return 'All';
        });
    };

    const getPaymentMethodIcon = (method) => {
        switch(method.toLowerCase()) {
            case 'cash':
                return 'payments';
            case 'online':
                return 'credit-card';
            default:
                return 'account-balance-wallet';
        }
    };

    const renderTransaction = (transaction, index) => {
        const isSuccess = transaction.status === 'success';
        return (
            <View key={index} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                    <View style={styles.transactionId}>
                        <MaterialIcons name="receipt" size={20} color="#003366" />
                        <Text style={styles.transactionIdText}>#{transaction.transaction_id}</Text>
                    </View>
                   
                </View>

                <View style={styles.transactionDetails}>
                    <View style={styles.detailRow}>
                        <MaterialIcons name={getPaymentMethodIcon(transaction.payment_method)} size={20} color="#666666" />
                        <Text style={styles.detailLabel}>{transaction.payment_method}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <MaterialIcons name="account-circle" size={20} color="#666666" />
                        <Text style={styles.detailLabel}>ID: {transaction.customer_id}</Text>
                    </View>
                </View>

                <View style={styles.transactionFooter}>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>Amount</Text>
                        <Text style={styles.amountValue}>₹{parseFloat(transaction.payment_amount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.dateContainer}>
                        <MaterialIcons name="event" size={16} color="#666666" />
                        <Text style={styles.dateText}>
                            {new Date(transaction.payment_date).toLocaleDateString('en-gb')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#003366" barStyle="light-content" />
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Payment History</Text>
                <Text style={styles.headerSubtitle}>View your transaction details</Text>
            </View>

            <View style={styles.filterContainer}>
                <TouchableOpacity 
                    onPress={showDatePicker} 
                    style={styles.filterButton}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="event" size={20} color="#FFFFFF" />
                    <Text style={styles.filterButtonText}>
                        {selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={togglePaymentFilter} 
                    style={[styles.filterButton, { backgroundColor: '#004d99' }]}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="filter-list" size={20} color="#FFFFFF" />
                    <Text style={styles.filterButtonText}>{paymentFilter}</Text>
                </TouchableOpacity>
            </View>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#003366" />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color="#F44336" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : transactions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="account-balance-wallet" size={64} color="#003366" />
                    <Text style={styles.emptyTitle}>No Transactions</Text>
                    <Text style={styles.emptySubtitle}>No payment history found for the selected filters</Text>
                </View>
            ) : (
                <ScrollView 
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {transactions.map((transaction, index) => renderTransaction(transaction, index))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    header: {
        backgroundColor: '#003366',
        padding: 16,
        paddingTop: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#003366',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    filterButtonText: {
        color: '#FFFFFF',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    transactionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        overflow: 'hidden',
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    transactionId: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    transactionIdText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
        marginLeft: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    transactionDetails: {
        padding: 16,
        backgroundColor: '#FAFAFA',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 14,
        color: '#666666',
        marginLeft: 8,
    },
    transactionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    amountContainer: {
        flex: 1,
    },
    amountLabel: {
        fontSize: 12,
        color: '#666666',
    },
    amountValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
        marginTop: 2,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 14,
        color: '#666666',
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666666',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: '#F44336',
        textAlign: 'center',
        marginTop: 16,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#003366',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default PaymentHistory;