import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, UIManager, StatusBar } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
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

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#003366" barStyle="light-content" />
            
            <View style={styles.header}>
                <Text style={styles.headerText}>Account Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Profile - Available to all roles */}
                <TouchableOpacity style={styles.menuItem} onPress={() => openModal(ProfileContent)}>
                    <View style={styles.menuIconText}>
                        <MaterialIcons name="person-outline" size={24} color="#003366" />
                        <Text style={styles.menuText}>Profile</Text>
                    </View>
                    <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                </TouchableOpacity>

                {/* Orders Options for Admin */}
                {userRole === "admin" && (
                    <>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("UpdateOrders")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="format-list-numbered" size={24} color="#003366" />
                                <Text style={styles.menuText}>Update Orders</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("AdminAssignedUsersPage")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="assignment" size={24} color="#003366" />
                                <Text style={styles.menuText}>Admin Order Acceptance</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("PlaceOrderAdmin")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="autorenew" size={24} color="#003366" />
                                <Text style={styles.menuText}>Auto Order</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("CollectCash")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="attach-money" size={24} color="#003366" />
                                <Text style={styles.menuText}>Collect Cash</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("Invoice")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="receipt" size={24} color="#003366" />
                                <Text style={styles.menuText}>Invoice</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Orders Options for User */}
                {userRole === "user" && (
                    <>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("Orders")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="format-list-numbered" size={24} color="#003366" />
                                <Text style={styles.menuText}>Order History</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                       
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("DeliveryStatusUpdate")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="local-shipping" size={24} color="#003366" />
                                <Text style={styles.menuText}>Delivery Status Update</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("PaymentHistory")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="payments" size={24} color="#003366" />
                                <Text style={styles.menuText}>Payment History</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Reports Options for Admin */}
                {userRole === "admin" && (
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate("LoadingSlip")}
                    >
                        <View style={styles.menuIconText}>
                            <MaterialIcons name="insert-chart" size={24} color="#003366" />
                            <Text style={styles.menuText}>Loading Slip</Text>
                        </View>
                        <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                    </TouchableOpacity>
                )}

                {/* Reports Options for Superadmin */}
                {userRole === "superadmin" && (
                    <>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("UpdateOrdersSA")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="edit" size={24} color="#003366" />
                                <Text style={styles.menuText}>Update/Edit Orders</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("CreditLimit")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="credit-card" size={24} color="#003366" />
                                <Text style={styles.menuText}>Credit Limit</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("Remarks")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="comment" size={24} color="#003366" />
                                <Text style={styles.menuText}>Remarks</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("CashCollectedReport")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="payments" size={24} color="#003366" />
                                <Text style={styles.menuText}>Cash Collected</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("AmountDueReport")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="assessment" size={24} color="#003366" />
                                <Text style={styles.menuText}>Outstanding Report</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("AutoOrderPage")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="autorenew" size={24} color="#003366" />
                                <Text style={styles.menuText}>Auto Order</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("ItemsReport")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="list-alt" size={24} color="#003366" />
                                <Text style={styles.menuText}>Items Report</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate("AutoOrderUpdate")}
                        >
                            <View style={styles.menuIconText}>
                                <MaterialIcons name="update" size={24} color="#003366" />
                                <Text style={styles.menuText}>Auto Order Update</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Privacy Policy and Terms & Conditions at the end - Available to all roles */}
                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIconText}>
                        <MaterialIcons name="security" size={24} color="#003366" />
                        <Text style={styles.menuText}>Privacy Policy</Text>
                    </View>
                    <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIconText}>
                        <MaterialIcons name="info-outline" size={24} color="#003366" />
                        <Text style={styles.menuText}>Terms & Conditions</Text>
                    </View>
                    <MaterialIcons name="keyboard-arrow-right" size={24} color="#003366" />
                </TouchableOpacity>
            </ScrollView>

            <ProfileModal visible={modalData.visible} onClose={closeModal} content={modalData.content} />

            <View style={styles.logoutSection}>
                <View style={styles.buttonContainer}>
                    <PasswordChangeButton style={styles.actionButton} />
                </View>
                <View style={styles.buttonContainer}>
                    <LogOutButton navigation={navigation} style={styles.actionButton} />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.creditText}>
                    Copyright © ORDER APPU Application
                </Text>
                <Text style={styles.creditText}>
                    Designed & Developed by Nicitum Technologies
                </Text>
            </View>
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
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    headerText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
    },
    scrollContainer: {
        paddingHorizontal: 15,
        paddingVertical: 15,
        paddingBottom: 20,
    },
    menuItem: {
        backgroundColor: "#fff",
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    menuIconText: {
        flexDirection: "row",
        alignItems: "center",
    },
    menuText: {
        fontSize: 16,
        marginLeft: 15,
        color: "#333",
        fontWeight: "500",
    },
    logoutSection: {
        padding: 20,
        paddingBottom: 20,
        backgroundColor: '#f5f7fa',
        width: '100%',
    },
    buttonContainer: {
        marginVertical: 5,
        minHeight: 48,
        width: '100%',
    },
    actionButton: {
        width: '100%',
        minHeight: 48,
        marginVertical: 5,
        backgroundColor: "#003366",
        borderRadius: 8,
    },
    footer: {
        backgroundColor: "#f5f7fa",
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: "#e5e5e5",
    },
    creditText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#003366',
        fontWeight: '500',
        lineHeight: 20,
    },
});

export default ProfilePage;