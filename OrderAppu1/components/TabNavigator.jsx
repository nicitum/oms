import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import HomeStack from "./HomePage/HomeStack";
import ProfileStack from "./Profile/ProfileStack";
import Transactions from "./Transactions/transactions";
import IndentStack from "./IndentPage/IndentStack";
import { View, Text, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { useNavigation } from "@react-navigation/native";

import AdminOrderHistory from "./Profile/AdminOrderHistory";
import AdminTransactions from "./Profile/AdminTransactions";
import TransactionsPage from "./route_mgr/Transactions";
import ProductsComponent from "./HomePage/ProductList";

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const navigation = useNavigation();

    const checkClientStatus = async () => {
        try {
            const clientStatusResponse = await fetch(`http://147.93.110.150:3001/api/client_status/amar`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            
            const clientStatusData = await clientStatusResponse.json();
            
            if (!clientStatusResponse.ok || !clientStatusData.success || 
                !clientStatusData.data.length || clientStatusData.data[0].status !== "Active") {
                // Remove the token and navigate to login
                await AsyncStorage.removeItem("userAuthToken");
                Alert.alert(
                    "License Error",
                    "License status inactive. Please check with Owner",
                    [{ 
                        text: "OK",
                        onPress: () => navigation.replace("Login")
                    }]
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error("Error checking client status:", error);
            // On error, logout for safety
            await AsyncStorage.removeItem("userAuthToken");
            navigation.replace("Login");
            return false;
        }
    };

    useEffect(() => {
        const checkUserRole = async () => {
            setIsLoading(true);
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");

            if (userAuthToken) {
                try {
                    const decodedToken = jwtDecode(userAuthToken);
                    // Check client status first
                    const isActive = await checkClientStatus();
                    if (!isActive) return;

                    if (decodedToken.role === "admin") {
                        setIsAdmin(true);
                        setIsSuperAdmin(false);
                    } else if (decodedToken.role === "superadmin") {
                        setIsAdmin(true);
                        setIsSuperAdmin(true);
                    } else {
                        setIsAdmin(false);
                        setIsSuperAdmin(false);
                    }
                } catch (error) {
                    console.error("Token verification error:", error);
                    setIsAdmin(false);
                    setIsSuperAdmin(false);
                }
            } else {
                setIsAdmin(false);
                setIsSuperAdmin(false);
            }
            setIsLoading(false);
        };
        checkUserRole();
    }, []);

    // Add tab change listener
    const handleTabPress = async () => {
        const isActive = await checkClientStatus();
        if (!isActive) {
            return false; // Prevent tab change if status is not active
        }
        return true;
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#003366", // Deep blue theme
                tabBarInactiveTintColor: "#8A939C", // Softer gray for inactive
                tabBarStyle: styles.tabBar, // Custom tab bar style
                tabBarLabelStyle: styles.tabLabel, // Custom label style
            }}
            screenListeners={{
                tabPress: (e) => {
                    // Prevent default action
                    e.preventDefault();
                    // Check status before allowing tab change
                    handleTabPress().then(canProceed => {
                        if (canProceed) {
                            // Manually navigate if status is active
                            navigation.navigate(e.target.split("-")[0]);
                        }
                    });
                },
            }}
        >
           <Tab.Screen
                name="Home"
                component={HomeStack}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            
            <Tab.Screen
                name="Products"
                component={ProductsComponent}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="cart-outline" size={size} color={color} />
                    ),
                }}
            />

            {!isSuperAdmin && (
                <Tab.Screen
                    name="Indent"
                    component={isAdmin ? AdminOrderHistory : IndentStack}
                    options={{
                       
                        headerTitle: isAdmin ? "Order History" : "Indent",
                        headerStyle: styles.header,
                        headerTitleStyle: styles.headerTitle,
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="file-document-outline" size={size} color={color} />
                        ),
                    }}
                />
            )}

            {!isSuperAdmin && !isAdmin && (
                <Tab.Screen
                    name="Transactions"
                    component={Transactions}
                    options={{
                        headerShown: true,
                        headerTitle: "Transactions",
                        headerStyle: styles.header,
                        headerTitleStyle: styles.headerTitle,
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
                        ),
                    }}
                />
            )}

            {isSuperAdmin && (
                <Tab.Screen
                    name="Transactions"
                    component={AdminTransactions}
                    options={{
                        headerShown: true,
                        headerTitle: "Admin Transactions",
                        headerStyle: styles.header,
                        headerTitleStyle: styles.headerTitle,
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
                        ),
                    }}
                />
            )}

            <Tab.Screen
                name="Profile"
                component={ProfileStack}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F6F5", // Light neutral background
    },
    loadingText: {
        fontSize: 16,
        color: "#003366",
        fontWeight: "500",
    },
    tabBar: {
        backgroundColor: "#FFFFFF", // White background for a clean look
        borderTopWidth: 1,
        borderTopColor: "#E0E4E7", // Subtle border
        paddingVertical: 5,
        height: 60,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 5,
    },
    header: {
        backgroundColor: "#003366", // Deep blue header
    },
    headerTitle: {
        color: "#FFFFFF", // White text for contrast
        fontWeight: "600",
        fontSize: 18,
    },
});

export default TabNavigator;