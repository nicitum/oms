import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, UIManager, StatusBar, Image } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import LogOutButton from "../LogoutButton";
import { useNavigation } from "@react-navigation/native";
import PasswordChangeButton from "../PasswordChangeButton";
import ProfileModal from "./ProfileModal";
import ProfileContent from "./ProfileContent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const ProfilePage = ({ setIsLoggedIn }) => {
    const navigation = useNavigation();
    const [userRole, setUserRole] = useState(null);
    const [modalData, setModalData] = useState({
        visible: false,
        title: "",
        content: null,
    });

    useEffect(() => {
        const getUserRole = async () => {
            try {
                const token = await AsyncStorage.getItem("userAuthToken");
                if (token) {
                    const decoded = jwtDecode(token);
                    setUserRole(decoded.role);
                }
            } catch (error) {
                console.error("Error decoding token:", error);
            }
        };
        getUserRole();
    }, []);

    const openModal = (ContentComponent) => {
        setModalData({
            visible: true,
            content: <ContentComponent />,
        });
    };

    const closeModal = () => {
        setModalData({ ...modalData, visible: false });
    };

    const renderSection = (title, items) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {items.map((item, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.menuItem}
                    onPress={item.onPress}
                >
                    <View style={styles.menuIconText}>
                        <View style={styles.iconContainer}>
                            {item.icon}
                        </View>
                        <Text style={styles.menuText}>{item.text}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );

    const adminItems = [
        {
            text: "Update Orders",
            icon: <MaterialIcons name="edit-note" size={24} color="#003366" />,
            onPress: () => navigation.navigate("UpdateOrders")
        },
        {
            text: "Order Tracking",
            icon: <MaterialIcons name="local-shipping" size={24} color="#003366" />,
            onPress: () => navigation.navigate("OrderTrackingScreen")
        },
        
        {
            text: "Auto Order",
            icon: <MaterialIcons name="autorenew" size={24} color="#003366" />,
            onPress: () => navigation.navigate("PlaceOrderAdmin")
        },
        {
            text: "Collect Cash",
            icon: <MaterialIcons name="attach-money" size={24} color="#003366" />,
            onPress: () => navigation.navigate("CollectCash")
        },
        
        {
            text: "Loading Slip",
            icon: <MaterialIcons name="insert-chart" size={24} color="#003366" />,
            onPress: () => navigation.navigate("LoadingSlip")
        }
    ];

    const userItems = [
        {
            text: "Order History",
            icon: <MaterialIcons name="history" size={24} color="#003366" />,
            onPress: () => navigation.navigate("Orders")
        },
        {
            text: "Location Update",
            icon: <MaterialIcons name="local-shipping" size={24} color="#003366" />,
            onPress: () => navigation.navigate("OrderTrackingCustomerScreen")
        },
        {
            text: "Delivery Status Update",
            icon: <MaterialIcons name="update" size={24} color="#003366" />,
            onPress: () => navigation.navigate("DeliveryStatusUpdate")
        },
        {
            text: "Payment History",
            icon: <MaterialIcons name="payments" size={24} color="#003366" />,
            onPress: () => navigation.navigate("PaymentHistory")
        }
    ];

    const superAdminItems = [
        {
            text: "Order Acceptance",
            icon: <MaterialIcons name="check-circle" size={24} color="#003366" />,
            onPress: () => navigation.navigate("OrderAcceptSA")
        },
        {
            text: "Update/Edit Orders",
            icon: <MaterialIcons name="edit-note" size={24} color="#003366" />,
            onPress: () => navigation.navigate("UpdateOrdersSA")
        },
        {
            text: "Loading Slip",
            icon: <MaterialIcons name="receipt-long" size={24} color="#003366" />,
            onPress: () => navigation.navigate("LoadingSlipSA")
        },
        {
            text: "Invoice",
            icon: <MaterialIcons name="receipt-long" size={24} color="#003366" />,
            onPress: () => navigation.navigate("InvoiceSA")
        },
        {
            text: "Credit Limit",
            icon: <MaterialIcons name="account-balance-wallet" size={24} color="#003366" />,
            onPress: () => navigation.navigate("CreditLimit")
        },
        {
            text: "Remarks",
            icon: <MaterialIcons name="rate-review" size={24} color="#003366" />,
            onPress: () => navigation.navigate("Remarks")
        },
        {
            text: "Cash Collection",
            icon: <MaterialIcons name="point-of-sale" size={24} color="#003366" />,
            onPress: () => navigation.navigate("CollectCashSA")
        },
        {
            text: "Cash Collected",
            icon: <MaterialIcons name="point-of-sale" size={24} color="#003366" />,
            onPress: () => navigation.navigate("CashCollectedReport")
        },
        {
            text: "Outstanding Report",
            icon: <MaterialIcons name="pending-actions" size={24} color="#003366" />,
            onPress: () => navigation.navigate("AmountDueReport")
        },
        {
            text: "Auto Order",
            icon: <MaterialIcons name="schedule" size={24} color="#003366" />,
            onPress: () => navigation.navigate("AutoOrderPage")
        },
        {
            text: "Auto Order Update",
            icon: <MaterialIcons name="update" size={24} color="#003366" />,
            onPress: () => navigation.navigate("AutoOrderUpdate")
        }
    ];

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#003366" barStyle="light-content" />
            
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerText}>Account Settings</Text>
                    <Text style={styles.headerSubText}>Manage your account and preferences</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Profile Section */}
                <View style={styles.section}>
                    <TouchableOpacity 
                        style={styles.profileCard} 
                        onPress={() => openModal(ProfileContent)}
                    >
                        <View style={styles.profileInfo}>
                            <View style={styles.profileIcon}>
                                <Ionicons name="person-circle" size={40} color="#003366" />
                            </View>
                            <View style={styles.profileText}>
                                <Text style={styles.profileName}>View Profile</Text>
                              
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Role-specific Sections */}
                {userRole === "admin" && renderSection("Admin Features", adminItems)}
                {userRole === "user" && renderSection("User Features", userItems)}
                {userRole === "superadmin" && renderSection("Super Admin Features", superAdminItems)}

                {/* Common Sections */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIconText}>
                            <View style={styles.iconContainer}>
                                <MaterialIcons name="security" size={24} color="#003366" />
                            </View>
                            <Text style={styles.menuText}>Privacy Policy</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIconText}>
                            <View style={styles.iconContainer}>
                                <MaterialIcons name="info-outline" size={24} color="#003366" />
                            </View>
                            <Text style={styles.menuText}>Terms & Conditions</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    <View style={styles.buttonContainer}>
                        <PasswordChangeButton />
                        <LogOutButton />
                    </View>
                </View>
            </ScrollView>

            <ProfileModal visible={modalData.visible} onClose={closeModal} content={modalData.content} />

            <View style={styles.footer}>
                <View style={styles.creditContainer}>
                    <Text style={styles.creditText}>
                        Copyright © ORDER APPU Application
                    </Text>
                    <Text style={styles.creditText}>
                        Designed & Developed by Nicitum Technologies
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F7FA",
    },
    header: {
        backgroundColor: "#003366",
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerContent: {
        marginTop: 10,
    },
    headerText: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginBottom: 5,
    },
    headerSubText: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#003366",
        marginBottom: 12,
        marginLeft: 8,
    },
    profileCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    profileInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    profileIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "rgba(0, 51, 102, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    profileText: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#003366",
    },
    profileRole: {
        fontSize: 14,
        color: "#666666",
        marginTop: 2,
    },
    menuItem: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    menuIconText: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0, 51, 102, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
        color: "#333333",
        fontWeight: "500",
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: "#E0E0E0",
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    creditContainer: {
        alignItems: 'center',
    },
    creditText: {
        fontSize: 12,
        color: "#666666",
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default ProfilePage;