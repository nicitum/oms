import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginPage from "./components/LoginPage";
import TabNavigator from "./components/TabNavigator";
import LoadingIndicator from "./components/general/Loader";
import { jwtDecode } from "jwt-decode";
import Toast from "react-native-toast-message";
const Stack = createStackNavigator();
import { LogBox } from "react-native";
LogBox.ignoreAllLogs(); // Completely hide all warnings

//eas build --profile preview --platform android --clear-cache
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null here means we're still checking authentication.

  const checkAuthentication = async () => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");

      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      // Decode the JWT to check expiration
      const decodedToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);

      if (decodedToken.exp && decodedToken.exp > currentTime) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsLoggedIn(false);
    }
  };

  // Checking the authentication when the app starts.
  useEffect(() => {
    checkAuthentication();
  }, []);

  if (isLoggedIn === null) {
    return <LoadingIndicator />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isLoggedIn ? "TabNavigator" : "Login"}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Login Page */}
        <Stack.Screen name="Login" component={LoginPage} />

        {/* Products Page (only accessible after login) */}
        <Stack.Screen name="TabNavigator" component={TabNavigator} />
      </Stack.Navigator>
      <Toast /> 
    </NavigationContainer>
  );
};

export default App;