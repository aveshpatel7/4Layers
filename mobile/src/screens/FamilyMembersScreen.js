import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Platform,
  StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client';
import BrandLogo from '../components/BrandLogo';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  accent: '#22C55E',
  accentDark: 'rgba(34, 197, 94, 0.15)',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  warning: '#F59E0B',
  warningDark: 'rgba(245, 158, 11, 0.15)',
  error: '#EF4444',
  cardBg: '#18181B'
};

export default function FamilyMembersScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);

  // Add Member Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingReceivedInvites, setPendingReceivedInvites] = useState([]);

  // Fetch registered devices & rooms to extract unique rooms/nodes
  const fetchNodesAndDevices = async () => {
    try {
      setIsLoading(true);
      const [devsRes, roomsRes] = await Promise.all([
        apiClient.get('/api/devices'),
        apiClient.get('/api/rooms').catch(() => ({ data: [] }))
      ]);

      const devList = devsRes.data || [];
      const roomList = roomsRes.data || [];
      setDevices(devList);
      setRooms(roomList);

      // Extract unique base node IDs
      const uniqueNodes = new Set();
      devList.forEach(d => {
        let baseNode = d.node_id || d.id;
        if (baseNode && baseNode.includes('_')) {
          baseNode = baseNode.split('_')[0];
        }
        if (baseNode) uniqueNodes.add(baseNode);
      });

      const nodesArray = Array.from(uniqueNodes);
      if (nodesArray.length > 0) {
        const initialNode = selectedNodeId || nodesArray[0];
        setSelectedNodeId(initialNode);
        await fetchMembers(initialNode);
      } else {
        const defaultNode = 'ESP32_NODE_1';
        setSelectedNodeId(defaultNode);
        await fetchMembers(defaultNode);
      }
      await fetchPendingReceivedInvites();
    } catch (err) {
      console.error('[FamilyMembers] Error loading devices:', err);
      const defaultNode = 'ESP32_NODE_1';
      setSelectedNodeId(defaultNode);
      await fetchMembers(defaultNode);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async (nodeId) => {
    if (!nodeId) return;
    try {
      setIsRefreshingMembers(true);
      const res = await apiClient.get(`/api/nodes/${nodeId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      console.error('[FamilyMembers] Error fetching members:', err);
      setMembers([]);
    } finally {
      setIsRefreshingMembers(false);
    }
  };

  const fetchPendingReceivedInvites = async () => {
    try {
      const res = await apiClient.get('/api/nodes/pending-invites');
      setPendingReceivedInvites(res.data || []);
    } catch (err) {
      console.warn('[FamilyMembers] Error fetching pending invites:', err);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      await apiClient.post(`/api/nodes/invitations/${inviteId}/accept`);
      Alert.alert('Invitation Accepted 🎉', 'You now have control access to this room!');
      fetchPendingReceivedInvites();
      fetchNodesAndDevices();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await apiClient.post(`/api/nodes/invitations/${inviteId}/reject`);
      fetchPendingReceivedInvites();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to reject invitation');
    }
  };

  const getNodeDisplayName = (nodeId) => {
    if (!nodeId) return 'Main Room';

    // Find any device associated with this node ID
    const matchingDev = devices.find(d => {
      let bNode = d.node_id || d.id;
      if (bNode && bNode.includes('_')) bNode = bNode.split('_')[0];
      return bNode === nodeId || d.node_id === nodeId;
    });

    if (matchingDev && matchingDev.room_id) {
      const room = rooms.find(r => r.id === matchingDev.room_id);
      if (room) return room.name;
    }

    if (matchingDev && matchingDev.name) {
      return matchingDev.name;
    }

    if (nodeId.includes('-')) {
      const suffix = nodeId.split('-').pop();
      return `Room (${suffix})`;
    }
    return nodeId;
  };

  useFocusEffect(
    useCallback(() => {
      fetchNodesAndDevices();
    }, [])
  );

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    fetchMembers(nodeId);
  };

  const handleAddMember = async () => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Validation Error', 'Please enter a valid email address or username.');
      return;
    }

    if (!selectedNodeId) {
      Alert.alert('Selection Error', 'Please select a room first.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post(`/api/nodes/${selectedNodeId}/share`, {
        email: cleanEmail
      });

      const { message } = res.data;
      Alert.alert('Success 🎉', message || 'Member added successfully!');

      setEmailInput('');
      setAddModalVisible(false);
      fetchMembers(selectedNodeId);
    } catch (err) {
      console.error('[FamilyMembers] Error sharing node:', err);
      const statusCode = err.response?.status;
      const errMsg = err.response?.data?.detail || 'Failed to add member.';
      if (statusCode === 404) {
        Alert.alert('User Not Found ❌', 'This user is not registered.');
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Access',
      `Are you sure you want to remove ${member.email} from controlling this node?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/nodes/${selectedNodeId}/share/${member.id}`);
              Alert.alert('Removed', 'Access revoked successfully.');
              fetchMembers(selectedNodeId);
            } catch (err) {
              console.error('[FamilyMembers] Remove error:', err);
              Alert.alert('Error', 'Failed to remove member.');
            }
          }
        }
      ]
    );
  };

  // Build list of unique nodes for selection chips
  const uniqueNodeList = Array.from(new Set(devices.map(d => {
    let n = d.node_id || d.id;
    if (n && n.includes('_')) {
      return n.split('_')[0];
    }
    return n;
  }))).filter(Boolean);

  if (uniqueNodeList.length === 0 && selectedNodeId) {
    uniqueNodeList.push(selectedNodeId);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={TOKENS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={TOKENS.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>Add Members</Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={16} color={TOKENS.bg} />
          <Text style={styles.addBtnText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {/* Room Selector Row */}
      {uniqueNodeList.length > 0 && (
        <View style={styles.nodeSelectorContainer}>
          <Text style={styles.sectionSublabel}>SELECT ROOM TO SHARE:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nodeChipsRow}>
            {uniqueNodeList.map((nodeId) => {
              const isSelected = selectedNodeId === nodeId;
              const roomName = getNodeDisplayName(nodeId);
              return (
                <TouchableOpacity
                  key={nodeId}
                  style={[styles.nodeChip, isSelected && styles.nodeChipSelected]}
                  onPress={() => handleSelectNode(nodeId)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="door"
                    size={16}
                    color={isSelected ? TOKENS.bg : TOKENS.accent}
                  />
                  <Text style={[styles.nodeChipText, isSelected && styles.nodeChipTextSelected]}>
                    {roomName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content Body */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={TOKENS.accent} />
          <Text style={styles.loadingText}>Syncing members...</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>
              Active Members ({members.length})
            </Text>
            {isRefreshingMembers && <ActivityIndicator size="small" color={TOKENS.accent} />}
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="account-group-outline" size={56} color={TOKENS.textSecondary} />
              <Text style={styles.emptyTitle}>No Members Added Yet</Text>
              <Text style={styles.emptySub}>
                Add members or housemates to share control of <Text style={{ color: TOKENS.accent, fontWeight: '700' }}>{getNodeDisplayName(selectedNodeId)}</Text>.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={18} color={TOKENS.bg} />
                <Text style={styles.emptyAddBtnText}>Add Member</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id || item.email}
              contentContainerStyle={styles.membersList}
              renderItem={({ item }) => {
                const displayName = item.username ? (item.username.startsWith('@') ? item.username : `@${item.username}`) : item.email;
                return (
                  <View style={styles.memberCard}>
                    <View style={styles.memberAvatarCircle}>
                      <MaterialCommunityIcons
                        name="account-check-outline"
                        size={22}
                        color={TOKENS.accent}
                      />
                    </View>

                    <View style={styles.memberDetails}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <View style={[styles.statusBadge, styles.badgeActive]}>
                          <Text style={[styles.statusBadgeText, styles.textActive]}>
                            ACTIVE
                          </Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveMember(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={TOKENS.error} />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Add Member Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="account-plus-outline" size={22} color={TOKENS.accent} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Add Member</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Grant access to <Text style={{ color: TOKENS.accent, fontWeight: '700' }}>{getNodeDisplayName(selectedNodeId)}</Text>.
            </Text>

            <Text style={styles.inputLabel}>EMAIL ADDRESS OR USERNAME</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="account-search-outline" size={20} color={TOKENS.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. member@4layers.in or @username"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={emailInput}
                onChangeText={setEmailInput}
              />
            </View>

            <View style={styles.infoNotice}>
              <MaterialCommunityIcons name="information-outline" size={16} color={TOKENS.accent} style={{ marginRight: 6 }} />
              <Text style={styles.infoNoticeText}>
                Enter the registered email address of the user. If they are not registered on the 4Layers app, they cannot be added.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleAddMember}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={TOKENS.bg} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={18} color={TOKENS.bg} style={{ marginRight: 4 }} />
                    <Text style={styles.submitBtnText}>ADD MEMBER</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    minHeight: 56
  },
  backBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    letterSpacing: 0.5,
    marginHorizontal: 12
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4
  },
  addBtnText: {
    color: TOKENS.bg,
    fontSize: 12,
    fontWeight: '800'
  },
  nodeSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TOKENS.surface,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border
  },
  sectionSublabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TOKENS.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.8
  },
  nodeChipsRow: {
    flexDirection: 'row',
    gap: 8
  },
  nodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 6
  },
  nodeChipSelected: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  nodeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  nodeChipTextSelected: {
    color: TOKENS.bg
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  receivedInviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)'
  },
  receivedInviteTitle: {
    fontSize: 13,
    color: TOKENS.textPrimary,
    lineHeight: 18
  },
  receivedInviteSub: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4
  },
  acceptBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800'
  },
  rejectBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.error
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: TOKENS.textSecondary,
    fontSize: 13
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  membersList: {
    paddingBottom: 40
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  memberAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  memberDetails: {
    flex: 1
  },
  memberEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    marginBottom: 4
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  usernameText: {
    fontSize: 12,
    color: TOKENS.textSecondary
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeActive: {
    backgroundColor: TOKENS.accentDark
  },
  badgePending: {
    backgroundColor: TOKENS.warningDark
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  textActive: {
    color: TOKENS.accent
  },
  textPending: {
    color: TOKENS.warning
  },
  removeBtn: {
    padding: 8
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.cardBg,
    borderRadius: 16,
    padding: 30,
    marginTop: 20,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    marginTop: 12,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  emptyAddBtnText: {
    color: TOKENS.bg,
    fontWeight: '800',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TOKENS.textPrimary
  },
  modalSubtext: {
    fontSize: 12.5,
    color: TOKENS.textSecondary,
    lineHeight: 18,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222225',
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  textInput: {
    flex: 1,
    height: 44,
    color: TOKENS.textPrimary,
    fontSize: 14
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: TOKENS.accentDark,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 11,
    color: TOKENS.accent,
    lineHeight: 16
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  cancelBtnText: {
    color: TOKENS.textSecondary,
    fontWeight: '700',
    fontSize: 13
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  submitBtnText: {
    color: TOKENS.bg,
    fontWeight: '800',
    fontSize: 13
  }
});
