import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Calendar } from "react-native-calendars";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const CalendarComponent = ({ selectedDate, handleDatePress }) => {
    const today = new Date().toISOString().split('T')[0];

    const handleDayPress = (day) => {
        handleDatePress(day);
    };

    return (
        <View style={styles.container}>
            <Calendar
                onDayPress={handleDayPress}
                markedDates={{
                    [selectedDate]: {
                        marked: true,
                        dotColor: styles.theme.selectedDayBackgroundColor,
                        customStyles: {
                            container: {
                                borderWidth: 1.5,
                                borderColor: styles.theme.selectedDayBackgroundColor,
                                borderRadius: 20,
                            },
                            text: {
                                color: styles.theme.selectedDayBackgroundColor,
                                fontWeight: 'bold',
                            }
                        }
                    },
                    [today]: {
                        marked: true,
                        dotColor: styles.theme.todayDotColor,
                        customStyles: {
                            container: {
                                borderWidth: 1,
                                borderColor: styles.theme.todayDotColor,
                                borderRadius: 20,
                            }
                        }
                    }
                }}
                theme={styles.theme}
                renderArrow={(direction) => (
                    <View style={styles.arrowContainer}>
                    <MaterialIcons
                        name={direction === "left" ? "chevron-left" : "chevron-right"}
                        size={24}
                        color={styles.theme.arrowColor}
                    />
                    </View>
                )}
                dayComponent={({ date, state }) => {
                    const isSelected = date.dateString === selectedDate;
                    const isToday = date.dateString === today;

                    return (
                        <View style={styles.dayWrapper}>
                            <TouchableOpacity
                                style={[
                                    styles.dayContainer,
                                    isSelected && styles.selectedDay,
                                    isToday && styles.todayDay,
                                    state === "disabled" && styles.disabledDay
                                ]}
                                onPress={() => handleDayPress(date)}
                                disabled={state === "disabled"}
                            >
                                <Text
                                    style={[
                                        styles.dayText,
                                        state === "disabled" && styles.disabledDayText,
                                        isSelected && styles.selectedDayText,
                                        isToday && styles.todayText
                                    ]}
                                >
                                    {date.day}
                                </Text>
                                {isSelected && <View style={styles.selectedDot} />}
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        borderColor: '#e0e0e0',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        margin: 16,
    },
    theme: {
        backgroundColor: '#ffffff',
        calendarBackground: '#ffffff',
        textSectionTitleColor: '#003366',
        dayTextColor: '#333333',
        todayTextColor: '#003366',
        selectedDayBackgroundColor: '#003366',
        selectedDayTextColor: '#003366',
        monthTextColor: '#003366',
        yearTextColor: '#003366',
        arrowColor: '#003366',
        todayDotColor: '#003366',
        textDisabledColor: '#d9d9d9',
        dotColor: '#003366',
        selectedDotColor: '#ffffff',
        textMonthFontWeight: 'bold',
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14,
        textDayHeaderFontWeight: '600',
        textDayFontSize: 16,
        textDayFontWeight: '500',
    },
    dayWrapper: {
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
    },
    dayContainer: {
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    dayText: {
        fontSize: 16,
        color: "#333",
        fontWeight: '500',
    },
    selectedDay: {
        borderWidth: 1.5,
        borderColor: '#003366',
    },
    selectedDayText: {
        color: '#003366',
        fontWeight: 'bold',
    },
    selectedDot: {
        position: 'absolute',
        bottom: 4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#003366',
    },
    todayDay: {
        borderWidth: 1.5,
        borderColor: '#003366',
    },
    todayText: {
        color: '#003366',
        fontWeight: 'bold',
    },
    disabledDay: {
        opacity: 0.3,
    },
    disabledDayText: {
        color: "#d9d9d9",
    },
    arrowContainer: {
        backgroundColor: '#f5f7fa',
        borderRadius: 20,
        padding: 4,
        marginHorizontal: 4,
    },
});

export default CalendarComponent;