import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Linking,
  Platform,
  StyleSheet,
  Dimensions,
  TextInput,
  Switch,
  Animated,
  Alert,
  Share,
  Vibration,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
// 🔽 Firebase
import { db, auth, storage } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
// 🔽 Icons
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';

// 🔽 Types
type FamilyMember = {
  id: string;
  name: string;
  image: any; // { uri: string } or null
  age?: string;
  occupation?: string;
  address?: string;
  phone?: string;
  email?: string;
  birthday?: string;
  hobbies?: string[];
  status?: 'Deceased';
  spouseObj?: FamilyMember;
  children?: FamilyMember[];
};

// 🔽 Flatten tree for search
const flattenTree = (node: FamilyMember): FamilyMember[] => {
  const result: FamilyMember[] = [node];
  if (node.children) {
    node.children.forEach((child) => {
      result.push(...flattenTree(child));
    });
  }
  if (node.spouseObj) {
    result.push(node.spouseObj);
  }
  return result;
};

const { width } = Dimensions.get('window');

// 🔽 Global image URL cache
const imageUrlCache = new Map<string, string | null>();

export default function App() {
  const [familyTrees, setFamilyTrees] = useState<FamilyMember[]>([]);
  const [memberStack, setMemberStack] = useState<FamilyMember[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [greetingMessage, setGreetingMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const imageScaleAnim = useRef(new Animated.Value(1)).current;

  // 🔥 Load image URL for a single member
  const loadImageForMember = async (member: FamilyMember): Promise<FamilyMember> => {
    if (!member.image || typeof member.image !== 'string') {
      return { ...member, image: null };
    }

    // Check cache first
    if (imageUrlCache.has(member.image)) {
      const cachedUrl = imageUrlCache.get(member.image);
      return { ...member, image: cachedUrl ? { uri: cachedUrl } : null };
    }

    try {
      const url = await getDownloadURL(ref(storage, `images/${member.image}`));
      imageUrlCache.set(member.image, url);
      return { ...member, image: { uri: url } };
    } catch (error) {
      console.warn(`Image not found: ${member.image}`);
      imageUrlCache.set(member.image, null);
      return { ...member, image: null };
    }
  };

  // 🔥 Preload all image URLs in background
  const preloadAllImages = async (families: FamilyMember[]) => {
    const allMembers = families.flatMap(tree => flattenTree(tree));
    for (const member of allMembers) {
      if (member.image && typeof member.image === 'string' && !imageUrlCache.has(member.image)) {
        loadImageForMember(member); // Fire and forget
      }
    }
  };

  // 🔥 Handle auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // 🔥 Load family trees (data only)
  useEffect(() => {
    if (!user) return;

    const hour = new Date().getHours();
    let greeting = '';
    if (hour < 12) greeting = 'Good Morning!';
    else if (hour < 17) greeting = 'Good Afternoon!';
    else if (hour < 21) greeting = 'Good Evening!';
    else greeting = 'Good Night!';
    setGreetingMessage(greeting);

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();

    const loadFamiliesFromFirestore = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'families'));
        const families = querySnapshot.docs.map(doc => doc.data() as any);
        families.sort((a, b) => {
          const idA = parseInt(a.id.replace(/\D/g, '') || '0');
          const idB = parseInt(b.id.replace(/\D/g, '') || '0');
          return idA - idB;
        });
        setFamilyTrees(families);
        // Start preloading images in background
        setTimeout(() => preloadAllImages(families), 1000);
      } catch (error) {
        console.error('Failed to load families from Firestore:', error);
        Alert.alert('Error', 'Could not load family data. Please check your internet connection.');
      }
    };

    loadFamiliesFromFirestore();
  }, [user]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (Platform.OS !== 'web') Vibration.vibrate(50);
  };

  const toggleFavorite = (memberId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(memberId)) {
      newFavorites.delete(memberId);
    } else {
      newFavorites.add(memberId);
      if (Platform.OS !== 'web') Vibration.vibrate(100);
    }
    setFavorites(newFavorites);
  };

const openImageModal = (memberWithImage: FamilyMember) => {
  setSelectedImage(memberWithImage.image);   // must be { uri: ... }
  setSelectedImageName(memberWithImage.name);
  setShowImageModal(true);

  Animated.spring(imageScaleAnim, {
    toValue: 1.1,
    tension: 100,
    friction: 8,
    useNativeDriver: true,
  }).start();
};


  const closeImageModal = () => {
    Animated.spring(imageScaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      setShowImageModal(false);
      setSelectedImage(null);
      setSelectedImageName('');
    });
  };

  const shareProfile = async (member: FamilyMember) => {
    try {
      await Share.share({
        message: `Check out ${member.name}'s profile!
${member.status ? `Status: ${member.status}\n` : ''}${member.age ? `Age: ${member.age}\n` : ''}${member.occupation ? `Occupation: ${member.occupation}\n` : ''}${member.phone ? `Phone: ${member.phone}\n` : ''}${member.email ? `Email: ${member.email}\n` : ''}${member.address ? `Address: ${member.address}` : ''}`,
        title: `${member.name}'s Profile`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const showMemberStats = () => {
    const allMembers = familyTrees.flatMap((tree) => flattenTree(tree));
    const total = allMembers.length;
    const living = allMembers.filter((m) => m.status !== 'Deceased').length;
    const avgAge = allMembers
      .filter((m) => m.age)
      .reduce((sum, m) => sum + parseInt(m.age || '0'), 0);
    const uniqueAges = allMembers.filter((m) => m.age).length;
    const avg = uniqueAges > 0 ? Math.round(avgAge / uniqueAges) : 0;
    Alert.alert(
      'Family Statistics',
      `Total Members: ${total}
Living: ${living}
Deceased: ${total - living}
Average Age: ${avg} years
Favorites: ${favorites.size}`,
      [{ text: 'Got it', style: 'default' }]
    );
  };

  const makeCall = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert('Error', 'Phone calls not supported');
    });
  };

  const sendSMS = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `sms:${cleanPhone}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert('Error', 'SMS not supported');
    });
  };

  const sendEmail = (email?: string) => {
    if (!email) return;
    const url = `mailto:${email}`;
    Linking.openURL(url);
  };

  const openInMaps = (address?: string) => {
    if (!address) return;
    const cleanAddress = address.trim().replace(/\s+/g, ' ');
    const query = encodeURIComponent(cleanAddress);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${query}`,
      android: `https://www.google.com/maps/search/?api=1&query=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps. Please install Google Maps or Apple Maps.');
      });
    }
  };

  const getThemedStyles = () => ({
    container: {
      ...styles.container,
      backgroundColor: isDarkMode ? '#111827' : '#f3f4f6',
    },
    header: {
      ...styles.header,
      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
    },
    headerTitle: {
      ...styles.headerTitle,
      color: isDarkMode ? '#f9fafb' : '#111827',
    },
    headerSubtitle: {
      ...styles.headerSubtitle,
      color: isDarkMode ? '#d1d5db' : '#6b7280',
    },
    greetingText: {
      ...styles.greetingText,
      color: isDarkMode ? '#fbbf24' : '#059669',
    },
    searchInput: {
      ...styles.searchInput,
      backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
      color: isDarkMode ? '#f9fafb' : '#111827',
      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
    },
    card: {
      ...styles.card,
      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
      borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
    },
    memberName: {
      ...styles.memberName,
      color: isDarkMode ? '#f9fafb' : '#111827',
    },
    memberAge: {
      ...styles.memberAge,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    },
    memberOccupation: {
      ...styles.memberOccupation,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    },
    memberAddress: {
      ...styles.memberAddress,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    },
    modalContainer: {
      ...styles.modalContainer,
      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
    },
    modalTitle: {
      ...styles.modalTitle,
      color: isDarkMode ? '#f9fafb' : '#111827',
    },
    detailCard: {
      ...styles.detailCard,
      backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb',
    },
    detailLabel: {
      ...styles.detailLabel,
      color: isDarkMode ? '#d1d5db' : '#6b7280',
    },
    detailValue: {
      ...styles.detailValue,
      color: isDarkMode ? '#f9fafb' : '#111827',
    },
    imageModalBackground: {
      ...styles.imageModalBackground,
      backgroundColor: '#000000',
    },
    imageModalHeader: {
      ...styles.imageModalHeader,
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
    imageModalName: {
      ...styles.imageModalName,
      color: '#ffffff',
    },
  });

  // 🔽 Helper to get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // 🔽 Get image source with cache
  const getImageSource = (member: FamilyMember) => {
    if (!member.image) return null;
    
    if (typeof member.image === 'object') {
      return member.image;
    }

    const cachedUrl = imageUrlCache.get(member.image);
    if (cachedUrl) {
      return { uri: cachedUrl };
    }

    return null;
  };

  if (loadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialIcons name="family-restroom" size={64} color="#2563eb" />
        </Animated.View>
        <Text style={{ marginTop: 16, fontSize: 18, color: '#4b5563' }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  const themedStyles = getThemedStyles();
  const allMembers = familyTrees.flatMap((tree) => flattenTree(tree));
  const filteredFamilies = searchQuery
    ? allMembers.filter((member) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : familyTrees;

  const isSearching = searchQuery.length > 0;
  const showDetailModal = memberStack.length > 0;
  const currentMember = memberStack[memberStack.length - 1];

  const pushMember = async (member: FamilyMember) => {
    const memberWithImage = await loadImageForMember(member);
    setMemberStack((prev) => [...prev, memberWithImage]);
  };

  const popMember = () => {
    setMemberStack((prev) => prev.slice(0, -1));
  };

  return (
    <SafeAreaView style={themedStyles.container}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Header */}
      <Animated.View
        style={[
          themedStyles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.greetingRow}>
          <Text style={themedStyles.greetingText}>{greetingMessage}</Text>
          <TouchableOpacity onPress={showMemberStats} style={styles.statsButton}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <MaterialIcons
                name="bar-chart"
                size={24}
                color={isDarkMode ? '#fbbf24' : '#059669'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRow}>
          <Text style={themedStyles.headerTitle}>Family Tree</Text>
          <TouchableOpacity
            onPress={toggleDarkMode}
            style={[
              styles.toggleContainer,
              {
                backgroundColor: isDarkMode ? '#374151' : '#f1f5f9',
              },
            ]}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={20}
              color={isDarkMode ? '#fbbf24' : '#374151'}
            />
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              thumbColor={isDarkMode ? '#fbbf24' : '#ffffff'}
              trackColor={{ false: '#d1d5db', true: '#374151' }}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <Text style={themedStyles.headerSubtitle}>
            {filteredFamilies.length} {isSearching ? 'members' : 'families'} • {favorites.size} favorites
          </Text>
          {favorites.size > 0 && (
            <View style={styles.favoritesBadge}>
              <FontAwesome name="heart" size={12} color="#ffffff" />
              <Text style={styles.favoritesText}>{favorites.size}</Text>
            </View>
          )}
        </View>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Feather
            name="search"
            size={20}
            color={isDarkMode ? '#9ca3af' : '#6b7280'}
            style={styles.searchIcon}
          />
          <TextInput
            style={themedStyles.searchInput}
            placeholder="Search anyone in the family..."
            placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Text style={{ fontSize: 20, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                ×
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Family List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredFamilies.length > 0 ? (
          filteredFamilies.map((member) => {
            const imageSource = getImageSource(member);
            return (
              <TouchableOpacity
                key={member.id}
                style={[
                  themedStyles.card,
                  favorites.has(member.id) && styles.favoriteCard,
                ]}
                onPress={() => pushMember(member)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <TouchableOpacity
                    onPress={() => openImageModal(member)}
                  >
                    {imageSource ? (
                      <Image
                        source={imageSource}
                        style={[styles.cardImage, favorites.has(member.id) && styles.favoriteImage]}
                      />
                    ) : (
                      <View style={[styles.cardImage, styles.placeholderImage]}>
                        <MaterialIcons name="person" size={24} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      </View>
                    )}
                    {favorites.has(member.id) && (
                      <View style={styles.favoriteOverlay}>
                        <FontAwesome name="heart" size={16} color="#ff6b6b" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                      <Text style={themedStyles.memberName} numberOfLines={1} ellipsizeMode="tail">
                        {member.name}
                        {member.status === 'Deceased' && ' (Deceased)'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(member.id)}
                        style={styles.favoriteButton}
                      >
                        <FontAwesome
                          name={favorites.has(member.id) ? 'heart' : 'heart-o'}
                          size={20}
                          color="#ff6b6b"
                        />
                      </TouchableOpacity>
                    </View>
                    {member.occupation && (
                      <Text style={themedStyles.memberOccupation}>{member.occupation}</Text>
                    )}
                    {member.address && (
                      <Text style={themedStyles.memberAddress} numberOfLines={1}>
                        {member.address}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Animated.View style={[styles.noResults, { opacity: fadeAnim }]}>
            <Feather name="search" size={48} color={isDarkMode ? '#4b5563' : '#d1d5db'} />
            <Text style={{ fontSize: 16, color: isDarkMode ? '#d1d5db' : '#6b7280', marginTop: 16 }}>
              No results found
            </Text>
            <Text style={{ color: isDarkMode ? '#9ca3af' : '#9ca3af', fontSize: 14, marginTop: 8 }}>
              Try another name
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={themedStyles.modalContainer}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb' },
            ]}
          >
            <TouchableOpacity onPress={popMember}>
              <Text style={styles.closeButton}>Back</Text>
            </TouchableOpacity>
            <Text style={themedStyles.modalTitle}>Profile</Text>
            <TouchableOpacity
              onPress={() => currentMember && shareProfile(currentMember)}
              style={styles.shareButton}
            >
              <Feather name="share" size={24} color="#2563eb" />
            </TouchableOpacity>
          </View>
          {currentMember && (
            <ScrollView style={styles.modalContent}>
              {/* Profile */}
              <View style={styles.profileImageContainer}>
                <TouchableOpacity
                  onPress={() => openImageModal(currentMember)}
                >
                  {currentMember.image && typeof currentMember.image === 'object' ? (
                    <Image
                      source={currentMember.image}
                      style={[
                        styles.profileImage,
                        favorites.has(currentMember.id) && styles.favoriteProfileImage,
                      ]}
                    />
                  ) : (
                    <View style={[styles.profileImage, styles.placeholderProfileImage]}>
                      <MaterialIcons name="person" size={32} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                    </View>
                  )}
                  {favorites.has(currentMember.id) && (
                    <View style={styles.favoriteProfileOverlay}>
                      <FontAwesome name="heart" size={24} color="#ff6b6b" />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.profileNameRow}>
                  <Text style={[themedStyles.memberName, { fontSize: 24, fontWeight: '700' }]}>
                    {currentMember.name}
                    {currentMember.status === 'Deceased' && ' (Deceased)'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(currentMember.id)}
                    style={styles.profileFavoriteButton}
                  >
                    <FontAwesome
                      name={favorites.has(currentMember.id) ? 'heart' : 'heart-o'}
                      size={28}
                      color="#ff6b6b"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
                {currentMember.status !== 'Deceased' && currentMember.phone && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                    onPress={() => makeCall(currentMember.phone)}
                  >
                    <Feather name="phone" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
                {currentMember.status !== 'Deceased' && currentMember.phone && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                    onPress={() => sendSMS(currentMember.phone)}
                  >
                    <Feather name="message" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Message</Text>
                  </TouchableOpacity>
                )}
                {currentMember.email && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#8b5cf6' }]}
                    onPress={() => sendEmail(currentMember.email)}
                  >
                    <Feather name="mail" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Email</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Details */}
              <View style={styles.detailsContainer}>
                {currentMember.status === 'Deceased' && (
                  <View style={[themedStyles.detailCard, { backgroundColor: '#fee2e2' }]}>
                    <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Status: Deceased</Text>
                  </View>
                )}
                {currentMember.occupation && (
                  <View style={themedStyles.detailCard}>
                    <Text style={themedStyles.detailLabel}>OCCUPATION</Text>
                    <Text style={themedStyles.detailValue}>{currentMember.occupation}</Text>
                  </View>
                )}
                {currentMember.address && (
                  <View style={themedStyles.detailCard}>
                    <Text style={themedStyles.detailLabel}>ADDRESS</Text>
                    <Text style={themedStyles.detailValue}>{currentMember.address}</Text>
                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.blueButton]}
                        onPress={() => openInMaps(currentMember.address)}
                      >
                        <Feather name="map-pin" size={16} color="white" style={{ marginRight: 4 }} />
                        <Text style={styles.buttonText}>Open in Maps</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {currentMember.phone && (
                  <View style={themedStyles.detailCard}>
                    <Text style={themedStyles.detailLabel}>PHONE</Text>
                    <Text style={themedStyles.detailValue}>{currentMember.phone}</Text>
                  </View>
                )}

                {/* SPOUSE */}
{/* SPOUSE */}
{currentMember.spouseObj && (
  <View style={themedStyles.detailCard}>
    <Text style={themedStyles.detailLabel}>SPOUSE</Text>
    <TouchableOpacity
      style={styles.childRow}
      onPress={() => pushMember(currentMember.spouseObj!)}
    >
      { (() => {
          const spouseImageSource = getImageSource(currentMember.spouseObj!);
          return spouseImageSource ? (
            <Image source={spouseImageSource} style={styles.childImage} />
          ) : (
            <View style={[styles.childImage, styles.placeholderChildImage]}>
              <MaterialIcons name="person" size={16} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            </View>
          );
        })()
      }
      <View style={styles.childInfo}>
        <Text style={themedStyles.memberName}>
          {currentMember.spouseObj.name}
        </Text>
        {currentMember.spouseObj.occupation && (
          <Text style={themedStyles.memberOccupation}>
            {currentMember.spouseObj.occupation}
          </Text>
        )}
        {currentMember.spouseObj.address && (
          <Text style={themedStyles.memberAddress} numberOfLines={1}>
            {currentMember.spouseObj.address}
          </Text>
        )}
      </View>
      <Feather
        name="chevron-right"
        size={18}
        color={isDarkMode ? '#d1d5db' : '#6b7280'}
      />
    </TouchableOpacity>
  </View>
)}


                {/* CHILDREN */}
                {currentMember.children && currentMember.children.length > 0 && (
                  <View style={themedStyles.detailCard}>
                    <Text style={themedStyles.detailLabel}>CHILDREN</Text>
                    {currentMember.children.map((child) => {
                      const childImageSource = getImageSource(child);
                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={styles.childRow}
                          onPress={() => pushMember(child)}
                        >
                          {childImageSource ? (
                            <Image source={childImageSource} style={styles.childImage} />
                          ) : (
                            <View style={[styles.childImage, styles.placeholderChildImage]}>
                              <MaterialIcons name="person" size={16} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                            </View>
                          )}
                          <View style={styles.childInfo}>
                            <Text style={themedStyles.memberName}>{child.name}</Text>
                            {child.occupation && (
                              <Text style={themedStyles.memberOccupation}>{child.occupation}</Text>
                            )}
                          </View>
                          <Feather name="chevron-right" size={18} color={isDarkMode ? '#d1d5db' : '#6b7280'} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal && selectedImage !== null}
        animationType="fade"
        transparent
        onRequestClose={closeImageModal}
      >
        <View style={themedStyles.imageModalBackground}>
          <StatusBar style="light" />
          <SafeAreaView style={themedStyles.imageModalHeader}>
            <View style={styles.imageModalHeaderContent}>
              <Text style={themedStyles.imageModalName}>{selectedImageName}</Text>
              <View style={styles.imageModalActions}>
                <TouchableOpacity
                  style={styles.imageModalActionButton}
                  onPress={() => currentMember && shareProfile(currentMember)}
                >
                  <Feather name="share" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imageModalCloseButton}
                  onPress={closeImageModal}
                >
                  <Ionicons name="close" size={28} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.imageModalImageContainer}>
            <TouchableOpacity
              style={styles.imageModalImageTouchable}
              activeOpacity={1}
              onPress={closeImageModal}
            >
              {selectedImage && (
  <Animated.Image
    source={{ uri: selectedImage.uri }}
    style={[
      styles.imageModalImage,
      { transform: [{ scale: imageScaleAnim }] },
    ]}
    resizeMode="contain"
  />
)}

            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fallback modal for placeholder click */}
      <Modal
        visible={showImageModal && selectedImage === null}
        animationType="fade"
        transparent
        onRequestClose={closeImageModal}
      >
        <View style={[styles.imageModalBackground, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.profileImage, styles.placeholderProfileImage, { marginBottom: 20 }]}>
            <MaterialIcons name="person" size={32} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
          </View>
          <Text style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
            No photo available
          </Text>
          <TouchableOpacity onPress={closeImageModal} style={{ padding: 12, backgroundColor: '#374151', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ✅ Updated Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  greetingText: { fontSize: 16, fontWeight: '600', color: '#059669' },
  statsButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.1)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  favoritesBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff6b6b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  favoritesText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, gap: 6 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  searchIcon: { position: 'absolute', left: 16, zIndex: 1 },
  searchInput: { backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 48, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#d1d5db', flex: 1 },
  clearButton: { position: 'absolute', right: 16, zIndex: 1, padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 16, borderRadius: 16, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  favoriteCard: { borderColor: '#ff6b6b', borderWidth: 2, backgroundColor: 'rgba(255, 107, 107, 0.05)' },
  cardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardImage: { width: 60, height: 60, borderRadius: 30, marginRight: 16 },
  placeholderImage: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  favoriteImage: { borderWidth: 2, borderColor: '#ff6b6b' },
  favoriteOverlay: { position: 'absolute', top: -4, right: 12, backgroundColor: '#ffffff', borderRadius: 12, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  memberInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberName: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  memberAge: { fontSize: 14, marginTop: 2 },
  memberOccupation: { fontSize: 14, marginTop: 2 },
  memberAddress: { fontSize: 12, marginTop: 4 },
  favoriteButton: { padding: 4 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  closeButton: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  shareButton: { padding: 4 },
  modalContent: { flex: 1, padding: 16 },
  profileImageContainer: { alignItems: 'center', marginBottom: 24 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#2563eb' },
  placeholderProfileImage: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2563eb',
    borderRadius: 60,
  },
  favoriteProfileImage: { borderColor: '#ff6b6b', borderWidth: 4 },
  favoriteProfileOverlay: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ffffff', borderRadius: 20, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileFavoriteButton: { padding: 8 },
  actionsContainer: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 4 },
  actionButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  detailsContainer: { gap: 14 },
  detailCard: { padding: 16, borderRadius: 12 },
  detailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  detailValue: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  blueButton: { backgroundColor: '#2563eb' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  imageModalBackground: { flex: 1, backgroundColor: '#000000' },
  imageModalHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.7)', paddingBottom: 10 },
  imageModalHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  imageModalName: { fontSize: 18, fontWeight: '600', color: '#ffffff', flex: 1, marginRight: 16 },
  imageModalActions: { flexDirection: 'row', gap: 12 },
  imageModalActionButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  imageModalCloseButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  imageModalImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageModalImageTouchable: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  imageModalImage: {
  width: '100%',
  height: '100%',
},
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, backgroundColor: 'rgba(37, 99, 235, 0.05)', borderRadius: 12, marginTop: 8 },
  childImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  placeholderChildImage: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  childInfo: { flex: 1 },
});