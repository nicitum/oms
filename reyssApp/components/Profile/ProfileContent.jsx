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
            <View style={styles.section}>
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
        </View>
    );
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
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
    section: {
        width: "100%",
        marginBottom: 10,
        paddingVertical: 20,
        backgroundColor: "#fff",
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.12)",
        alignItems: "center",
    },
    header: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 15,
        color: "#333",
        textAlign: "center",
    },
    userInfo: {
        width: "80%",
        marginBottom: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    orderInfo: {
        marginTop: 10,
        alignItems: "center",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 5,
        color: "#333",
        textAlign: "center",
    },
    detailText: {
        fontSize: 16,
        marginBottom: 8,
        color: "#666",
        textAlign: "center",
    },
    subHeader: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 10,
        marginBottom: 5,
        textAlign: "center",
    },
});

export default ProfileContent;