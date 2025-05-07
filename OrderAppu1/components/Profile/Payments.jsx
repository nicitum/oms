import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Payments() {
    return (
        <View style={styles.container}>
            <Ionicons name="construct-outline" size={40} color="#003366" />
            <Text style={styles.message}>Online payment is coming soon</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f7fa',
    },
    message: {
        fontSize: 18,
        color: '#003366',
        marginTop: 20,
        textAlign: 'center',
    },
});