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

  // Swipe Right Gesture Responder to open SideDrawer on ANY screen
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Trigger swipe right when dx > 25 and horizontal movement is dominant
        return gestureState.dx > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 45) {
          setIsDrawerOpen(true);
        }
      }
    })
  ).current;

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <View style={styles.wrapper} {...swipePanResponder.panHandlers}>
        {children}

        {/* Global Side Drawer */}
        <SideDrawer
          visible={isDrawerOpen}
          onClose={closeDrawer}
          navigation={navigationRef?.current || navigationRef}
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
