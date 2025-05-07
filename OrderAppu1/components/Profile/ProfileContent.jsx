import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ipAddress } from "../../urls";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";

const ProfileContent = () => {
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState(null);

    const navigation = useNavigation();

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                const token = await checkTokenAndRedirect(navigation);
                if (!token) throw new Error("No authorization token found.");

                const response = await axios.get(
                    `http://${ipAddress}:8091/userDetails`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const { user } = response.data;
                setUserData(user);
            } catch (err) {
                setError(err.message || "Failed to fetch data.");
            } finally {
                setLoading(false);
            }
        };

        fetchUserDetails();
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003366" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={48} color="#E74C3C" />
                <Text style={styles.errorText}>Error: {error}</Text>
            </View>
        );
    }

    const renderInfoCard = (title, value, icon) => (
        <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
                <MaterialIcons name={icon} size={24} color="#003366" />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{title}</Text>
                <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
            </View>
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <MaterialIcons name="person" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.userName}>{userData?.name || 'User'}</Text>
                <Text style={styles.userRole}>{userData?.role || 'Member'}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                {renderInfoCard('Username', userData?.username, 'person-outline')}
                {renderInfoCard('Phone Number', userData?.phone, 'phone')}
                {renderInfoCard('Email', userData?.email, 'email')}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Information</Text>
                {renderInfoCard('Delivery Address', userData?.delivery_address, 'location-on')}
                {renderInfoCard('Route', userData?.route, 'directions')}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F7FA",
    },
    contentContainer: {
        paddingBottom: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F7FA",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#666666",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F7FA",
        padding: 24,
    },
    errorText: {
        marginTop: 12,
        fontSize: 16,
        color: "#E74C3C",
        textAlign: "center",
    },
    header: {
        backgroundColor: "#003366",
        padding: 20,
        alignItems: "center",
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 24,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    userName: {
        fontSize: 18,
        fontWeight: "500",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    userRole: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
    },
    section: {
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#003366",
        marginBottom: 16,
        marginLeft: 4,
    },
    infoCard: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        width: '100%',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0, 51, 102, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        color: "#666666",
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: "#333333",
        fontWeight: "500",
    },
});

export default ProfileContent;
