import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfilePage from './profile';
import OrdersPage from './OrdersPage';
import DeliveryStatusUpdate from './DeliveryStatusUpdate';
import UpdateOrderScreen from './UpdateOrders';

import PlaceOrderAdmin from './PlaceOrderAdmin';
import LoadingSlip from './LoadingSlip';
import PaymentScreen from './Payments';
import CollectCashPage from './CollectCash';
import CreditLimitPage from './CreditLimit';
import DailyOrdersReport from './DailyOrdersReport';
import Remarks from './Remarks';
import AmountDueReport from './AmountDueReport';
import CashCollectedReport from './CashCollectedReport';
import AutoOrderUpdate from './AutoOrderUpdate';

import UpdateOrdersSA from './UpdateOrdersSA';
import PaymentHistory from './PaymentHistory';
import OrderAcceptSA from './OrderAcceptSA';
import AutoOrderPage from './AutoOrderPage';
import LoadingSlipSA from './LoadingSlipSA';
import InvoiceSA from './InvoiceSA';
import CollectCashSA from './CollectCashSA';

import OrderTrackingScreen from './OrderTrackingScreen';

import OrderTrackingCustomerScreen from './OrderTrackingCustomerScreen';

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
        name="PlaceOrderAdmin" 
        component={PlaceOrderAdmin} 
        options={{ title: 'Auto Order Manager' }} 
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
        name="AmountDueReport" 
        component={AmountDueReport} 
        options={{ title: 'Outstanding Report' }} 
      />

    

      <Stack.Screen 
        name="UpdateOrdersSA" 
        component={UpdateOrdersSA} 
        options={{ title: 'Update Orders' }} 
      />


    <Stack.Screen 
        name="PaymentHistory"
        component={PaymentHistory} 
        options={{ title: 'Payment History' }} 
      />


      <Stack.Screen 
        name="OrderAcceptSA"
        component={OrderAcceptSA}
        options={{ title: 'Order Accept' }} 
      />



    <Stack.Screen 
        name="AutoOrderPage"
        component={AutoOrderPage}
        options={{ title: 'Auto Order Page' }} 
      />


      <Stack.Screen 
        name="LoadingSlipSA"
        component={LoadingSlipSA}
        options={{ title: ' ' }} 
      />


      <Stack.Screen 
        name="InvoiceSA"
        component={InvoiceSA}
        options={{ title: 'Invoice Page' }} 
      />


      <Stack.Screen 
        name="CollectCashSA"
        component={CollectCashSA}
        options={{ title: 'Cash Collection' }} 
      />

      <Stack.Screen 
        name="AutoOrderUpdate"
        component={AutoOrderUpdate}
        options={{ title: 'Auto Order Update' }}
      />

      <Stack.Screen 
        name="OrderTrackingScreen"
        component={OrderTrackingScreen}
        options={{ title: 'Order Tracking' }}
      />


      <Stack.Screen 
        name="OrderTrackingCustomerScreen"
        component={OrderTrackingCustomerScreen}
        options={{ title: 'Order Tracking Customer' }}
      />



  












    </Stack.Navigator>
      


      
    
  );
};

export default ProfileStack;
