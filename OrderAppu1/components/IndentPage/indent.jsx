import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import moment from "moment";
import { ipAddress } from "../../urls";
import CalendarComponent from "./calendar";
import OrdersList from "./orderList";
import RefreshButton from "../general/RefreshButton";
import { checkTokenAndRedirect } from "../../services/auth";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const IndentPage = () => {
  const [orders, setOrders] = useState({});
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const navigation = useNavigation();

  useEffect(() => {
    fetchOrders();
  }, []);

  const dayOrderQuantity = useMemo(() => {
    const texts = {};
    Object.keys(orders).forEach((date) => {
      const amOrder = orders[date]?.AM;
      const pmOrder = orders[date]?.PM;
      const totalQuantity = (amOrder?.quantity || 0) + (pmOrder?.quantity || 0);
      if (totalQuantity > 0) {
        texts[date] = `${totalQuantity}`;
      }
    });
    return texts;
  }, [orders]);

  const fetchOrders = async () => {
    try {
      const customerId = await AsyncStorage.getItem("customerId");
      const userAuthToken = await checkTokenAndRedirect(navigation);
      if (!customerId || !userAuthToken) {
        console.error("Missing customerId or userAuthToken");
        return;
      }
      const response = await fetch(`http://${ipAddress}:8091/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userAuthToken}`,
        },
      });
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      const data = await response.json();
      const transformedData = Object.keys(data).reduce((acc, epochTime) => {
        const formattedDate = moment.unix(epochTime).format("YYYY-MM-DD");
        acc[formattedDate] = data[epochTime];
        return acc;
      }, {});
      setOrders(transformedData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const handleDatePress = (day) => {
    setSelectedDate(day.dateString);
    const dayOrders = orders[day.dateString] || {};
    const amOrder = dayOrders.AM;
    const pmOrder = dayOrders.PM;
    
    if (amOrder || pmOrder) {
      navigation.navigate('UpdateOrderPage', {
        selectedDate: day.dateString,
        amOrder: amOrder || null,
        pmOrder: pmOrder || null
      });
    }
  };

  const handleRefresh = () => fetchOrders();

  const { amOrder, pmOrder } = useMemo(() => {
    const dayOrders = orders[selectedDate] || {};
    return { amOrder: dayOrders.AM || null, pmOrder: dayOrders.PM || null };
  }, [orders, selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialIcons name="history" size={24} color="#FFFFFF" />
          <Text style={styles.headerText}>Order History</Text>
        </View>
        <RefreshButton onRefresh={handleRefresh} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <MaterialIcons name="calendar-today" size={20} color="#003366" />
            <Text style={styles.calendarTitle}>Select Date</Text>
          </View>
        <CalendarComponent
          selectedDate={selectedDate}
          handleDatePress={handleDatePress}
          dayOrderQuantity={dayOrderQuantity}
        />
        </View>

        <View style={styles.ordersContainer}>
          <View style={styles.ordersHeader}>
            <MaterialIcons name="list-alt" size={20} color="#003366" />
            <Text style={styles.ordersTitle}>Orders for {moment(selectedDate).format("DD MMM YYYY")}</Text>
          </View>
        <OrdersList
          amOrder={amOrder}
          pmOrder={pmOrder}
          selectedDate={selectedDate}
          navigation={navigation}
          onOrderPress={() => {
            if (amOrder || pmOrder) {
              navigation.navigate('UpdateOrderPage', {
                selectedDate,
                amOrder,
                pmOrder
              });
            }
          }}
        />
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    backgroundColor: "#003366",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
    marginLeft: 8,
  },
  ordersContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ordersHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  ordersTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
    marginLeft: 8,
  },
});

export default IndentPage;