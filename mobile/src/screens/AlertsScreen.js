import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0E0E0E',           // Google Stitch background
  surface: '#1C1B1B',      // surface-container
  accent: '#22C55E',       // Primary green
  border: 'rgba(255,255,255,0.05)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6'
};

export default function AlertsScreen({ navigation: navProp }) {
  const nav = useNavigation();
  const navigation = navProp || nav;

  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'critical', 'schedule'

  useEffect(() => {
    fetchAlerts(true);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener ? navigation.addListener('focus', () => {
      fetchAlerts(false);
    }) : () => {};

    return unsubscribe;
  }, [navigation]);

  const fetchAlerts = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await apiClient.get('/api/alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts list:', error);
      Alert.alert('Error', 'Could not retrieve notifications log');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts(false);
  };

  const handleMarkAsRead = async (alertId) => {
    setAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, is_read: true } : a)
    );
    try {
      await apiClient.patch(`/api/alerts/${alertId}/read`);
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
      fetchAlerts(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (alerts.filter(a => !a.is_read).length === 0) return;
    try {
      setIsLoading(true);
      await apiClient.patch('/api/alerts/read-all');
      await fetchAlerts(false);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
      Alert.alert('Error', 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (alerts.length === 0) return;
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to permanently delete all notifications history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiClient.delete('/api/alerts');
              setAlerts([]);
              Alert.alert('Cleared', 'Notifications log has been emptied.');
            } catch (error) {
              console.error('Failed to clear alerts:', error);
              Alert.alert('Error', 'Failed to clear log.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatTime = (timestampStr) => {
    if (!timestampStr) return '';
    try {
      const date = new Date(timestampStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const getFilteredAlerts = () => {
    if (selectedFilter === 'critical') {
      return alerts.filter(a => a.type === 'device_offline');
    }
    if (selectedFilter === 'schedule') {
      return alerts.filter(a => a.type === 'schedule_run');
    }
    return alerts;
  };

  const filteredAlerts = getFilteredAlerts();

  if (isLoading && alerts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TOKENS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>System Log</Text>
        <TouchableOpacity 
          style={styles.markReadBtn} 
          onPress={handleMarkAllRead}
          disabled={alerts.filter(a => !a.is_read).length === 0}
        >
          <MaterialCommunityIcons name="check-all" size={16} color={TOKENS.accent} />
          <Text style={styles.markReadBtnText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          onPress={() => setSelectedFilter('all')}
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>All Events</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setSelectedFilter('critical')}
          style={[styles.filterChip, selectedFilter === 'critical' && styles.filterChipActive]}
        >
          <MaterialCommunityIcons 
            name="alert-circle-outline" 
            size={14} 
            color={selectedFilter === 'critical' ? TOKENS.accent : TOKENS.error} 
            style={styles.filterChipIcon}
          />
          <Text style={[styles.filterChipText, selectedFilter === 'critical' && styles.filterChipTextActive]}>Critical</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setSelectedFilter('schedule')}
          style={[styles.filterChip, selectedFilter === 'schedule' && styles.filterChipActive]}
        >
          <MaterialCommunityIcons 
            name="clock-outline" 
            size={14} 
            color={selectedFilter === 'schedule' ? TOKENS.accent : TOKENS.info} 
            style={styles.filterChipIcon}
          />
          <Text style={[styles.filterChipText, selectedFilter === 'schedule' && styles.filterChipTextActive]}>Automation</Text>
        </TouchableOpacity>
      </View>

      {/* List content */}
      {filteredAlerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-off" size={48} color={TOKENS.textSecondary} />
          <Text style={styles.emptyText}>All systems secure.</Text>
          <Text style={styles.emptySubtext}>No warning alerts or automation logs reported in this tab.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TOKENS.accent}
              colors={[TOKENS.accent]}
            />
          }
          renderItem={({ item }) => {
            const isUnread = !item.is_read;
            const isOffline = item.type === 'device_offline';
            const isSchedule = item.type === 'schedule_run';
            
            // Resolve icon and accent colors
            let iconName = 'bell-outline';
            let iconColor = TOKENS.textSecondary;
            let stripeColor = 'rgba(255,255,255,0.05)';
            
            if (isOffline) {
              iconName = 'alert-circle';
              iconColor = TOKENS.error;
              stripeColor = TOKENS.error;
            } else if (isSchedule) {
              iconName = 'calendar-clock';
              iconColor = TOKENS.info;
              stripeColor = TOKENS.info;
            } else {
              iconName = 'check-circle';
              iconColor = TOKENS.accent;
              stripeColor = TOKENS.accent;
            }

            return (
              <TouchableOpacity
                activeOpacity={isUnread ? 0.8 : 1}
                style={[
                  styles.alertCard,
                  isOffline && styles.alertCardCritical,
                  isUnread && styles.alertCardUnread
                ]}
                onPress={() => isUnread && handleMarkAsRead(item.id)}
              >
                {/* Visual left colored stripe */}
                <View style={[styles.indicatorStripe, { backgroundColor: stripeColor }]} />

                {/* Circle Icon Badge */}
                <View style={[styles.iconBadge, { borderColor: iconColor + '33' }]}>
                  <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
                </View>

                {/* Text Content */}
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                      {isOffline ? 'Device Offline' : isSchedule ? 'Schedule Triggered' : 'Appliance Online'}
                    </Text>
                    <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.cardMsg} numberOfLines={2}>
                    {item.message}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Clear Logs floating option button */}
      {alerts.length > 0 && (
        <TouchableOpacity 
          style={styles.clearBtn} 
          onPress={handleClearAll}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="delete-sweep" size={24} color="#002112" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TOKENS.bg
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    letterSpacing: -0.5
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  markReadBtnText: {
    color: TOKENS.accent,
    fontWeight: '700',
    fontSize: 12
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  filterChipActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: TOKENS.accent
  },
  filterChipIcon: {
    marginRight: 4
  },
  filterChipText: {
    color: TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  filterChipTextActive: {
    color: TOKENS.accent
  },
  listContainer: {
    paddingBottom: 80
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  alertCardCritical: {
    borderColor: 'rgba(239, 68, 68, 0.15)'
  },
  alertCardUnread: {
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  indicatorStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0D0D0D',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    flex: 1,
    marginRight: 6
  },
  cardTitleUnread: {
    color: TOKENS.textPrimary
  },
  cardTime: {
    fontSize: 10,
    color: TOKENS.textSecondary,
    fontWeight: '500'
  },
  cardMsg: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    lineHeight: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100
  },
  emptyText: {
    fontSize: 16,
    color: TOKENS.textPrimary,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6
  },
  emptySubtext: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  },
  clearBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOKENS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.5
  }
});
