import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ipAddress } from "../../urls";
import { MaterialCommunityIcons } from '@expo/vector-icons';

const AdminHomePage = () => {
  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalAmountDue, setTotalAmountDue] = useState(null);
  const [totalAmountPaid, setTotalAmountPaid] = useState(null);
  const [totalAmountPaidCash, setTotalAmountPaidCash] = useState(null);
  const [totalAmountPaidOnline, setTotalAmountPaidOnline] = useState(null);
  const [isTotalDueLoading, setIsTotalDueLoading] = useState(false);
  const [isTotalPaidLoading, setIsTotalPaidLoading] = useState(false);
  const [totalDueError, setTotalDueError] = useState(null);
  const [totalPaidError, setTotalPaidError] = useState(null);
  const navigation = useNavigation();

  // Fetch user details from API
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
        setError(message);
        return null;
      }

      const decodedToken = jwtDecode(token);
      const userDetails = {
        customerName: userGetResponse.user.name,
        customerID: userGetResponse.user.customer_id,
        route: userGetResponse.user.route,
        role: decodedToken.role,
      };

      return userDetails;
    } catch (err) {
      console.error("User details fetch error:", err);
      setIsLoading(false);
      setError("An error occurred while fetching user details.");
      Alert.alert("Error", "An error occurred. Please try again.");
      return null;
    }
  }, [navigation]);

  const fetchTotalAmountDue = useCallback(async () => {
    setIsTotalDueLoading(true);
    setTotalDueError(null);
    try {
      const token = await checkTokenAndRedirect(navigation);
      const response = await fetch(`http://${ipAddress}:8090/admin/total-amount-due`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const message = `Failed to fetch total amount due. Status: ${response.status}`;
        throw new Error(message);
      }
      const data = await response.json();
      setTotalAmountDue(data.totalAmountDue);
    } catch (error) {
      console.error("Error fetching total amount due:", error);
      setTotalDueError("Error fetching total amount due.");
      setTotalAmountDue('Error');
    } finally {
      setIsTotalDueLoading(false);
    }
  }, [navigation]);

  const fetchTotalAmountPaid = useCallback(async () => {
    setIsTotalPaidLoading(true);
    setTotalPaidError(null);
    try {
      const token = await checkTokenAndRedirect(navigation);
      const response = await fetch(`http://${ipAddress}:8090/admin/total-amount-paid`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const message = `Failed to fetch total amount paid. Status: ${response.status}`;
        throw new Error(message);
      }
      const data = await response.json();
      setTotalAmountPaid(data.totalAmountPaid);
      setTotalAmountPaidCash(data.totalAmountPaidCash);
      setTotalAmountPaidOnline(data.totalAmountPaidOnline);
    } catch (error) {
      console.error("Error fetching total amount paid:", error);
      setTotalPaidError("Error fetching total amount paid.");
      setTotalAmountPaid('Error');
    } finally {
      setIsTotalPaidLoading(false);
    }
  }, [navigation]);

  // Fetch data and update state
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const userData = await userDetailsData1();
    if (userData) {
      setUserDetails(userData);
      await fetchTotalAmountDue();
      await fetchTotalAmountPaid();
    }
    setIsLoading(false);
  }, [userDetailsData1, fetchTotalAmountDue, fetchTotalAmountPaid]);

  useFocusEffect(
    useCallback(() => {
      const fetchDataAsync = async () => await fetchData();
      fetchDataAsync();
    }, [fetchData])
  );

  const { customerName, role } = userDetails || {};

  // Card component for financial metrics
  const MetricCard = ({ title, value, icon, isLoading, error }) => (
    <View style={styles.metricCard}>
      <View style={styles.metricIconContainer}>
        <MaterialCommunityIcons name={icon} size={24} color="#003366" />
      </View>
      <View style={styles.metricContent}>
        <Text style={styles.metricTitle}>{title}</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#003366" />
        ) : error ? (
          <Text style={styles.errorTextSmall}>{error}</Text>
        ) : value === 'Error' ? (
          <Text style={styles.errorTextSmall}>Failed to load data</Text>
        ) : (
          <Text style={styles.metricValue}>₹ {value}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
    {/* Header */}
        <View style={styles.header}>
          <Image source={require("../../assets/logo.jpg")} style={styles.logo} />
          <View>
            <Text style={styles.headerTitle}>Order Appu</Text>
            <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003366" />
            <Text style={styles.loadingText}>Loading dashboard data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#d32f2f" />
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Welcome Card */}
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>{customerName || "Admin"}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{role || "Administrator"}</Text>
              </View>
            </View>
            <View style={styles.welcomeImageContainer}>
              <MaterialCommunityIcons name="account-tie" size={60} color="#003366" />
            </View>
          </View>

          {/* Financial Overview Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Financial Overview</Text>
            
            <View style={styles.metricsContainer}>
              <MetricCard 
                title="Total Outstanding" 
                value={totalAmountDue} 
                icon="cash-minus" 
                isLoading={isTotalDueLoading} 
                error={totalDueError} 
              />
              
              <MetricCard 
                title="Total Paid (Cash)" 
                value={totalAmountPaidCash} 
                icon="cash" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError} 
              />
              
              <MetricCard 
                title="Total Paid (Online)" 
                value={totalAmountPaidOnline} 
                icon="credit-card-outline" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError} 
              />
              
              <MetricCard 
                title="Total Amount Paid" 
                value={totalAmountPaid} 
                icon="cash-multiple" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError} 
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsContainer}>
            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Home', { screen: 'OrderHistorySA' })}
            >
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#003366" />
                <Text style={styles.actionText}>Order History</Text>
            </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <MaterialCommunityIcons name="account-group-outline" size={24} color="#003366" />
                <Text style={styles.actionText}>Customers</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Home', { screen: 'InvoiceDisplay' })}
            >
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#003366" />
                <Text style={styles.actionText}>Invoice Display</Text>
            </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003366',
    paddingVertical: 35,
    paddingHorizontal: 20,
    elevation: 4,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#003366',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#e6eef7',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: '#003366',
    fontWeight: '500',
    fontSize: 14,
  },
  welcomeImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 12,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconContainer: {
    backgroundColor: '#e6eef7',
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
  },
  metricContent: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  errorTextSmall: {
    fontSize: 12,
    color: '#d32f2f',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '31%',
    elevation: 2,
  },
  actionText: {
    marginTop: 8,
    color: '#003366',
    fontWeight: '500',
  },
});

export default AdminHomePage;