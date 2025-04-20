import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import moment from "moment";
import { ipAddress } from "../../urls";
import CalendarComponent from "./calendar";
import OrdersList from "./orderList";
import RefreshButton from "../general/RefreshButton";
import { checkTokenAndRedirect } from "../../services/auth";

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
      const response = await fetch(`http://${ipAddress}:8090/history`, {
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
    
    // Navigate to UpdateOrderPage if either AM or PM order exists
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
        <Text style={styles.headerText}>Indent History</Text>
        <RefreshButton onRefresh={handleRefresh} />
      </View>

      <View style={styles.content}>
        <CalendarComponent
          selectedDate={selectedDate}
          handleDatePress={handleDatePress}
          dayOrderQuantity={dayOrderQuantity}
        />
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
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -15,
  },
});

export default IndentPage;