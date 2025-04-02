import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import IndentPage from "./indent"
import PlaceOrderPage from "./placeOrder";

const Stack = createStackNavigator();

const IndentStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // You can change this if you want a header
      }}
    >
      {/* Main Indent page */}
      <Stack.Screen name="IndentPage" component={IndentPage} />

      {/* Order details page */}
      <Stack.Screen name="PlaceOrderPage" component={PlaceOrderPage} />
    </Stack.Navigator>
  );
};

export default IndentStack;
