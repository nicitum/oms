import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

const OrderProductsList = ({ products, onQuantityChange, setOrderDetails }) => {
    const [modifiedOrder, setModifiedOrder] = useState(products || []);

    useEffect(() => {
        setModifiedOrder(products || []);
    }, [products]);


    const handleRemoveProduct = async (productToRemove) => {
        try {
            const updatedProducts = modifiedOrder.filter(
                (product) => product.product_id !== productToRemove.product_id
            );
            setModifiedOrder(updatedProducts); // Update local modifiedOrder state

            // Update the product list in PlaceOrderPage's orderDetails state
            setOrderDetails(prevState => ({
                ...prevState,
                products: updatedProducts,
            }));

        } catch (error) {
            console.error("Error removing product:", error);
            Alert.alert("Error", "Could not remove product");
        }
    };

    const currentProducts = modifiedOrder;

    const renderItem = ({ item, index }) => (
        <View style={styles.itemRow}>
            <Text style={[styles.itemText, { flex: 6 }]}>{item.name}</Text>
            <View style={styles.editableQuantityContainer}>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(text) => onQuantityChange(text, index)}
                />
                <Text style={styles.pktsText}> pkts</Text>
            </View>
            <TouchableOpacity
                onPress={() => handleRemoveProduct(item)}
                style={styles.removeButton}
            >
                <Icon name="delete" size={16} color="red" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.orderListContainer}>
            <View style={styles.itemHeaderRow}>
                <Text style={[styles.itemHeaderText, { flex: 6 }]}>Item</Text>
                <Text style={[styles.itemHeaderText, { flex: 2 }]}>Qty</Text>
            </View>
            <FlatList
                data={currentProducts}
                renderItem={renderItem}
                keyExtractor={(item) => item.product_id}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    orderListContainer: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 10,
        margin: 10,
    },
    itemHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    itemHeaderText: {
        fontWeight: "bold",
        fontSize: 16,
    },
    itemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 5,
        alignItems: "center",
    },
    itemText: {
        fontSize: 14,
    },
    editableQuantityContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    input: {
        fontSize: 14,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        textAlign: "center",
        paddingVertical: 3,
        paddingHorizontal: 3,
        width: 30,
        marginRight: 5,
    },
    pktsText: {
        fontSize: 14,
    },
    removeButton: {
        padding: 5,
    },
});

export default OrderProductsList;