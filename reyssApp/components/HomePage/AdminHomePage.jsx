import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    Alert,
    ActivityIndicator, // Import ActivityIndicator
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ipAddress } from "../../urls";

const AdminHomePage = () => {
    const [userDetails, setUserDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Add loading state for initial page load
    const [error, setError] = useState(null); // Add error state for initial page load
    const [totalAmountDue, setTotalAmountDue] = useState(null); 
    const [totalAmountPaid, setTotalAmountPaid] = useState(null);
    const [totalAmountPaidCash, setTotalAmountPaidCash] = useState(null);
    const [totalAmountPaidOnline, setTotalAmountPaidOnline] = useState(null);/// State for total amount due
    const [isTotalDueLoading, setIsTotalDueLoading] = useState(false); 
    const [isTotalPaidLoading, setIsTotalPaidLoading] = useState(false); // Loading state for total amount due section
    const [totalDueError, setTotalDueError] = useState(null); 
    const [totalPaidError, setTotalPaidError] = useState(null);// Error state for total amount due section
    const navigation = useNavigation();

    // Fetch user details from API - Copied from HomePage.jsx as requested
    const userDetailsData1 = useCallback(async () => {
        try {
            const token = await checkTokenAndRedirect(navigation);
            const response = await fetch(`http://${ipAddress}:8090/userDetails`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            const userGetResponse = await response.json();
            if (!response.ok || !userGetResponse.status) {
                const message = userGetResponse.message || "Something went wrong";
                Alert.alert("Failed", message);
                setIsLoading(false);
                setError(message); // Set error state
                return null; // Indicate failure
            }

            const decodedToken = jwtDecode(token); // Decode token here to access role
            const userDetails = {
                customerName: userGetResponse.user.name,
                customerID: userGetResponse.user.customer_id,
                route: userGetResponse.user.route, // Keep route if it's relevant for admin, if not, can remove
                role: decodedToken.role, // Extract role from decoded token
            };

            return userDetails;

        } catch (err) {
            console.error("User details fetch error:", err);
            setIsLoading(false);
            setError("An error occurred while fetching user details."); // Set error state
            Alert.alert("Error", "An error occurred. Please try again.");
            return null; // Indicate failure
        }
    }, [navigation]);


    const fetchTotalAmountDue = useCallback(async () => {
        setIsTotalDueLoading(true); // Start loading for total amount due
        setTotalDueError(null); // Reset error for total amount due
        try {
            const token = await checkTokenAndRedirect(navigation); // Reuse token logic
            const response = await fetch(`http://${ipAddress}:8090/admin/total-amount-due`, {
                headers: {
                    Authorization: `Bearer ${token}`, // Include token for authorization if needed
                },
            });
            if (!response.ok) {
                const message = `Failed to fetch total amount due. Status: ${response.status}`;
                throw new Error(message);
            }
            const data = await response.json();
            setTotalAmountDue(data.totalAmountDue); // Update totalAmountDue state
        } catch (error) {
            console.error("Error fetching total amount due:", error);
            setTotalDueError("Error fetching total amount due."); // Set error state for total due
            setTotalAmountDue('Error'); // Set to 'Error' to display error in UI
        } finally {
            setIsTotalDueLoading(false); // End loading for total amount due
        }
    }, [navigation]);

    const fetchTotalAmountPaid = useCallback(async () => {
        setIsTotalPaidLoading(true); // Start loading for total amount due
        setTotalDueError(null); // Reset error for total amount due
        try {
            const token = await checkTokenAndRedirect(navigation); // Reuse token logic
            const response = await fetch(`http://${ipAddress}:8090/admin/total-amount-paid`, {
                headers: {
                    Authorization: `Bearer ${token}`, // Include token for authorization if needed
                },
            });
            if (!response.ok) {
                const message = `Failed to fetch total amount paid. Status: ${response.status}`;
                throw new Error(message);
            }
            const data = await response.json();
            setTotalAmountPaid(data.totalAmountPaid);
            setTotalAmountPaidCash(data.totalAmountPaidCash)
            setTotalAmountPaidOnline(data.totalAmountPaidOnline) // Update totalAmountDue state
        } catch (error) {
            console.error("Error fetching total amount paid:", error);
            setTotalPaidError("Error fetching total amount paid."); // Set error state for total due
            setTotalAmountPaid('Error'); // Set to 'Error' to display error in UI
        } finally {
            setIsTotalPaidLoading(false); // End loading for total amount due
        }
    }, [navigation]);

     // Fetch data and update state (modified to call fetchTotalAmountDue)
     const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const userData = await userDetailsData1();
        if (userData) {
            setUserDetails(userData);
            await fetchTotalAmountDue();
            await fetchTotalAmountPaid(); // Fetch total amount due after user details
        } else {
            setIsLoading(false); // Stop loading even if userData fetch fails, to show error
        }
        setIsLoading(false); // Stop loading after all fetches are complete, success or fail for userData (error handled inside)
    }, [userDetailsData1, fetchTotalAmountDue,fetchTotalAmountPaid]); // Added fetchTotalAmountDue to dependency array


    useFocusEffect(
        useCallback(() => {
            const fetchDataAsync = async () => await fetchData();
            fetchDataAsync();
        }, [fetchData])
    );

    const { customerName, role } = userDetails || {}; // Extract name and role

    return (
        <ScrollView contentContainerStyle={[styles.container, styles.gradientBackground]}>
            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FDDA0D" />
                    <Text style={styles.loadingText}>Loading Admin Home Page...</Text>
                </View>
            )}

            {error && !isLoading && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error: {error}</Text>
                </View>
            )}

            {!isLoading && !error && (
                <>
                    {/* Logo Section */}
                    <View style={styles.section}>
                        <Image source={require("../../assets/SL.png")} style={styles.logo} />
                        <View style={styles.companyInfo}>
                            <Text style={[styles.companyName, styles.royalYellowText]}>SL ENTERPRISESS</Text>
                            <Text style={[styles.proprietorName, styles.whiteText]}>Proprietor Lokesh Naidu</Text>
                        </View>
                    </View>

                    {/* User Details Card */}
                    <View style={styles.card}>
                        <Text style={[styles.cardTitle, styles.royalYellowText]}>User Details</Text>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, styles.whiteText]}>Name:</Text>
                            <Text style={[styles.detailValue, styles.whiteText]}>{customerName || "N/A"}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, styles.whiteText]}>Role:</Text>
                            <Text style={[styles.detailValue, styles.whiteText]}>{role || "N/A"}</Text>
                        </View>
                    </View>

                    {/* Total Amount Due Card */}
                    <View style={[styles.card, styles.amountDueCard]}>
                        <Text style={[styles.cardTitle, styles.royalYellowText]}>Total Outstanding</Text>
                        {isTotalDueLoading ? (
                            <ActivityIndicator size="large" color="#FDDA0D" />
                        ) : totalDueError ? (
                            <Text style={styles.errorTextSmall}>{totalDueError}</Text>
                        ) : totalAmountDue === 'Error' ? (
                            <Text style={styles.errorTextSmall}>Failed to load amount due.</Text>
                        ) : (
                            <Text style={styles.amountDueValue}>₹ {totalAmountDue}</Text>
                        )}
                    </View>

                    <View style={[styles.card, styles.amountDueCard]}>
                        <Text style={[styles.cardTitle, styles.royalYellowText]}>Total Amount Paid Cash</Text>
                        {isTotalDueLoading ? (
                            <ActivityIndicator size="large" color="#FDDA0D" />
                        ) : totalDueError ? (
                            <Text style={styles.errorTextSmall}>{totalDueError}</Text>
                        ) : totalAmountDue === 'Error' ? (
                            <Text style={styles.errorTextSmall}>Failed to load amount due.</Text>
                        ) : (
                            <Text style={styles.amountDueValue}>₹ {totalAmountPaidCash}</Text>
                        )}
                    </View>
                    <View style={[styles.card, styles.amountDueCard]}>
                        <Text style={[styles.cardTitle, styles.royalYellowText]}>Total Amount Paid Online</Text>
                        {isTotalDueLoading ? (
                            <ActivityIndicator size="large" color="#FDDA0D" />
                        ) : totalDueError ? (
                            <Text style={styles.errorTextSmall}>{totalDueError}</Text>
                        ) : totalAmountDue === 'Error' ? (
                            <Text style={styles.errorTextSmall}>Failed to load amount due.</Text>
                        ) : (
                            <Text style={styles.amountDueValue}>₹ {totalAmountPaidOnline}</Text>
                        )}
                    </View>

                      {/* Total Amount Paid Card */}
                      <View style={[styles.card, styles.amountDueCard]}>
                        <Text style={[styles.cardTitle, styles.royalYellowText]}>Total Amount Paid</Text>
                        {isTotalDueLoading ? (
                            <ActivityIndicator size="large" color="#FDDA0D" />
                        ) : totalDueError ? (
                            <Text style={styles.errorTextSmall}>{totalDueError}</Text>
                        ) : totalAmountDue === 'Error' ? (
                            <Text style={styles.errorTextSmall}>Failed to load amount due.</Text>
                        ) : (
                            <Text style={styles.amountDueValue}>₹ {totalAmountPaid}</Text>
                        )}
                    </View>
               
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingBottom: 20,
        paddingTop: 20,
        backgroundColor: '#ffffff',
    },
    amountDueValue: {
        fontSize: 24, // Larger font size for the amount due
        fontWeight: 'bold',
        textAlign: 'center',
    },
    errorTextSmall: {
        fontSize: 16,
        color: '#d32f2f', // Red error text for amount due error
        textAlign: 'center',
    },
    gradientBackground: {
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#d32f2f',
        textAlign: 'center',
    },
    section: {
        flexDirection: "row",
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        marginHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    logo: {
        width: 70,
        height: 70,
        resizeMode: 'contain',
        marginRight: 15,
    },
    companyInfo: {
        flex: 1,
    },
    companyName: {
        fontSize: 22,
        fontWeight: "bold",
    },
    proprietorName: {
        fontSize: 17,
        color: '#666',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 15,
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: "row",
        marginBottom: 10,
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 17,
        fontWeight: "500",
        marginRight: 8,
        flex: 1,
        color: '#444',
    },
    detailValue: {
        fontSize: 17,
        flex: 2,
        textAlign: 'right',
        color: '#444',
    },
    amountDueCard: {
        minHeight: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCardText: {
        fontSize: 18,
        color: '#888',
        fontStyle: 'italic',
    },
    royalYellowText: {
        color: '#ff8f00', // Warm orange-yellow
    },
    whiteText: {
        color: '#444', // Dark gray for better readability
    },
});

export default AdminHomePage;