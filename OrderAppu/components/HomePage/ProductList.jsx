import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from "react-native";
import { ipAddress } from "../../urls";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";

const ProductsComponent = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`http://${ipAddress}:8090/products`);
      const data = await response.json();
      if (response.ok) {
        setProducts(data);
        setFilteredProducts(data);
        setBrands(["All", ...new Set(data.map((product) => product.brand))]);
        setCategories(["All", ...new Set(data.map((product) => product.category))]);
      } else {
        Alert.alert("Error", "Failed to fetch products");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      Alert.alert("Error", "An error occurred while fetching products");
    }
  };

  const filterProducts = () => {
    let filtered = products;
    if (searchTerm) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory && selectedCategory !== "All") {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }
    if (selectedBrand && selectedBrand !== "All") {
      filtered = filtered.filter((product) => product.brand === selectedBrand);
    }
    setFilteredProducts(filtered);
  };

  useEffect(() => {
    filterProducts();
  }, [searchTerm, selectedCategory, selectedBrand]);

  const renderProduct = ({ item }) => {
    const imageUri = `http://${ipAddress}:8090/images/products/${item.image}`;
    // Log the URI for debugging
    console.log(`Product: ${item.name}, Image URI: ${imageUri}`);

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => item.image && setEnlargedImage(item.image)} // Prevent modal if no image
      >
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDetails}>{item.category} | {item.brand}</Text>
        {item.image ? (
          <Image
            style={styles.productImage}
            source={{ uri: imageUri }}
            resizeMode="cover" // Adjust scaling
            onError={(error) => console.error(`Failed to load image for ${item.name}:`, error.nativeEvent.error)} // Log errors
            //defaultSource={require("./placeholder.png")} // Optional: Add a placeholder image
          />
        ) : (
          <Text style={styles.noImageText}>No Image</Text>
        )}
        <Text style={styles.productPrice}>₹{item.price}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color="#003366" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Catalog</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        placeholderTextColor="#666"
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      <View style={styles.filterContainer}>
        <Picker
          selectedValue={selectedCategory}
          style={styles.picker}
          onValueChange={(itemValue) => setSelectedCategory(itemValue)}
        >
          {categories.map((category) => (
            <Picker.Item key={category} label={category} value={category} />
          ))}
        </Picker>
        <Picker
          selectedValue={selectedBrand}
          style={styles.picker}
          onValueChange={(itemValue) => setSelectedBrand(itemValue)}
        >
          {brands.map((brand) => (
            <Picker.Item key={brand} label={brand} value={brand} />
          ))}
        </Picker>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={<Text style={styles.noProducts}>No products found</Text>}
      />

      <Modal
        visible={!!enlargedImage}
        transparent={true}
        onRequestClose={() => setEnlargedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setEnlargedImage(null)}
          >
            <Icon name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {enlargedImage && (
            <Image
              style={styles.enlargedImage}
              source={{ uri: `http://${ipAddress}:8090/images/products/${enlargedImage}` }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: "#003366",
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 15,
  },
  searchInput: {
    backgroundColor: "#f0f0f0",
    color: "#333",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 20,
  },
  picker: {
    height: 50,
    backgroundColor: "#003366",
    color: "#fff",
    borderRadius: 10,
    marginBottom: 10,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 15,
  },
  productCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 10,
    width: "48%",
    alignItems: "center",
  },
  productName: {
    color: "#003366",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  productDetails: {
    color: "#666",
    fontSize: 12,
    marginBottom: 8,
  },
  productImage: {
    width: "100%", // Ensure it fits the card
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#eee", // Fallback background for loading
  },
  noImageText: {
    color: "#666",
    fontSize: 14,
    marginVertical: 10,
  },
  productPrice: {
    color: "#003366",
    fontSize: 16,
    fontWeight: "bold",
  },
  noProducts: {
    color: "#666",
    fontSize: 18,
    textAlign: "center",
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  enlargedImage: {
    width: "90%",
    height: "80%",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
  },
});

export default ProductsComponent;