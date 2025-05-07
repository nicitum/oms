import React from "react";
import { 
    View, 
    Text, 
    Modal, 
    TouchableOpacity, 
    StyleSheet,
    Dimensions,
    ScrollView,
    SafeAreaView
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const { width, height } = Dimensions.get('window');

const ProfileModal = ({ visible, onClose, content }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Profile Details</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView 
                        style={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.contentWrapper}>
                            {content}
                        </View>
                    </ScrollView>

                    <View style={styles.bottomHandle} />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: height * 0.4,
        maxHeight: height * 0.9,
        width: '100%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#003366',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    closeButton: {
        padding: 8,
    },
    contentContainer: {
        flex: 1,
    },
    contentWrapper: {
        padding: 20,
    },
    bottomHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        alignSelf: 'center',
        marginVertical: 8,
    }
});

export default ProfileModal;
