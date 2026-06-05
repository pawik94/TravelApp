import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from './src/theme';

import HomeScreen       from './src/screens/HomeScreen';
import AddTripScreen    from './src/screens/AddTripScreen';
import TripScreen       from './src/screens/TripScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';

function App() {
  const [stack, setStack] = useState([{ screen:'Home', params:{} }]);
  const current = stack[stack.length-1];

  const navigate = (screen, params={}) => setStack(prev=>[...prev,{screen,params}]);
  const goBack   = ()               => setStack(prev=>prev.length>1?prev.slice(0,-1):prev);
  const replace  = (screen,params={})=> setStack(prev=>[...prev.slice(0,-1),{screen,params}]);

  const navigation = { navigate, goBack, replace };

  const renderScreen = () => {
    const { screen, params } = current;
    const props = { navigation, route:{ params } };
    switch(screen) {
      case 'Home':       return <HomeScreen       {...props} />;
      case 'AddTrip':    return <AddTripScreen    {...props} />;
      case 'Trip':       return <TripScreen       {...props} />;
      case 'AddExpense': return <AddExpenseScreen {...props} />;
      case 'Categories': return <CategoriesScreen {...props} />;
      default:           return <HomeScreen       {...props} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.surface} />
      {renderScreen()}
    </View>
  );
}

const styles = StyleSheet.create({ container:{ flex:1, backgroundColor:COLORS.background } });
registerRootComponent(App);
