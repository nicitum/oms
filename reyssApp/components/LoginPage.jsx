import React, { useState, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ipAddress } from "../urls";

const { width } = Dimensions.get('window');

const LoginPage = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordInput = useRef();

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!username || !password) {
      Alert.alert("Error", "Please fill both fields");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://${ipAddress}:8090/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed");

      const decoded = jwtDecode(data.token);
      await AsyncStorage.multiSet([
        ["customerId", decoded.id],
        ["userAuthToken", data.token]
      ]);
      navigation.navigate("TabNavigator");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Simple Header */}
      <Image source={require("../assets/logo.png")} style={styles.logo} />
      <Text style={styles.title}>Login</Text>

      {/* Username Input */}
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={() => passwordInput.current.focus()}
          returnKeyType="next"
        />
      </View>

      {/* Password Input */}
      <View style={styles.inputBox}>
        <TextInput
          ref={passwordInput}
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        <TouchableOpacity 
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          style={styles.eyeButton}
        >
          <Icon name={isPasswordVisible ? "visibility" : "visibility-off"} size={20} />
        </TouchableOpacity>
      </View>

      {/* Login Button */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>LOGIN</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  inputBox: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  eyeButton: {
    padding: 5,
    marginLeft: 10,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#003366',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginPage;