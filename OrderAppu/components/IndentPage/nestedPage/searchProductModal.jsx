import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { ipAddress } from "../../../urls";
import { checkTokenAndRedirect } from "../../../services/auth";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

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

    const filterProducts = useCallback(() => {
        if (!allProducts || allProducts.length === 0) return;

        setLoading(true);
        setError(null);

        let filtered = [...allProducts];

        if (selectedCategory) {
            filtered = filtered.filter((product) =>
                product.category && product.category.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        if (selectedBrand) {
            filtered = filtered.filter((product) =>
                product.brand && product.brand.toLowerCase().includes(selectedBrand.toLowerCase())
            );
        }

        if (searchQuery.length > 2) {
            filtered = filtered.filter((product) =>
                product.name && product.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply GST calculations to filtered products
        const productsWithGst = filtered.map((product) => {
            const basePrice = product.discountPrice || product.price || 0;
            const gstRate = product.gst_rate || 0;
            const gstAmount = (basePrice * gstRate) / 100;
            const finalPrice = basePrice + gstAmount;

            return {
                ...product,
                effectivePrice: finalPrice,
                price: basePrice,
                gstRate: gstRate,
                gstAmount: gstAmount,
                finalPrice: finalPrice,
            };
        });

        setProducts(productsWithGst);
        setLoading(false);
    }, [searchQuery, selectedCategory, selectedBrand, allProducts]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            setError(null);
            const userAuthToken = await checkTokenAndRedirect(navigation);

            const response = await axios.get(`http://${ipAddress}:8090/products`, {
                headers: {
                    Authorization: `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });
           
            const fetchedProducts = response.data;
            setAllProducts(fetchedProducts);

            const productCategories = [...new Set(fetchedProducts.map((product) => product.category).filter(Boolean))];
            setCategories(productCategories);

            const productBrands = [...new Set(fetchedProducts.map((product) => product.brand).filter(Boolean))];
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

    useEffect(() => {
        if (isVisible) {
            fetchProducts();
        } else {
            setSearchQuery("");
            setSelectedCategory("");
            setSelectedBrand("");
            setProducts([]);
            setError(null);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible && allProducts.length > 0) {
            filterProducts();
        }
    }, [isVisible, searchQuery, selectedCategory, selectedBrand, allProducts, filterProducts]);

    const clearFilters = () => {
        setSelectedCategory("");
        setSelectedBrand("");
        setSearchQuery("");
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
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Search Products</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

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
                            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchButton}>
                                <Ionicons name="close-circle" size={20} color="#999" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.filterSection}>
                        <View style={styles.filterHeader}>
                            <Text style={styles.filterTitle}>Categories</Text>
                            {selectedCategory && (
                                <TouchableOpacity onPress={() => setSelectedCategory("")}>
                                    <Text style={styles.clearFilterText}>Clear</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                            {categories.map((category) => (
                                <TouchableOpacity
                                    key={category}
                                    style={[
                                        styles.filterButton,
                                        selectedCategory === category && styles.selectedFilterButton,
                                    ]}
                                    onPress={() => setSelectedCategory(selectedCategory === category ? "" : category)}
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
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
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

                    {(selectedCategory || selectedBrand || searchQuery.length > 0) && (
                        <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
                            <Text style={styles.clearAllButtonText}>Clear All Filters</Text>
                        </TouchableOpacity>
                    )}

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsCount}>
                            {products.length} {products.length === 1 ? "Product" : "Products"} Found
                        </Text>

                        <FlatList
                            data={products}
                            renderItem={({ item }) => (
                                <View style={styles.productItem}>
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productName}>{item.name}</Text>
                                        <View style={styles.productDetailsContainer}>
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
                                                ₹{item.finalPrice ? item.finalPrice.toFixed(2) : 'N/A'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => {
                                            onAddProduct({
                                                ...item,
                                                price: item.finalPrice,
                                            });
                                        }}
                                    >
                                        <Ionicons name="add" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            keyExtractor={(item, index) => `${item.id}-${index}`}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="search-outline" size={50} color="#ccc" />
                                    <Text style={styles.emptyText}>
                                        {searchQuery.length > 2
                                            ? "No products found matching your criteria."
                                            : "Please type at least 3 characters to search products or select category/brand."}
                                    </Text>
                                </View>
                            }
                        />
                    </View>

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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContainer: {
        backgroundColor: "#f8f8f8",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: "85%",
        overflow: "hidden",
    },
    modalHeader: {
        backgroundColor: "#003366",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#002855",
    },
    modalTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
    closeButton: {
        padding: 5,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 10,
        margin: 16,
        paddingHorizontal: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 45,
        fontSize: 16,
        color: "#333",
    },
    clearSearchButton: {
        padding: 5,
    },
    filterSection: {
        marginHorizontal: 16,
        marginBottom: 10,
    },
    filterHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    filterTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#003366",
    },
    clearFilterText: {
        color: "#003366",
        fontSize: 13,
    },
    filterScrollView: {
        paddingBottom: 8,
    },
    filterButton: {
        backgroundColor: "#fff",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 25,
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    selectedFilterButton: {
        backgroundColor: "#003366",
        borderColor: "#003366",
    },
    filterButtonText: {
        fontSize: 13,
        color: "#555",
    },
    selectedFilterButtonText: {
        color: "#fff",
        fontWeight: "500",
    },
    clearAllButton: {
        backgroundColor: "#f0f0f0",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: "center",
        marginBottom: 12,
    },
    clearAllButtonText: {
        color: "#003366",
        fontSize: 13,
        fontWeight: "500",
    },
    resultsContainer: {
        flex: 1,
        backgroundColor: "#fff",
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    resultsCount: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    productItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomColor: "#eee",
        borderBottomWidth: 1,
    },
    productInfo: {
        flex: 1,
        marginRight: 10,
    },
    productName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#222",
        marginBottom: 5,
    },
    productDetailsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tagContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    productTag: {
        backgroundColor: "#e8f0f8",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginRight: 6,
        marginBottom: 4,
    },
    productTagText: {
        fontSize: 11,
        color: "#003366",
    },
    priceText: {
        color: "#003366",
        fontWeight: "bold",
        fontSize: 15,
    },
    addButton: {
        backgroundColor: "#003366",
        padding: 10,
        borderRadius: 25,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 15,
        fontSize: 14,
        color: "#888",
        lineHeight: 20,
    },
    errorText: {
        color: "#d32f2f",
        textAlign: "center",
        margin: 16,
        padding: 10,
        backgroundColor: "#ffebee",
        borderRadius: 8,
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(0,51,102,0.7)",
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderContainer: {
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    loadingText: {
        color: "#fff",
        marginTop: 10,
        fontSize: 14,
    },
});

export default SearchProductModal;