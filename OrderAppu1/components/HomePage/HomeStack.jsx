import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomePage from './Home';
import ProductsList from './ProductList';
import AdminHomePage from './AdminHomePage';
import Payments from '../Profile/Payments';
import OrderHistorySA from './OrderHistorySA';
import InvoiceDisplay from './InvoiceDisplay';
import ItemsReport from './ItemsReport';
import InvoicePage from './Invoice';
import AdminAssignedUsersPage from './AdminAssignedUsers';
import OrdersPage from './OrdersPage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

const Stack = createStackNavigator();

const HomeStack = () => {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkUserRole = async () => {
            setIsLoading(true);
            const userAuthToken = await AsyncStorage.getItem('userAuthToken');

            if (userAuthToken) {
                try {
                    const decodedToken = jwtDecode(userAuthToken);
                    setIsSuperAdmin(decodedToken.role === 'superadmin');
                } catch (error) {
                    console.error('Token verification error:', error);
                    setIsSuperAdmin(false);
                }
            }
            setIsLoading(false);
        };
        checkUserRole();
    }, []);

    if (isLoading) {
        return null; // Or a loading component
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="HomePage"
                component={isSuperAdmin ? AdminHomePage : HomePage}
            />
            <Stack.Screen name="ProductsList" component={ProductsList} />
            <Stack.Screen name="AdminHomePage" component={AdminHomePage} />
            <Stack.Screen name="Payments" component={Payments} />
            <Stack.Screen name="OrderHistorySA" component={OrderHistorySA} />
            <Stack.Screen name="InvoiceDisplay" component={InvoiceDisplay} />
            <Stack.Screen name="ItemsReport" component={ItemsReport} />
            <Stack.Screen name="InvoicePage" component={InvoicePage} />
            <Stack.Screen name="AdminAssignedUsers" component={AdminAssignedUsersPage} />
            <Stack.Screen name="OrdersPage" component={OrdersPage} />
        </Stack.Navigator>
    );
};

export default HomeStack;