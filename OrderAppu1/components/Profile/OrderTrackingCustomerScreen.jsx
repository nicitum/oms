import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../urls';

const OrderTrackingCustomerScreen = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateLocation = async () => {
    try {
      // 1. Get permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Need location permission');
        return;
      }

      setIsUpdating(true);

      // 2. Get location
      const location = await Location.getCurrentPositionAsync();
      console.log('Got location:', location.coords);

      // 3. Get user token and ID
      const token = await AsyncStorage.getItem('userAuthToken');
      const { id: customer_id } = jwtDecode(token);

      // 4. Call API
      await fetch(`http://${ipAddress}:8091/update-user-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        })
      });

      Alert.alert('Location Updated');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Ask permission on load
  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button} 
        onPress={updateLocation}
        disabled={isUpdating}
      >
        <Text style={styles.buttonText}>
          {isUpdating ? 'Updating...' : 'Update Location'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    width: '80%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

export default OrderTrackingCustomerScreen;