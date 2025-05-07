import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { ipAddress } from '../../urls';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Screen dimensions
const { width } = Dimensions.get('window');
const ASPECT_RATIO = width / 360;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

const OrderTrackingScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adminLocation, setAdminLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [decodedAddresses, setDecodedAddresses] = useState({});
  const [deliveryLocations, setDeliveryLocations] = useState({});

  const mapRef = useRef(null);

  // Function to push delivery person's location to backend
  const pushLocationToBackend = async (orderId, latitude, longitude) => {
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) {
        console.warn('[WARN] No authentication token found');
        return;
      }

      const url = `http://${ipAddress}:8091/update-delivery-location`;
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const body = JSON.stringify({
        order_id: orderId,
        latitude,
        longitude,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[WARN] Failed to update location: ${response.status} - ${errorText}`);
        return;
      }

      const data = await response.json();
      if (!data.success) {
        console.warn('[WARN] Failed to update location:', data.message);
        return;
      }

      console.log('[DEBUG] Location updated for order', orderId);
    } catch (err) {
      console.error('[ERROR] Pushing location to backend:', err);
      Toast.show({
        type: 'error',
        text1: 'Location Update Error',
        text2: 'Failed to update location.',
      });
    }
  };

  // Initialize admin location with retry logic
  const initializeLocation = async (retryCount = 0) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (retryCount < MAX_RETRIES) {
          console.warn('[WARN] Permission denied, retrying:', retryCount + 1);
          setTimeout(() => initializeLocation(retryCount + 1), RETRY_DELAY);
          return;
        }
        console.warn('[WARN] Location permission denied');
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please enable location permissions in settings.',
        });
        Linking.openSettings().catch((err) => console.error('[ERROR] Opening settings:', err));
        return;
      }

      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        if (retryCount < MAX_RETRIES) {
          console.warn('[WARN] Location services disabled, retrying:', retryCount + 1);
          setTimeout(() => initializeLocation(retryCount + 1), RETRY_DELAY);
          return;
        }
        console.warn('[WARN] Location services disabled');
        Toast.show({
          type: 'error',
          text1: 'Location Services Disabled',
          text2: 'Please enable location services in settings.',
        });
        Linking.openSettings().catch((err) => console.error('[ERROR] Opening settings:', err));
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });
      const initialLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setAdminLocation(initialLocation);

      // Push initial location if an order is selected and out for delivery
      if (selectedOrder && selectedOrder.delivery_status === 'out for delivery') {
        await pushLocationToBackend(
          selectedOrder.id,
          initialLocation.latitude,
          initialLocation.longitude
        );
      }

      const locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          const updatedLocation = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setAdminLocation(updatedLocation);

          // Push location updates only for selected order in "out for delivery"
          if (selectedOrder && selectedOrder.delivery_status === 'out for delivery') {
            pushLocationToBackend(
              selectedOrder.id,
              updatedLocation.latitude,
              updatedLocation.longitude
            );
          }
        }
      );

      return () => {
        if (locationWatcher) locationWatcher.remove();
      };
    } catch (locError) {
      if (retryCount < MAX_RETRIES) {
        console.warn('[WARN] Location fetch failed, retrying:', retryCount + 1);
        setTimeout(() => initializeLocation(retryCount + 1), RETRY_DELAY);
        return;
      }
      console.error('[ERROR] Initializing location:', locError);
      Toast.show({
        type: 'error',
        text1: 'Location Error',
        text2: 'Failed to get location. Please ensure location services are enabled.',
      });
    }
  };

  // Function to decode coordinates to address
  const decodeLocationToAddress = async (latitude, longitude) => {
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (address && address.length > 0) {
        const formattedAddress = [
          address[0].street,
          address[0].city,
          address[0].region,
          address[0].postalCode,
          address[0].country
        ].filter(Boolean).join(', ');
        
        return formattedAddress || 'Address not available';
      }
      return 'Address not available';
    } catch (error) {
      console.error('[ERROR] Decoding location:', error);
      return 'Error decoding address';
    }
  };

  // Function to get delivery location and decode address for an order
  const getOrderDeliveryLocation = async (order) => {
    try {
      let delivery = null;
      let address = 'Location not available';

      if (order.customer_id) {
        delivery = await fetchCustomerLocation(order.customer_id);
        if (delivery) {
          // Decode the address immediately when we get the coordinates
          address = await decodeLocationToAddress(delivery.latitude, delivery.longitude);
          setDecodedAddresses(prev => ({
            ...prev,
            [order.id]: address
          }));
          setDeliveryLocations(prev => ({
            ...prev,
            [order.id]: delivery
          }));
          return delivery;
        }
      }

      if (order.deliveryAddress) {
        delivery = await getCoordinates(order.deliveryAddress);
        if (delivery) {
          // Decode the address immediately when we get the coordinates
          address = await decodeLocationToAddress(delivery.latitude, delivery.longitude);
          setDecodedAddresses(prev => ({
            ...prev,
            [order.id]: address
          }));
          setDeliveryLocations(prev => ({
            ...prev,
            [order.id]: delivery
          }));
          return delivery;
        }
      }

      // If no location found, update the address state
      setDecodedAddresses(prev => ({
        ...prev,
        [order.id]: address
      }));
      return null;
    } catch (error) {
      console.error('[ERROR] Getting delivery location:', error);
      setDecodedAddresses(prev => ({
        ...prev,
        [order.id]: 'Error getting location'
      }));
      return null;
    }
  };

  // Update handleOrderClick to decode address
  const handleOrderClick = async (order) => {
    if (!order || !order.id) {
      console.warn('[WARN] Invalid order:', order);
      Toast.show({
        type: 'error',
        text1: 'Order Error',
        text2: 'Invalid order data.',
      });
      return;
    }

    setSelectedOrder(order);
    setDeliveryLocation(null);
    setDeliveryAddress('Fetching address...');

    if (!adminLocation) {
      console.warn('[WARN] Admin location not available, attempting to fetch');
      Toast.show({
        type: 'info',
        text1: 'Fetching Location',
        text2: 'Please wait while we get your location...',
      });
      await initializeLocation();
      if (!adminLocation) {
        Toast.show({
          type: 'error',
          text1: 'Navigation Error',
          text2: 'Your location is still not available. Please ensure location services are enabled.',
        });
        return;
      }
    }

    // Push current location when order is selected and out for delivery
    if (order.delivery_status === 'out for delivery' && adminLocation) {
      await pushLocationToBackend(order.id, adminLocation.latitude, adminLocation.longitude);
    }

    let delivery = null;
    let locationSource = 'Unknown';

    try {
      if (order.customer_id) {
        console.log('[DEBUG] Fetching location for customer_id:', order.customer_id);
        delivery = await fetchCustomerLocation(order.customer_id);
        if (delivery) {
          locationSource = 'Backend';
          console.log('[DEBUG] Backend location:', delivery);
          // Decode the delivery location to address
          const address = await decodeLocationToAddress(delivery.latitude, delivery.longitude);
          setDeliveryAddress(address);
        }
      }

      if (!delivery && order.deliveryAddress) {
        console.log('[DEBUG] Geocoding:', order.deliveryAddress);
        delivery = await getCoordinates(order.deliveryAddress);
        if (delivery) {
          locationSource = 'Geocoded';
          console.log('[DEBUG] Geocoded location:', delivery);
          setDeliveryAddress(order.deliveryAddress);
        }
      }

      if (delivery) {
        setDeliveryLocation(delivery);
      } else {
        console.warn('[WARN] No location for order:', order.id);
        setDeliveryAddress('Location not available');
        Toast.show({
          type: 'error',
          text1: 'Navigation Error',
          text2: `No location for Order #${order.id}.`,
        });
      }
    } catch (navError) {
      console.error('[ERROR] Order click:', navError);
      setDeliveryAddress('Error fetching address');
      Toast.show({
        type: 'error',
        text1: 'Navigation Error',
        text2: 'Failed to prepare navigation.',
      });
    }
  };

  // Update fetchAdminOrders to get and decode locations
  const fetchAdminOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No authentication token found.');

      let decodedToken;
      try {
        decodedToken = jwtDecode(token);
      } catch (decodeError) {
        throw new Error('Invalid token.');
      }

      const adminId = decodedToken.id1;
      if (!adminId) throw new Error('Admin ID not found.');

      const todayFormatted = moment().format('YYYY-MM-DD');
      const url = `http://${ipAddress}:8091/get-admin-orders/${adminId}?date=${todayFormatted}`;
      console.log('[DEBUG] Fetching orders:', url);

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const response = await fetch(url, { headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch orders: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch orders.');
      }

      console.log('[DEBUG] Orders:', JSON.stringify(data.orders, null, 2));
      const validOrders = data.orders.filter((order) => order && order.id);
      setOrders(validOrders);

      // Get and decode locations for all orders
      validOrders.forEach(order => {
        if (order.delivery_status === 'out for delivery') {
          getOrderDeliveryLocation(order);
        }
      });
    } catch (fetchError) {
      const errorMessage = fetchError.message || 'Failed to fetch orders.';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Fetch Error',
        text2: errorMessage,
      });
      console.error('[ERROR] Fetching orders:', fetchError);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerLocation = async (userId) => {
    if (!userId) {
      console.warn('[WARN] No userId provided');
      return null;
    }

    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No token found');

      const url = `http://${ipAddress}:8091/get-user-location/${userId}`;
      console.log('[DEBUG] Fetching location:', url);

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const response = await fetch(url, { headers });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[WARN] Failed to fetch location for ${userId}: ${response.status}, ${errorText}`);
        return null;
      }

      const data = await response.json();
      if (!data.success || !data.latitude || !data.longitude) {
        console.warn('[WARN] Invalid location data:', JSON.stringify(data, null, 2));
        return null;
      }

      console.log('[DEBUG] Location:', data);
      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      };
    } catch (error) {
      console.error('[ERROR] Fetching location:', error);
      return null;
    }
  };

  const getCoordinates = async (address) => {
    if (!address) {
      console.warn('[WARN] No address provided');
      return null;
    }

    try {
      const query = `${address}, India`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        console.log('[DEBUG] Geocoded:', address, '->', data[0]);
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
      console.warn('[WARN] Geocoding failed:', address);
      return null;
    } catch (error) {
      console.error('[ERROR] Geocoding:', error);
      Toast.show({
        type: 'error',
        text1: 'Geocoding Error',
        text2: 'Could not find coordinates.',
      });
      return null;
    }
  };

  const updateDeliveryStatus = async (orderId, customerId, newStatus) => {
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No authentication token found.');

      const url = `http://${ipAddress}:8091/update-delivery-status`;
      console.log('[DEBUG] Updating delivery status:', url, { orderId, customerId, newStatus });

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const body = JSON.stringify({
        order_id: orderId,
        customer_id: customerId,
        delivery_status: newStatus,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      const data = await response.json();
      if (!response.ok || !data.status) {
        throw new Error(data.message || 'Failed to update delivery status.');
      }

      console.log('[DEBUG] Delivery status updated:', data);
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, delivery_status: newStatus } : order
        )
      );
      // Stop location updates if status changes to delivered
      if (newStatus === 'delivered') {
        setSelectedOrder(null);
      }
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Delivery status updated successfully.',
      });
    } catch (error) {
      console.error('[ERROR] Updating delivery status:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Error',
        text2: error.message || 'Failed to update delivery status.',
      });
    }
  };

  const openNavigation = (destination) => {
    if (!destination) {
      Toast.show({
        type: 'error',
        text1: 'Navigation Error',
        text2: 'Destination not available.',
      });
      return;
    }

    const { latitude, longitude } = destination;
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${latitude},${longitude}`;
    const label = 'Delivery Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url).catch((err) => {
      console.error('[ERROR] Navigation:', err);
      Toast.show({
        type: 'error',
        text1: 'Navigation Error',
        text2: 'Could not open navigation app.',
      });
    });
  };

  // Fetch orders and initialize location on mount
  useEffect(() => {
    fetchAdminOrders();
    initializeLocation();
  }, []);

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.orderCard, selectedOrder?.id === item.id && styles.selectedOrderCard]}
      onPress={() => handleOrderClick(item)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{item.id}</Text>
          <View style={[styles.statusBadge, styles[item.delivery_status.replace(/\s+/g, '')]]}>
            <Text style={styles.statusText}>{item.delivery_status}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#003366" />
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color="#666666" />
          <Text style={styles.detailText}>{item.customerName || 'Customer'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#666666" />
          <Text style={styles.detailText} numberOfLines={2}>
            {decodedAddresses[item.id] || 'Fetching address...'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#666666" />
          <Text style={styles.detailText}>
            {moment(item.created_at).format('MMM D, h:mm A')}
          </Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Update Status:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={item.delivery_status}
            style={styles.picker}
            onValueChange={(newStatus) => {
              updateDeliveryStatus(item.id, item.customer_id, newStatus);
              if (newStatus === 'out for delivery') {
                getOrderDeliveryLocation(item);
              }
            }}
            dropdownIconColor="#003366"
            mode="dropdown"
          >
            <Picker.Item label="Processing" value="processing" color="#003366" />
            <Picker.Item label="Out for Delivery" value="out for delivery" color="#003366" />
            <Picker.Item label="Delivered" value="delivered" color="#003366" />
          </Picker>
        </View>
      </View>

      {item.delivery_status === 'out for delivery' && deliveryLocations[item.id] && (
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => openNavigation(deliveryLocations[item.id])}
        >
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.navigateButtonText}>Navigate to Delivery</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.webWarningText}>Navigation not supported on web.</Text>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (error && orders.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAdminOrders}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (orders.length === 0 && !loading && !error) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="cube" size={64} color="#003366" />
          <Text style={styles.emptyStateText}>No orders for today</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Today's Orders</Text>
        <Text style={styles.subHeader}>Manage and track your deliveries</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#003366',
  },
  subHeader: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedOrderCard: {
    borderColor: '#003366',
    borderWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#003366',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  'processing': {
    backgroundColor: '#FFC107',
  },
  'outfordelivery': {
    backgroundColor: '#2196F3',
  },
  'delivered': {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  statusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#003366',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003366',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666666',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#003366',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webWarningText: {
    fontSize: 16,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
});

export default OrderTrackingScreen;