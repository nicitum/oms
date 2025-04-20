import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ToastAndroid, // Import ToastAndroid for Android Toast
    Platform, // Import Platform to check OS
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { ipAddress } from "../../urls";

const CreditLimitPage = () => {
    const [creditData, setCreditData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredCreditData, setFilteredCreditData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editCustomerId, setEditCustomerId] = useState(null);
    const [newCreditLimit, setNewCreditLimit] = useState("");
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState(null);

    const navigation = useNavigation();

    const fetchCreditData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await checkTokenAndRedirect(navigation);
            const response = await fetch(`http://${ipAddress}:8090/fetch_credit_data`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const message = `Failed to fetch credit data. Status: ${response.status}`;
                throw new Error(message);
            }
            const data = await response.json();
            setCreditData(data.creditData);
        } catch (err) {
            console.error("Error fetching credit data:", err);
            setError("Failed to load credit data.");
            Alert.alert("Error", "Failed to load credit data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [navigation]);

    // Use useFocusEffect for navigation focus updates
    useFocusEffect(
        useCallback(() => {
            fetchCreditData();
        }, [fetchCreditData])
    );

    // Initial data fetch on mount
    useEffect(() => {
        fetchCreditData();
    }, [fetchCreditData]);


    useEffect(() => {
        if (searchQuery && creditData) {
            const lowerQuery = searchQuery.toLowerCase();
            const filteredData = creditData.filter(item => {
                return (
                    String(item.customer_name).toLowerCase().includes(lowerQuery) ||
                    String(item.credit_limit).toLowerCase().includes(lowerQuery)
                );
            });
            setFilteredCreditData(filteredData);
        } else {
            setFilteredCreditData(creditData);
        }
    }, [searchQuery, creditData]);


    const handleUpdateCreditLimit = async (customerId) => {
        if (!newCreditLimit) {
            Alert.alert("Validation Error", "Please enter a new credit limit.");
            return;
        }
        if (isNaN(Number(newCreditLimit))) {
            Alert.alert("Validation Error", "Credit limit must be a number.");
            return;
        }

        setUpdateLoading(true);
        setUpdateError(null);
        try {
            const token = await checkTokenAndRedirect(navigation);
            const response = await fetch(`http://${ipAddress}:8090/update_credit_limit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ customerId: customerId, creditLimit: newCreditLimit }),
            });

            if (!response.ok) {
                const message = `Failed to update credit limit. Status: ${response.status}`;
                const errorData = await response.json();
                throw new Error(errorData.message || message);
            }

            // Refresh data first, then show success message
            await fetchCreditData();
            if (Platform.OS === 'android') {
                ToastAndroid.show("Credit limit updated successfully!", ToastAndroid.SHORT);
            } else {
                Alert.alert("Success", `Credit limit for Customer ID ${customerId} updated to ${newCreditLimit} successfully!`);
            }


            setEditCustomerId(null);
            setNewCreditLimit("");


        } catch (updateErr) {
            console.error("Error updating credit limit:", updateErr);
            setUpdateError("Failed to update credit limit.");
            Alert.alert("Error", updateErr.message || "Failed to update credit limit. Please try again.");
        } finally {
            setUpdateLoading(false);
        }
    };

    const renderTableHeader = () => (
        <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.headerText, { flex: 2 }]}>Customer Name</Text>
            <Text style={[styles.tableHeaderCell, styles.headerText, { flex: 1.9 }]}>Credit Limit</Text>
            <Text style={[styles.tableHeaderCell, styles.headerText, { flex: 1.5 }]}>Actions</Text>
        </View>
    );

    const renderTableRow = (item) => (
        <View key={item.customer_id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{item.customer_name}</Text>
    
            <Text style={[styles.tableCell, { flex: 0.8 }]}>
                {editCustomerId === item.customer_id ? null : `₹${item.credit_limit}`}
            </Text>
            <View style={[styles.tableCell, styles.actionCell, { flex: 2.2, justifyContent: 'center' }]}>
                {editCustomerId === item.customer_id ? (
                    <View style={styles.editActionContainer}>
                        <TextInput
                            style={styles.editInput}
                            value={newCreditLimit}
                            onChangeText={setNewCreditLimit}
                            placeholder="New Limit"
                            keyboardType="numeric"
                            onSubmitEditing={() => handleUpdateCreditLimit(item.customer_id)}
                        />
                        <TouchableOpacity
                            style={styles.cancelButton} // Added Cancel Button Style
                            onPress={() => {
                                setEditCustomerId(null); // Clear editCustomerId to exit edit mode
                                setNewCreditLimit(""); // Optionally clear the newCreditLimit input
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text> {/* Cancel Button Text */}
                        </TouchableOpacity>
                        {updateLoading ? (
                            <ActivityIndicator size="small" color="#007bff" />
                        ) : null}
                        {updateError && <Text style={styles.updateErrorText}>{updateError}</Text>}
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                            setEditCustomerId(item.customer_id);
                            setNewCreditLimit(String(item.credit_limit));
                        }}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.pageTitle}>Credit Limit Management</Text>

            <TextInput
                style={styles.searchInput}
                placeholder="Search Customer Name or Credit Limit"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text>Loading Credit Data...</Text>
                </View>
            )}

            {error && !loading && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {!loading && !error && (
                <View style={styles.tableContainer}>
                    {renderTableHeader()}
                    {filteredCreditData.map(renderTableRow)}
                    {filteredCreditData.length === 0 && (<Text style={styles.noDataText}>No credit data found.</Text>)}
                </View>
            )}
        </ScrollView>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#F8FAFC',
    },

    cancelButton: {
        backgroundColor: '#E5E7EB', // A light gray color for cancel
        paddingHorizontal: 6,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: 10,
        marginHorizontal: 2, // Spacing from Update button or input
    },
    cancelButtonText: {
        color: '#4B5563', // Darker gray text for cancel button
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 13,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 24,
        color: '#1E293B',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    searchInput: {
        height: 48,
        borderColor: '#E2E8F0',
        borderWidth: 1,
        marginBottom: 24,
        paddingLeft: 16,
        borderRadius: 12,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    loadingContainer: {
        marginTop: 24,
        alignItems: 'center',
    },
    errorContainer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        borderColor: '#FECACA',
        borderWidth: 1,
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
        fontSize: 15,
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 16,
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: 'white',
    },
    tableHeaderCell: {
        fontWeight: '600',
        color: '#475569',
        paddingHorizontal: 12,
        fontSize: 15,
    },
    tableCell: {
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#334155',
        alignItems: 'center',
    },
    editActionContainer: {
        flexDirection: 'row', // Changed to row for horizontal layout
        alignItems: 'center',
        justifyContent: 'space-around', // Distribute space evenly
        paddingVertical: 8, // Add some vertical padding inside edit container
    },
    editInput: {
        height: 40,
        borderColor: '#CBD5E1',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8, // Reduced padding to fit in cell
        fontSize: 14, // Slightly smaller font
        backgroundColor: 'white',
        width: 80, // Increased width for better visibility
        marginRight: 19, // Reduced margin
    },
    editButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 12, // Reduced padding
        paddingVertical: 6, // Reduced padding
        borderRadius: 8,
        minWidth: 60, // Reduced minWidth
    },
    editButtonText: {
        color: 'white',
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 13, // Slightly smaller font
    },
    updateButton: {
        backgroundColor: '#10B981',
        paddingHorizontal: 12, // Reduced padding
        paddingVertical: 6, // Reduced padding
        borderRadius: 8,
        minWidth: 60,
        marginHorizontal: 2, // Added horizontal margin for spacing
    },
    updateButtonText: {
        color: 'white',
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 13, // Slightly smaller font
    },
    noDataText: {
        textAlign: 'center',
        padding: 24,
        fontSize: 16,
        color: '#64748B',
    },
    updateErrorText: {
        color: '#DC2626',
        fontSize: 14,
        marginTop: 4, // Reduced marginTop
        textAlign: 'center',
    },
});

export default CreditLimitPage;