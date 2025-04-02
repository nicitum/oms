import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

export const checkTokenAndRedirect = async (navigation) => {
  try {
    const token = await AsyncStorage.getItem("userAuthToken");

    if (!token) {
      navigation.navigate("Login");
      return null;
    }

    const decodedToken = jwtDecode(token);
    const currentTime = Math.floor(Date.now() / 1000);

    if (decodedToken.exp < currentTime) {
      navigation.navigate("Login");
      return null;
    }

    return token;
    
  } catch (error) {
    console.error("Error checking token:", error);
    navigation.navigate("Login");
    return null;
  }
};
