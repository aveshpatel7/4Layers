import React, { useRef, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const ITEM_HEIGHT = 50;
const CONTAINER_HEIGHT = 250;

const WheelColumn = ({ data, selectedValue, onValueChange, width = 80 }) => {
  const flatListRef = useRef(null);
  const initialIndex = Math.max(0, data.findIndex(item => item.value === selectedValue));

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleMomentumScrollEnd = useCallback((event) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < data.length) {
      onValueChange(data[index].value);
    }
  }, [data, onValueChange]);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={[styles.itemText, item.value === selectedValue && styles.selectedItemText]}>
        {item.label}
      </Text>
    </View>
  ), [selectedValue]);

  return (
    <View style={[styles.wrapper, { width }]}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => item.value.toString()}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex >= 0 ? initialIndex : 0}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleMomentumScrollEnd}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2 }}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: info.index * ITEM_HEIGHT, animated: false });
          }, 100);
        }}
      />
      <View style={styles.highlightBox} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { height: CONTAINER_HEIGHT, width: 80, justifyContent: 'center', alignItems: 'center' },
  itemContainer: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  itemText: { fontSize: 18, color: '#888', fontWeight: '500' },
  selectedItemText: { color: '#22C55E', fontSize: 20, fontWeight: 'bold' },
  highlightBox: { position: 'absolute', top: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2, height: ITEM_HEIGHT, width: '100%', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(34, 197, 94, 0.4)', backgroundColor: 'rgba(34, 197, 94, 0.12)', borderRadius: 10 }
});

export default WheelColumn;
