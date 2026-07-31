import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';

const ITEM_HEIGHT = 44;
const CONTAINER_HEIGHT = 150;

const WheelColumn = ({ data, selectedValue, onValueChange, flex, width }) => {
  const flatListRef = useRef(null);
  const initialIndex = Math.max(0, data.findIndex(item => item.value === selectedValue || item.label === selectedValue));

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleMomentumScrollEnd = useCallback((event) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (data[index]) {
      const val = data[index].value !== undefined ? data[index].value : data[index];
      onValueChange(val);
    }
  }, [data, onValueChange]);

  useEffect(() => {
    if (flatListRef.current && initialIndex >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 60);
    }
  }, [initialIndex]);

  const renderItem = useCallback(({ item }) => {
    const itemVal = item.value !== undefined ? item.value : item;
    const itemLabel = item.label !== undefined ? item.label : item;
    const isSelected = itemVal === selectedValue || itemLabel === selectedValue;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => onValueChange(itemVal)}
        activeOpacity={0.7}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.itemText,
            isSelected && styles.selectedItemText
          ]}
        >
          {itemLabel}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedValue, onValueChange]);

  const styleProps = flex !== undefined ? { flex } : { width: width || 70 };

  return (
    <View style={[styles.wrapper, styleProps]}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item, idx) => (item.value !== undefined ? item.value.toString() : item.toString() + idx)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  itemText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedItemText: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
});

export default WheelColumn;
