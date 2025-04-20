import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ipAddress } from "../../urls";
import LoadingIndicator from "../general/Loader";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";

const ProfileContent = () => {
        const [loading, setLoading] = useState(true);
        const [userData, setUserData] = useState(null);
        const [defaultOrder, setDefaultOrder] = useState(null);
        const [error, setError] = useState(null);

        const navigation = useNavigation();

        useEffect(() => {
                const fetchUserDetails = async () => {
                        try {
                                const token = await checkTokenAndRedirect(navigation);
                                if (!token) throw new Error("No authorization token found.");

                                const response = await axios.get(
                                        `http://${ipAddress}:8090/userDetails`,
                                        {
                                                headers: {
                                                        Authorization: `Bearer ${token}`,
                                                },
                                        }
                                );

                                const { user, defaultOrder } = response.data;
                                setUserData(user);
                                setDefaultOrder(defaultOrder);
                        } catch (err) {
                                setError(err.message || "Failed to fetch data.");
                        } finally {
                                setLoading(false);
                        }
                };

                fetchUserDetails();
        }, []);

        if (loading) {
                <LoadingIndicator />;
        }

        if (error) {
                return (
                        <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>Error: {error}</Text>
                        </View>
                );
        }

        return (
                <View style={styles.container}>
                        <View style={styles.userInfo}>
                                <Text style={styles.title}>Name: {userData?.name}</Text>
                                <Text style={styles.detailText}>Phone: {userData?.phone}</Text>
                                <Text style={styles.detailText}>Username: {userData?.username}</Text>
                                <Text style={styles.detailText}>
                                        Delivery Address: {userData?.delivery_address}
                                </Text>
                                <Text style={styles.detailText}>Route: {userData?.route}</Text>
                        </View>
                </View>
        );
};

const styles = StyleSheet.create({
        container: {
                flex: 1,
                width: "100%",
                backgroundColor: "#fff",
                padding: 20,
        },
        loadingContainer: {
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
        },
        errorContainer: {
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
        },
        errorText: {
                color: "red",
                fontSize: 16,
                textAlign: "center",
        },
        userInfo: {
                width: "100%",
                paddingVertical: 10,
        },
        title: {
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 15,
                color: "#333",
        },
        detailText: {
                fontSize: 16,
                marginBottom: 12,
                color: "#666",
        },
});

export default ProfileContent;
