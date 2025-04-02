import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Reusable pagination component for React Native
 * 
 * @param {Object} props
 * @param {number} props.currentPage - Current active page
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalItems - Total number of items across all pages
 * @param {function} props.onPageChange - Callback function when page changes (receives new page number)
 * @param {string} props.itemsLabel - Label to show for items count (e.g., "Orders", "Products")
 * @param {Object} [props.style] - Optional container style overrides
 * @param {string} [props.primaryColor] - Optional primary color for buttons (defaults to #ffcc00)
 */
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  itemsLabel = 'Items',
  style = {},
  primaryColor = '#ffcc00'
}) => {
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Dynamically update button styles based on primaryColor
  const buttonStyle = {
    ...styles.paginationButton,
    backgroundColor: primaryColor,
  };

  return (
    <View style={[styles.paginationContainer, style]}>
      <TouchableOpacity 
        onPress={handlePrevPage} 
        disabled={currentPage === 1}
        style={[
          buttonStyle,
          currentPage === 1 && styles.paginationButtonDisabled
        ]}
      >
        <Text style={styles.paginationButtonText}>Previous</Text>
      </TouchableOpacity>
      
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Page {currentPage} of {totalPages}
        </Text>
        <Text style={styles.totalText}>
          Total {itemsLabel}: {totalItems}
        </Text>
      </View>

      <TouchableOpacity 
        onPress={handleNextPage}
        disabled={currentPage === totalPages}
        style={[
          buttonStyle,
          currentPage === totalPages && styles.paginationButtonDisabled
        ]}
      >
        <Text style={styles.paginationButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    color: '#666',
  },
  totalText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  }
});

export default Pagination;