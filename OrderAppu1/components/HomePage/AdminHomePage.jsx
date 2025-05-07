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
  Animated,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ipAddress } from "../../urls";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Button } from 'react-native-paper';

const COLORS = {
  primary: '#003366',
  secondary: '#004d99',
  accent: '#0066cc',
  background: '#f5f7fa',
  surface: '#ffffff',
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    light: '#ffffff',
  },
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
};

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
      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
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
      const response = await fetch(`http://${ipAddress}:8091/admin/total-amount-due`, {
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
      const response = await fetch(`http://${ipAddress}:8091/admin/total-amount-paid`, {
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

  // Enhanced MetricCard component with better styling
  const MetricCard = ({ title, value, icon, isLoading, error, color = COLORS.primary }) => (
    <Card style={styles.metricCard}>
      <Card.Content style={styles.metricContent}>
        <View style={[styles.metricIconContainer, { backgroundColor: `${color}20` }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <View style={styles.metricTextContainer}>
          <Text style={styles.metricTitle}>{title}</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={color} />
          ) : error ? (
            <Text style={styles.errorTextSmall}>{error}</Text>
          ) : value === 'Error' ? (
            <Text style={styles.errorTextSmall}>Failed to load data</Text>
          ) : (
            <Text style={[styles.metricValue, { color }]}>₹ {value}</Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  // Enhanced ActionButton component
  const ActionButton = ({ icon, label, onPress, color = COLORS.primary }) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: `${color}10` }]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      {/* Enhanced Header */}
      <Animated.View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={require("../../assets/logo.jpg")} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Order Appu</Text>
            <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
          </View>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>Error: {error}</Text>
          <Button
            mode="contained"
            onPress={fetchData}
            style={styles.retryButton}
            labelStyle={styles.retryButtonText}
          >
            Retry
          </Button>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Card */}
          <Card style={styles.welcomeCard}>
            <Card.Content style={styles.welcomeContent}>
              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{customerName || "Admin"}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{role || "Administrator"}</Text>
                </View>
              </View>
              <View style={styles.welcomeIconContainer}>
                <MaterialCommunityIcons name="account-tie" size={60} color={COLORS.primary} />
              </View>
            </Card.Content>
          </Card>

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
                color={COLORS.warning}
              />
              <MetricCard 
                title="Total Paid (Cash)" 
                value={totalAmountPaidCash} 
                icon="cash" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError}
                color={COLORS.success}
              />
              <MetricCard 
                title="Total Paid (Online)" 
                value={totalAmountPaidOnline} 
                icon="credit-card-outline" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError}
                color={COLORS.accent}
              />
              <MetricCard 
                title="Total Amount Paid" 
                value={totalAmountPaid} 
                icon="cash-multiple" 
                isLoading={isTotalPaidLoading} 
                error={totalPaidError}
                color={COLORS.primary}
              />
            </View>
          </View>

          {/* Quick Actions Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="file-document-outline"
                label="Order History"
                onPress={() => navigation.navigate('Home', { screen: 'OrderHistorySA' })}
                color={COLORS.primary}
              />
              <ActionButton
                icon="file-document-outline"
                label="Invoice Display"
                onPress={() => navigation.navigate('Home', { screen: 'InvoiceDisplay' })}
                color={COLORS.primary}
              />
              <ActionButton
                icon="file-document-outline"
                label="Items Report"
                onPress={() => navigation.navigate('Home', { screen: 'ItemsReport' })}
                color={COLORS.primary}
              />
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
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingVertical: 20,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.light,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.text.light,
    opacity: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.text.light,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
  },
  welcomeCard: {
    marginBottom: 20,
    elevation: 2,
    borderRadius: 12,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginVertical: 4,
  },
  roleBadge: {
    backgroundColor: `${COLORS.primary}20`,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  welcomeIconContainer: {
    marginLeft: 16,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    marginBottom: 16,
    elevation: 2,
    borderRadius: 12,
  },
  metricContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorTextSmall: {
    fontSize: 12,
    color: COLORS.error,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '31%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 0,
  },
  actionText: {
    marginTop: 8,
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AdminHomePage;