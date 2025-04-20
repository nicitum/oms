import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Alert, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Text, 
  ScrollView, 
  Modal, 
  SafeAreaView,
  Pressable,
  Image
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import moment from "moment";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from 'react-native-vector-icons/MaterialIcons';
import { jwtDecode } from 'jwt-decode';
import Toast from 'react-native-toast-message';

// Local imports
import LoadingIndicator from "../general/Loader";
import ErrorMessage from "../general/errorMessage";
import BackButton from "../general/backButton";
import SubmitButton from "./nestedPage/submitButton";
import SearchProductModal from "./nestedPage/searchProductModal";
import OrderProductsList from "./nestedPage/orderProductsList";
import { ipAddress } from "../../urls";
import { checkTokenAndRedirect } from "../../services/auth";

const PlaceOrderPage = ({ route }) => {
  const { selectedDate, shift } = route.params;
  const [orderDetails, setOrderDetails] = useState({ products: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [totalOrderAmount, setTotalOrderAmount] = useState(0);
  const navigation = useNavigation();

  const isPastDate = moment(selectedDate).isBefore(moment(), "day");

  // Calculate total amount
  const calculateTotalAmount = useCallback((products) => {
    if (!products || products.length === 0) {
      return 0;
    }
    return products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);
  }, []);

  // Show alert and navigate back
  const showAlertAndGoBack = useCallback(() => {
    let message = "Cannot place orders for past dates.";

    Alert.alert("Order Not Allowed", message, [{ text: "OK" }], {
      cancelable: false,
    });

    setTimeout(() => {
      navigation.goBack();
    }, 3000);
  }, [navigation, isPastDate]);

  // Initialize order
  useEffect(() => {
    if (isPastDate) {
      showAlertAndGoBack();
    }
  }, [selectedDate, shift, isPastDate, showAlertAndGoBack]);

  // Add product to order
  const handleAddProduct = async (product) => {
    try {
      const currentProducts = orderDetails?.products || [];
      const isDuplicate = currentProducts.some((existingProduct) => existingProduct.product_id === product.id);

      if (isDuplicate) {
        Toast.show({
          type: 'info',
          text1: 'Item Exists',
          text2: "Please increase the quantity in the list."
        });
        return;
      }

      const newProduct = {
        category: product.category,
        name: product.name,
        price: product.effectivePrice,
        product_id: product.id,
        quantity: 1
      };

      const updatedProducts = [...currentProducts, newProduct];
      setOrderDetails({ ...orderDetails, products: updatedProducts });
      setShowSearchModal(false);
      setTotalOrderAmount(calculateTotalAmount(updatedProducts));
    } catch (error) {
      console.error("Error adding product:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "Could not add product."
      });
    }
  };

  // Handle quantity change
  const handleQuantityChange = async (text, index) => {
    try {
      const currentProducts = orderDetails?.products || [];
      const updatedProducts = [...currentProducts];
      const parsedQuantity = parseInt(text, 10);

      if (parsedQuantity < 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Quantity',
          text2: "Quantity cannot be negative."
        });
        return;
      }

      updatedProducts[index] = {
        ...updatedProducts[index],
        quantity: isNaN(parsedQuantity) ? 0 : parsedQuantity,
      };

      setOrderDetails({ ...orderDetails, products: updatedProducts });
      setTotalOrderAmount(calculateTotalAmount(updatedProducts));
    } catch (error) {
      console.error("Error updating quantity:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "Could not update quantity."
      });
    }
  };

  // Handle delete product
  const handleDeleteProduct = (index) => {
    try {
      const currentProducts = [...orderDetails.products];
      currentProducts.splice(index, 1);
      setOrderDetails({ ...orderDetails, products: currentProducts });
      setTotalOrderAmount(calculateTotalAmount(currentProducts));
      
      Toast.show({
        type: 'info',
        text1: 'Item Removed',
        text2: "Product has been removed from the order."
      });
    } catch (error) {
      console.error("Error removing product:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "Could not remove product."
      });
    }
  };

  // Handle submit order
  const handleSubmitOrder = async () => {
    let hasInvalidQuantity = false;
    for (const product of orderDetails.products) {
      if (product.quantity <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Quantity',
          text2: "Quantity must be greater than zero for all products to place order."
        });
        hasInvalidQuantity = true;
        break;
      }
    }

    if (hasInvalidQuantity) {
      return;
    }
    
    if (orderDetails.products.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Empty Order',
        text2: "Please add at least one product to place an order."
      });
      return;
    }
    
    setConfirmModalVisible(true);
  };

  // Check credit limit
  const checkCreditLimit = async () => {
    try {
      const userAuthToken = await checkTokenAndRedirect(navigation);
      if (!userAuthToken) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Error',
          text2: "Authorization token missing."
        });
        return null;
      }
      const decodedToken = jwtDecode(userAuthToken);
      const customerId = decodedToken.id;

      const creditLimitResponse = await fetch(`http://${ipAddress}:8090/credit-limit?customerId=${customerId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (creditLimitResponse.ok) {
        const creditData = await creditLimitResponse.json();
        return parseFloat(creditData.creditLimit);
      } else if (creditLimitResponse.status === 404) {
        console.log("Credit limit not found for customer, proceeding without limit check.");
        return Infinity;
      } else {
        console.error("Error fetching credit limit:", creditLimitResponse.status, creditLimitResponse.statusText);
        Toast.show({
          type: 'error',
          text1: 'Credit Limit Error',
          text2: "Failed to fetch credit limit."
        });
        return null;
      }
    } catch (error) {
      console.error("Error checking credit limit:", error);
      Toast.show({
        type: 'error',
        text1: 'Credit Limit Error',
        text2: "Error checking credit limit."
      });
      return null;
    }
  };

  // Confirm submit order
  const confirmSubmitOrder = async () => {
    setConfirmModalVisible(false);
    setLoading(true);

    const creditLimit = await checkCreditLimit();
    if (creditLimit === null) {
      setLoading(false);
      return;
    }

    if (creditLimit !== Infinity && totalOrderAmount > creditLimit) {
      const exceededAmount = (totalOrderAmount - creditLimit).toFixed(2);
      Toast.show({
        type: 'error',
        text1: 'Credit Limit Reached',
        text2: `Credit limit reached by ₹${exceededAmount}. Please adjust your cart.`
      });
      setLoading(false);
      return;
    }

    try {
      const userAuthToken = await checkTokenAndRedirect(navigation);
      if (!userAuthToken) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Error',
          text2: "Auth token missing."
        });
        setLoading(false);
        return;
      }

      // Use the place API for new orders
      const transformedData = orderDetails.products.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      }));
      
      const orderDate = new Date(selectedDate).toISOString();

      const placeOrderOptions = {
        method: "POST",
        url: `http://${ipAddress}:8090/place`,
        data: {
          products: transformedData,
          orderType: shift,
          orderDate,
        },
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      };

      const placeOrderResponse = await axios(placeOrderOptions);
      if (placeOrderResponse.status === 200) {
        const orderResponseData = placeOrderResponse.data;
        const placedOrderId = orderResponseData.orderId;
        
        const decodedToken = jwtDecode(userAuthToken);
        const customerId = decodedToken.id;

        const updateAmountDueOptions = {
          method: 'POST',
          url: `http://${ipAddress}:8090/credit-limit/update-amount-due-on-order`,
          data: {
            customerId: customerId,
            totalOrderAmount: totalOrderAmount,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        };

        try {
          const updateAmountDueResponse = await axios(updateAmountDueOptions);
          if (updateAmountDueResponse.status === 200) {
            console.log("Successfully updated amount due");
          }
        } catch (updateAmountDueError) {
          console.error("Error calling /credit-limit/update-amount-due-on-order API:", updateAmountDueError);
        }

        const deductCreditOptions = {
          method: 'POST',
          url: `http://${ipAddress}:8090/credit-limit/deduct`,
          data: {
            customerId: jwtDecode(userAuthToken).id,
            amountChange: totalOrderAmount,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        };

        try {
          const deductCreditResponse = await axios(deductCreditOptions);
          
          if (deductCreditResponse.status === 200) {
            Toast.show({
              type: 'success',
              text1: 'Order Placed',
              text2: "Order placed successfully!"
            });
            
            // Navigate back to the indent page with success flag
            navigation.navigate("IndentPage", { orderPlacedSuccessfully: true });
          } else {
            console.error("Error deducting credit limit after order:", deductCreditResponse.status, deductCreditResponse.statusText);
            Toast.show({
              type: 'error',
              text1: 'Order Placed, but Credit Update Failed',
              text2: "There was an error updating your credit limit. Please contact support."
            });
            navigation.navigate("IndentPage", { orderPlacedSuccessfully: true });
          }
        } catch (deductCreditError) {
          console.error("Error calling credit-limit/deduct API:", deductCreditError);
          Toast.show({
            type: 'error',
            text1: 'Order Placed, but Credit Update Error',
            text2: "There was an error updating your credit limit. Please contact support."
          });
          navigation.navigate("IndentPage", { orderPlacedSuccessfully: true });
        }
      } else {
        throw new Error("Unexpected response status from /place API.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      if (error.response) {
        console.log(error.response.data.message);
        Toast.show({
          type: 'error',
          text1: 'Order Submission Failed',
          text2: error.response.data.message || "Server error."
        });
      } else if (error.request) {
        console.log("Network error:", error.request);
        Toast.show({
          type: 'error',
          text1: 'Network Error',
          text2: "Network error, check connection."
        });
      } else {
        console.error("Error:", error.message);
        Toast.show({
          type: 'error',
          text1: 'Unexpected Error',
          text2: error.message || "An error occurred."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Cancel submit order
  const cancelSubmitOrder = () => {
    setConfirmModalVisible(false);
  };

  // Update total amount when order details change
  useEffect(() => {
    if (orderDetails && orderDetails.products) {
      setTotalOrderAmount(calculateTotalAmount(orderDetails.products));
    } else {
      setTotalOrderAmount(0);
    }
  }, [orderDetails, calculateTotalAmount]);

  // Render loading indicator
  if (loading) {
    return <LoadingIndicator />;
  }

  // Render error message
  if (error) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error} />
      </View>
    );
  }

  // Render confirm modal
  const ConfirmModal = ({ isVisible, onConfirm, onCancel }) => {
    return (
      <Modal visible={isVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Order</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Are you sure you want to place this order?
              </Text>
              <Text style={styles.modalOrderDetails}>
                Date: {moment(selectedDate).format("YYYY-MM-DD")}
              </Text>
              <Text style={styles.modalOrderDetails}>
                Shift: {shift}
              </Text>
              <Text style={styles.modalOrderDetails}>
                Total Amount: ₹{totalOrderAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={onConfirm}
              >
                <Text style={styles.confirmButtonText}>Place Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Render product item
  const ProductItem = ({ product, index, onQuantityChange }) => {
    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.productHeaderRight}>
            <Text style={styles.productCategory}>{product.category}</Text>
          </View>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleDeleteProduct(index)}
          >
            <Icon name="delete" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.productDetails}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price:</Text>
            <Text style={styles.priceValue}>₹{product.price.toFixed(2)}</Text>
          </View>
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityInputContainer}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => {
                  const newQuantity = Math.max(0, (product.quantity || 0) - 1);
                  onQuantityChange(newQuantity.toString(), index);
                }}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={product.quantity ? product.quantity.toString() : "0"}
                onChangeText={(text) => onQuantityChange(text, index)}
                keyboardType="numeric"
              />
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => {
                  const newQuantity = (product.quantity || 0) + 1;
                  onQuantityChange(newQuantity.toString(), index);
                }}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.subtotalContainer}>
            <Text style={styles.subtotalLabel}>Subtotal:</Text>
            <Text style={styles.subtotalValue}>
              ₹{((product.price || 0) * (product.quantity || 0)).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Main render
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton navigation={navigation} />
          <Text style={styles.headerTitle}>Place Order</Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.orderSummaryTitle}>Order Summary</Text>
          </View>
          <View style={styles.orderSummaryDetails}>
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Date:</Text>
              <Text style={styles.orderSummaryValue}>
                {moment(selectedDate).format("YYYY-MM-DD")}
              </Text>
            </View>
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Shift:</Text>
              <Text style={styles.orderSummaryValue}>{shift}</Text>
            </View>
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Total Amount:</Text>
              <Text style={styles.orderSummaryValue}>
                ₹{totalOrderAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Products List */}
        <ScrollView style={styles.productsList}>
          {orderDetails.products && orderDetails.products.length > 0 ? (
            orderDetails.products.map((product, index) => (
              <ProductItem
                key={`${product.product_id}-${index}`}
                product={product}
                index={index}
                onQuantityChange={handleQuantityChange}
              />
            ))
          ) : (
            <View style={styles.emptyProductsContainer}>
              <Icon name="shopping-basket" size={64} color="#ccc" />
              <Text style={styles.emptyProductsText}>
                No products added yet
              </Text>
              <Text style={styles.emptyProductsSubtext}>
                Tap the search button to add products
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Add Product Button */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowSearchModal(true)}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Place Order Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.placeOrderButton}
            onPress={handleSubmitOrder}
          >
            <Text style={styles.placeOrderButtonText}>Place Order</Text>
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <SearchProductModal
          isVisible={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onAddProduct={handleAddProduct}
        />
        <ConfirmModal
          isVisible={confirmModalVisible}
          onConfirm={confirmSubmitOrder}
          onCancel={cancelSubmitOrder}
        />
      </View>

      <Toast config={toastConfig} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderSummary: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  orderSummaryHeader: {
    backgroundColor: '#4361ee',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  orderSummaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderSummaryDetails: {
    padding: 16,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderSummaryLabel: {
    fontSize: 14,
    color: '#555',
  },
  orderSummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  productsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  productHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productHeaderRight: {
    alignItems: 'flex-end',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productDetails: {
    padding: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#555',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#555',
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  quantityInput: {
    width: 50,
    height: 36,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  subtotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4361ee',
  },
  emptyProductsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyProductsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 16,
  },
  emptyProductsSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
  },
  placeOrderButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
  },
  modalHeader: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOrderDetails: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderRightWidth: 0.5,
    borderRightColor: '#eee',
  },
  cancelButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#4361ee',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const toastConfig = {
  success: ({ text1, text2 }) => (
    <View style={{
      height: 60,
      width: '90%',
      backgroundColor: '#4ade80',
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }}>
      <View style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}>
        <Icon name="check" size={16} color="#4ade80" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{text1}</Text>
        <Text style={{ color: '#fff', fontSize: 12 }}>{text2}</Text>
      </View>
    </View>
  ),
  error: ({ text1, text2 }) => (
    <View style={{
      height: 60,
      width: '90%',
      backgroundColor: '#ef4444',
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }}>
      <View style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}>
        <Icon name="error" size={16} color="#ef4444" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{text1}</Text>
        <Text style={{ color: '#fff', fontSize: 12 }}>{text2}</Text>
      </View>
    </View>
  ),
  info: ({ text1, text2 }) => (
    <View style={{
      height: 60,
      width: '90%',
      backgroundColor: '#3b82f6',
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }}>
      <View style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}>
        <Icon name="info" size={16} color="#3b82f6" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{text1}</Text>
        <Text style={{ color: '#fff', fontSize: 12 }}>{text2}</Text>
      </View>
    </View>
  ),
};

export default PlaceOrderPage;