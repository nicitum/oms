import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';
import Icon from 'react-native-vector-icons/Ionicons'; // Or your preferred icon library

const DailyOrdersReport = () => {
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  const formattedDate = moment(selectedDate).format('MMMM D, YYYY'); // More professional date format

  const handleAdminReportButtonPress = () => {
    // Implement the action for "Admin Wise Order Report" button here
    console.log("Admin Wise Order Report Button Pressed for Date:", formattedDate);
    // You can navigate to a different screen, fetch data, etc.
    alert("Admin Wise Order Report Button Pressed!\n(Functionality to be implemented)"); // Example action
  };

  return (
    <View style={styles.container}>
      {/* Date Picker Section */}
      <View style={styles.datePickerSection}>
        <Text style={styles.selectedDateText}>{formattedDate}</Text>
        <TouchableOpacity style={styles.pickDateButton} onPress={showDatePicker}>
          <Icon name="calendar-outline" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      {/* Admin Wise Order Report Button */}
      <TouchableOpacity style={styles.adminReportButton} onPress={handleAdminReportButtonPress}>
        <Text style={styles.adminReportButtonText}>Generate Admin Order Report</Text>
        <Icon name="analytics-outline" size={24} color="white" style={{ marginLeft: 10 }} />
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
        date={selectedDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9', // Very light grey background, almost white
    padding: 20,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center',     // Center content horizontally
  },
  datePickerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 90, // More spacing below date picker section
  },
  selectedDateText: {
    fontSize: 22, // Larger date text
    color: '#333',
    marginRight: 15, // Spacing between date and button
    fontWeight: '500', // Slightly lighter bold for date
  },
  pickDateButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'transparent', // No background for button itself
  },
  adminReportButton: {
    flexDirection: 'row', // Icon and text in a row
    backgroundColor: '#28a745', // Professional-looking green
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center', // Center icon and text vertically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3, // For Android shadow
  },
  adminReportButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 5, // Spacing between text and icon (if icon is added)
  },
});

export default DailyOrdersReport;