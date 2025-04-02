import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfilePage from './profile';
import OrdersPage from './OrdersPage';
import DeliveryStatusUpdate from './DeliveryStatusUpdate';
import UpdateOrderScreen from './UpdateOrders';
import UpdateOrdersU from './UpdateOrdersU';
import PlaceOrderAdmin from './PlaceOrderAdmin';
import LoadingSlip from './LoadingSlip';
import PaymentScreen from './Payments';
import CollectCashPage from './CollectCash';
import CreditLimitPage from './CreditLimit';
import AdminAssignedUsersPage from '../route_mgr/AdminAssignedUsers';
import DailyOrdersReport from './DailyOrdersReport';
import Remarks from './Remarks';
import AmountDueReport from './AmountDueReport';
import CashCollectedReport from './CashCollectedReport';

import Invoice from '../route_mgr/Invoice';
import ItemsReport from './ItemsReport';

const Stack = createStackNavigator();

const ProfileStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfilePage" 
        component={ProfilePage} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Orders" 
        component={OrdersPage} 
        options={{ title: 'Order History' }} 
      />
      <Stack.Screen 
        name="DeliveryStatusUpdate" 
        component={DeliveryStatusUpdate} 
        options={{ title: 'Update Delivery Status' }} 
      />

      <Stack.Screen 
        name="UpdateOrders" 
        component={UpdateOrderScreen} 
        options={{ title: 'Edit/Update Orders' }} 
      />

      <Stack.Screen 
        name="UpdateOrdersU" 
        component={UpdateOrdersU} 
        options={{ title: 'Update Orders' }} 
      />

      <Stack.Screen 
        name="AdminAssignedUsersPage" 
        component={AdminAssignedUsersPage} 
        options={{ title: 'Orders Assigned' }} 
      />

      <Stack.Screen 
        name="PlaceOrderAdmin" 
        component={PlaceOrderAdmin} 
        options={{ title: 'On Behalf' }} 
      />
      

      <Stack.Screen 
        name="LoadingSlip" 
        component={LoadingSlip} 
        options={{ title: '' }} 
        
      />

      <Stack.Screen 
        name="Payments" 
        component={PaymentScreen} 
        options={{ title: 'Payment Screen' }} 
        
      />

      <Stack.Screen 
        name="CollectCash" 
        component={CollectCashPage} 
        options={{ title: 'Collect Cash' }} 
        
      />


      <Stack.Screen 
        name="CreditLimit" 
        component={CreditLimitPage} 
        options={{ title: 'CreditLimit' }} 
        
      />

      <Stack.Screen 
        name="DailyOrdersReport" 
        component={DailyOrdersReport} 
        options={{ title: 'DailyOrdersReport' }} 
        
      />


      
      <Stack.Screen 
        name="Remarks" 
        component={Remarks} 
        options={{ title: 'Remarks'}} 
        
      />

      <Stack.Screen 
        name="CashCollectedReport" 
        component={CashCollectedReport} 
        options={{ title: 'Cash Collected Report'}} 
        
      />

      <Stack.Screen 
        name="Invoice" 
        component={Invoice} 
        options={{ title: 'Invoice' }} 
      />


      <Stack.Screen 
        name="AmountDueReport" 
        component={AmountDueReport} 
        options={{ title: 'Outstanding Report' }} 
      />

      <Stack.Screen 
        name="ItemsReport" 
        component={ItemsReport} 
        options={{ title: 'Items Report' }} 
      />













    </Stack.Navigator>
      


      
    
  );
};

export default ProfileStack;
