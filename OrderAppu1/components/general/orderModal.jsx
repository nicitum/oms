import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

const OrderModal = ({ isVisible, onClose, onSelect, onEdit }) => {
  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          {/* Close button */}
          {/* <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity> */}

          <Text style={styles.modalTitle}>Your Order</Text>

          <View style={styles.buttonRow}>
            {/* Select Default Order and Edit Order buttons in the same row */}
            <TouchableOpacity style={styles.button} onPress={onSelect}>
              <Text style={styles.buttonText}>Select</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onEdit}>
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    width: 250,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    // alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    marginLeft: 10,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  closeButtonText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffcc00",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    padding: 5,
    margin: 5,
    width: "45%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default OrderModal;
