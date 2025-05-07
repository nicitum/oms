import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { ipAddress } from "../../../urls";
import { checkTokenAndRedirect } from "../../../services/auth";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

const SearchProductModal = ({ isVisible, onClose, onAddProduct, currentCustomerId }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigation = useNavigation();
  const imageBaseUrl = `http://${ipAddress}:8091/images/products/`; // Base URL for images

  // Fetch products from API
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const userAuthToken = await checkTokenAndRedirect(navigation);

      const response = await axios.get(`http://${ipAddress}:8091/products`, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      });

      const fetchedProducts = response.data.map((product) => ({
        ...product,
        imageUrl: product.image ? `${imageBaseUrl}${product.image}` : null, // Construct image URL
      }));
      setAllProducts(fetchedProducts);

      const productCategories = [...new Set(fetchedProducts.map((p) => p.category).filter(Boolean))];
      setCategories(productCategories);

      const productBrands = [...new Set(fetchedProducts.map((p) => p.brand).filter(Boolean))];
      setBrands(productBrands);
    } catch (fetchErr) {
      console.error("Error fetching products:", fetchErr);
      setError("Failed to fetch products. Please check your network and try again.");
      setProducts([]);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter products with memoization
  const filteredProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];

    let filtered = [...allProducts];

    if (selectedCategory) {
      filtered = filtered.filter(
        (product) => product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedBrand) {
      filtered = filtered.filter((product) =>
        product.brand?.toLowerCase().includes(selectedBrand.toLowerCase())
      );
    }

    if (searchQuery.length > 2) {
      filtered = filtered.filter((product) =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply GST calculations
    return filtered.map((product) => {
      const basePrice = product.discountPrice || product.price || 0;
      const gstRate = product.gst_rate || 0;
      const gstAmount = (basePrice * gstRate) / 100;
      const finalPrice = basePrice + gstAmount;

      return {
        ...product,
        effectivePrice: finalPrice,
        price: basePrice,
        gstRate,
        gstAmount,
        finalPrice,
      };
    });
  }, [searchQuery, selectedCategory, selectedBrand, allProducts]);

  useEffect(() => {
    setProducts(filteredProducts);
  }, [filteredProducts]);

  useEffect(() => {
    if (isVisible) {
      fetchProducts();
    } else {
      setSearchQuery("");
      setSelectedCategory("");
      setSelectedBrand("");
      setProducts([]);
      setAllProducts([]);
      setError(null);
    }
  }, [isVisible]);

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedBrand("");
    setSearchQuery("");
  };

  // Render product item
  const renderProductItem = ({ item }) => {
    return (
      <View style={styles.productCard}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={() => console.warn(`Failed to load image for ${item.name}`)}
          />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={30} color="#ccc" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.tagContainer}>
            {item.category && (
              <View style={styles.productTag}>
                <Text style={styles.productTagText}>{item.category}</Text>
              </View>
            )}
            {item.brand && (
              <View style={styles.productTag}>
                <Text style={styles.productTagText}>{item.brand}</Text>
              </View>
            )}
          </View>
          <Text style={styles.priceText}>
            ₹{item.finalPrice ? item.finalPrice.toFixed(2) : "N/A"}
          </Text>
          <Text style={styles.priceText}>
            Gst {item.gst_rate}%
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            onAddProduct({
              ...item,
              price: item.finalPrice,
              imageUrl: item.imageUrl, // Pass image URL
            });
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Products</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#003366" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products (min 3 chars)"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Categories</Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory("")}>
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterButton,
                    selectedCategory === category && styles.selectedFilterButton,
                  ]}
                  onPress={() =>
                    setSelectedCategory(selectedCategory === category ? "" : category)
                  }
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedCategory === category && styles.selectedFilterButtonText,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Brands</Text>
              {selectedBrand && (
                <TouchableOpacity onPress={() => setSelectedBrand("")}>
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {brands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={[
                    styles.filterButton,
                    selectedBrand === brand && styles.selectedFilterButton,
                  ]}
                  onPress={() => setSelectedBrand(selectedBrand === brand ? "" : brand)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedBrand === brand && styles.selectedFilterButtonText,
                    ]}
                  >
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {(selectedCategory || selectedBrand || searchQuery) && (
            <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
              <Text style={styles.clearAllButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Product List */}
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              {products.length} {products.length === 1 ? "Product" : "Products"} Found
            </Text>
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => `${item.id}`}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={50} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchQuery.length > 2
                      ? "No products found matching your criteria."
                      : "Please type at least 3 characters or select a category/brand."}
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>

          {/* Loading Overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    backgroundColor: "#003366",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },
  clearSearchButton: {
    padding: 5,
  },
  filterSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003087",
  },
  clearFilterText: {
    color: "#007bff",
    fontSize: 14,
    fontWeight: "500",
  },
  filterButton: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedFilterButton: {
    backgroundColor: "#003087",
    borderColor: "#003087",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#555",
  },
  selectedFilterButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  clearAllButton: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 12,
  },
  clearAllButtonText: {
    color: "#003087",
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultsCount: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 6,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  productTag: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
  },
  productTagText: {
    fontSize: 12,
    color: "#003087",
  },
  priceText: {
    color: "#003087",
    fontWeight: "700",
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#003087",
    padding: 10,
    borderRadius: 25,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    color: "#888",
    lineHeight: 20,
  },
  errorText: {
    color: "#d32f2f",
    textAlign: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,51,102,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
  },
  loadingText: {
    color: "#003087",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
});

export default SearchProductModal;