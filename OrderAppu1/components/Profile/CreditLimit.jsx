import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ToastAndroid,
    Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { ipAddress } from "../../urls";
import Icon from "react-native-vector-icons/MaterialIcons";

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
    const primaryColor = "#003366"; // Deep blue for the theme

    const fetchCreditData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await checkTokenAndRedirect(navigation);
            const response = await fetch(`http://${ipAddress}:8091/fetch_credit_data`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch credit data. Status: ${response.status}`);
            }
            const data = await response.json();
            setCreditData(data.creditData || []);
            setFilteredCreditData(data.creditData || []);
        } catch (err) {
            console.error("Error fetching credit data:", err);
            setError("Failed to load credit data. Please try again.");
            Alert.alert("Error", "Failed to load credit data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            fetchCreditData();
        }, [fetchCreditData])
    );

    useEffect(() => {
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            const filteredData = creditData.filter(item =>
                String(item.customer_name).toLowerCase().includes(lowerQuery) ||
                String(item.credit_limit).toLowerCase().includes(lowerQuery)
            );
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
        if (isNaN(Number(newCreditLimit)) || Number(newCreditLimit) < 0) {
            Alert.alert("Validation Error", "Credit limit must be a valid positive number.");
            return;
        }

        setUpdateLoading(true);
        setUpdateError(null);
        try {
            const token = await checkTokenAndRedirect(navigation);
            const response = await fetch(`http://${ipAddress}:8091/update_credit_limit`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ customerId, creditLimit: Number(newCreditLimit) }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update credit limit. Status: ${response.status}`);
            }

            // Update local state to reflect the change immediately
            setCreditData(prev =>
                prev.map(item =>
                    item.customer_id === customerId
                        ? { ...item, credit_limit: Number(newCreditLimit) }
                        : item
                )
            );
            setFilteredCreditData(prev =>
                prev.map(item =>
                    item.customer_id === customerId
                        ? { ...item, credit_limit: Number(newCreditLimit) }
                        : item
                )
            );

            // Show success message
            if (Platform.OS === "android") {
                ToastAndroid.show("Credit limit updated successfully!", ToastAndroid.SHORT);
            } else {
                Alert.alert("Success", `Credit limit updated to ₹${newCreditLimit}`);
            }

            setEditCustomerId(null);
            setNewCreditLimit("");
        } catch (updateErr) {
            console.error("Error updating credit limit:", updateErr);
            setUpdateError(updateErr.message || "Failed to update credit limit.");
            Alert.alert("Error", updateErr.message || "Failed to update credit limit. Please try again.");
        } finally {
            setUpdateLoading(false);
        }
    };

    const renderCreditItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{item.customer_name}</Text>
                <Text style={styles.creditLimit}>
                    {editCustomerId !== item.customer_id ? `₹${item.credit_limit}` : ""}
                </Text>
            </View>
            {editCustomerId === item.customer_id ? (
                <View style={styles.editContainer}>
                    <TextInput
                        style={styles.editInput}
                        value={newCreditLimit}
                        onChangeText={setNewCreditLimit}
                        placeholder="Enter new limit"
                        keyboardType="numeric"
                        autoFocus
                    />
                    <View style={styles.editActions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.saveButton]}
                            onPress={() => handleUpdateCreditLimit(item.customer_id)}
                            disabled={updateLoading}
                        >
                            {updateLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.actionButtonText}>Save</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={() => {
                                setEditCustomerId(null);
                                setNewCreditLimit("");
                            }}
                            disabled={updateLoading}
                        >
                            <Text style={styles.actionButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                    {updateError && <Text style={styles.errorText}>{updateError}</Text>}
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                        setEditCustomerId(item.customer_id);
                        setNewCreditLimit(String(item.credit_limit));
                    }}
                >
                    <Icon name="edit" size={20} color="#fff" />
                    <Text style={styles.editButtonText}>Edit Limit</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Credit Limit Management</Text>
            </View>
            <View style={styles.searchContainer}>
                <Icon name="search" size={24} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or credit limit"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                />
            </View>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={styles.loadingText}>Loading credit data...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Icon name="error" size={40} color="#dc3545" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={fetchCreditData}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filteredCreditData}
                    renderItem={renderCreditItem}
                    keyExtractor={item => item.customer_id.toString()}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="inbox" size={40} color={primaryColor} />
                            <Text style={styles.emptyText}>No credit data found</Text>
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
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        margin: 16,
        backgroundColor: "#fff",
        borderRadius: 12,
        elevation: 3,
        paddingHorizontal: 10,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: "#333",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#003366",
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
        marginVertical: 10,
        textAlign: "center",
    },
    retryButton: {
        backgroundColor: "#003366",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    listContent: {
        padding: 16,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    customerName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#003366",
        flex: 1,
    },
    creditLimit: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#003366",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    editButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },
    editContainer: {
        paddingTop: 8,
    },
    editInput: {
        height: 40,
        borderColor: "#003366",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: "#f5f7fa",
    },
    editActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginLeft: 8,
        minWidth: 80,
        alignItems: "center",
    },
    saveButton: {
        backgroundColor: "#003366",
    },
    cancelButton: {
        backgroundColor: "#6c757d",
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    emptyContainer: {
        alignItems: "center",
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        color: "#003366",
        marginTop: 10,
    },
});

export default CreditLimitPage;