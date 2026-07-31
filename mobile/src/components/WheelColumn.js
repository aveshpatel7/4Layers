import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';

const ITEM_HEIGHT = 44;
const CONTAINER_HEIGHT = 150;
const REPEATS = 60; // 60 cycles for smooth infinite looping on Hours & Minutes

const WheelColumn = ({ data, selectedValue, onValueChange, flex, width, isLooping = false }) => {
  const flatListRef = useRef(null);
  const baseLength = data.length;

  const expandedData = useMemo(() => {
    if (!isLooping || baseLength <= 1) return data;
    const result = [];
    for (let r = 0; r < REPEATS; r++) {
      result.push(...data);
    }
    return result;
  }, [data, isLooping, baseLength]);

  const baseIndex = useMemo(() => {
    return Math.max(0, data.findIndex(item => {
      const val = item.value !== undefined ? item.value : item;
      const label = item.label !== undefined ? item.label : item;
      return val === selectedValue || label === selectedValue;
    }));
  }, [data, selectedValue]);

  const middleCycle = isLooping ? Math.floor(REPEATS / 2) : 0;
  const initialIndex = isLooping ? (middleCycle * baseLength + baseIndex) : baseIndex;

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleMomentumScrollEnd = useCallback((event) => {
    const y = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(y / ITEM_HEIGHT);

    if (isLooping && baseLength > 0) {
      const normalizedIndex = ((rawIndex % baseLength) + baseLength) % baseLength;
      const selectedObj = data[normalizedIndex];
      if (selectedObj) {
        const val = selectedObj.value !== undefined ? selectedObj.value : selectedObj;
        onValueChange(val);
      }

      // Silent recenter if user scrolls near boundary limits
      if (rawIndex < baseLength * 5 || rawIndex > baseLength * (REPEATS - 5)) {
        const resetOffset = (middleCycle * baseLength + normalizedIndex) * ITEM_HEIGHT;
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: resetOffset, animated: false });
        }, 50);
      }
    } else {
      const clampedIndex = Math.max(0, Math.min(data.length - 1, rawIndex));
      if (data[clampedIndex]) {
        const val = data[clampedIndex].value !== undefined ? data[clampedIndex].value : data[clampedIndex];
        onValueChange(val);
      }
    }
  }, [data, isLooping, baseLength, onValueChange, middleCycle]);

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
        data={expandedData}
        keyExtractor={(item, idx) => (item.value !== undefined ? `${item.value}_${idx}` : `${item}_${idx}`)}
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
