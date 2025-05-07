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
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
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
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://${ipAddress}:8091/products`);
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
    } finally {
      setLoading(false);
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
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => item.image && setEnlargedImage(item.image)}
      >
        <View style={styles.imageContainer}>
          {item.image ? (
            <Image
              style={styles.productImage}
              source={{ uri: imageUri }}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-not-supported" size={40} color="#CCC" />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productDetails}>{item.category} • {item.brand}</Text>
          <Text style={styles.productPrice}>₹{item.price}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#003366" barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Catalog</Text>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#666"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCategory}
            style={styles.picker}
            dropdownIconColor="#003366"
            onValueChange={(itemValue) => setSelectedCategory(itemValue)}
          >
            {categories.map((category) => (
              <Picker.Item 
                key={category} 
                label={category} 
                value={category}
                color="#003366"
              />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedBrand}
            style={styles.picker}
            dropdownIconColor="#003366"
            onValueChange={(itemValue) => setSelectedBrand(itemValue)}
          >
            {brands.map((brand) => (
              <Picker.Item 
                key={brand} 
                label={brand} 
                value={brand}
                color="#003366"
              />
            ))}
          </Picker>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={48} color="#CCC" />
            <Text style={styles.noProducts}>No products found</Text>
          </View>
        }
      />

      <Modal
        visible={!!enlargedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEnlargedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setEnlargedImage(null)}
          >
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {enlargedImage && (
            <Image
              style={styles.enlargedImage}
              source={{ uri: `http://${ipAddress}:8091/images/products/${enlargedImage}` }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    backgroundColor: "#003366",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginLeft: 16,
  },
  searchInput: {
    flex: 1,
    color: "#333",
    padding: 12,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
  },
  listContainer: {
    padding: 8,
    paddingBottom: 24,
  },
  row: {
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "48%",
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    width: "100%",
    height: 160,
    backgroundColor: "#F5F7FA",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    color: "#333333",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    height: 40,
  },
  productDetails: {
    color: "#666666",
    fontSize: 12,
    marginBottom: 8,
  },
  productPrice: {
    color: "#003366",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 48,
  },
  noProducts: {
    color: "#666666",
    fontSize: 16,
    marginTop: 12,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 8,
    borderRadius: 20,
  },
});

export default ProductsComponent;