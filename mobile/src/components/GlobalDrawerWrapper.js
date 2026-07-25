import React, { useState, useRef, createContext, useContext } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import SideDrawer from './SideDrawer';

export const DrawerContext = createContext({
  openDrawer: () => {},
  closeDrawer: () => {}
});

export const useDrawer = () => useContext(DrawerContext);

export default function GlobalDrawerWrapper({ children, navigationRef }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  // Swipe Right Gesture Responder to open SideDrawer on ANY screen (Hyper-responsive)
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Instant response if touch originates near left edge (first 70px)
        return evt.nativeEvent.pageX < 70;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Low threshold: just 10px horizontal movement to right
        return gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Ultra-sensitive trigger: swipe right by 15px OR quick velocity flick (vx > 0.12)
        if (gestureState.dx > 15 || gestureState.vx > 0.12) {
          setIsDrawerOpen(true);
        }
      }
    })
  ).current;

  const getActiveRouteName = () => {
    try {
      if (navigationRef && navigationRef.current) {
        const route = navigationRef.current.getCurrentRoute();
        return route ? route.name : 'HomeTab';
      }
    } catch (e) {
      // Fallback
    }
    return 'HomeTab';
  };

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <View style={styles.wrapper} {...swipePanResponder.panHandlers}>
        {children}

        {/* Global Side Drawer */}
        <SideDrawer
          visible={isDrawerOpen}
          onClose={closeDrawer}
          navigation={navigationRef?.current || navigationRef}
          activeRouteName={getActiveRouteName()}
        />
      </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0E0E0E'
  }
});
