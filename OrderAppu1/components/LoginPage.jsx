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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ipAddress } from "../urls";

const { width, height } = Dimensions.get('window');

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
      const response = await fetch(`http://${ipAddress}:8091/auth`, {
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#003366" />
      
      <View style={styles.header}>
        <Image 
          source={require("../assets/logo.jpg")} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Streamline Your Business Orders</Text>
        <Text style={styles.taglineSubtext}>Fast • Reliable • Efficient</Text>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subtitle}>Please sign in to continue</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#666666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Username"
            placeholderTextColor="#999999"
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={() => passwordInput.current.focus()}
          returnKeyType="next"
            autoCapitalize="none"
        />
      </View>

        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
        <TextInput
          ref={passwordInput}
          style={styles.input}
          placeholder="Password"
            placeholderTextColor="#999999"
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
            <Icon 
              name={isPasswordVisible ? "visibility" : "visibility-off"} 
              size={20} 
              color="#666666" 
            />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
        ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>SIGN IN</Text>
              <Icon name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
        )}
      </TouchableOpacity>
    </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#003366',
    marginBottom: 4,
    textAlign: 'center',
  },
  taglineSubtext: {
    fontSize: 14,
    color: '#003366',
    opacity: 0.8,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  formContainer: {
    flex: 1,
    padding: 20,
    marginTop: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333333',
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: '#003366',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default LoginPage;