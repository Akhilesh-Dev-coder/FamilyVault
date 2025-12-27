import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Modal,
    Image,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Platform,
    Alert,
    Dimensions,
    ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

type Program = {
    id: string;
    title: string;
    type: string;
    date: string;
    time: string;
    location: string;
    description: string;
    imageUrl?: string;
    status: 'Upcoming' | 'Completed' | 'Cancelled';
    visibility: boolean;
};

export default function ProgramsScreen({ onClose }: { onClose: () => void }) {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

    const fetchPrograms = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'programs'));
            const data = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Program))
                .filter(p => p.visibility === true);

            // Sort: Upcoming (nearest date) first
            data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setPrograms(data);
        } catch (error) {
            console.error("Error fetching programs:", error);
            // Silent fail for UI UX, or show toast
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrograms();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPrograms();
        setRefreshing(false);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Wedding': return ['#ec4899', '#db2777']; // Pink
            case 'Birthday': return ['#8b5cf6', '#7c3aed']; // Violet
            case 'Anniversary': return ['#f59e0b', '#d97706']; // Amber
            case 'Get Together': return ['#10b981', '#059669']; // Emerald
            case 'Meeting': return ['#3b82f6', '#2563eb']; // Blue
            default: return ['#6b7280', '#4b5563']; // Gray
        }
    };

    const formatDateMonth = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('default', { month: 'short' }).toUpperCase();
    };

    const formatDateDay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.getDate();
    };

    const openLocation = (location: string) => {
        if (!location) return;
        const isUrl = location.startsWith('http');
        if (isUrl) {
            Linking.openURL(location);
        } else {
            const query = encodeURIComponent(location);
            const url = Platform.select({
                ios: `http://maps.apple.com/?q=${query}`,
                android: `https://www.google.com/maps/search/?api=1&query=${query}`,
                default: `https://www.google.com/maps/search/?api=1&query=${query}`,
            });
            if (url) Linking.openURL(url);
        }
    };

    const formatTime12Hour = (time24: string) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        return `${h}:${minutes} ${ampm}`;
    };

    const renderItem = ({ item }: { item: Program }) => {
        const gradientColors = getTypeColor(item.type);
        const hasImage = !!item.imageUrl;

        return (
            <TouchableOpacity
                onPress={() => setSelectedProgram(item)}
                activeOpacity={0.9}
                style={styles.cardContainer}
            >
                <View style={styles.cardShadow}>
                    <View style={styles.cardMain}>
                        {/* Image Logic */}
                        {hasImage ? (
                            <ImageBackground
                                source={{ uri: item.imageUrl }}
                                style={styles.cardImageBg}
                                imageStyle={{ borderRadius: 16 }}
                            >
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                                    style={styles.cardGradientOverlay}
                                />
                                <View style={styles.cardContentOverlay}>
                                    <View style={styles.badgeContainer}>
                                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'Cancelled' ? '#ef4444' : item.status === 'Completed' ? '#10b981' : '#3b82f6' }]}>
                                            <Text style={styles.statusText}>{item.status}</Text>
                                        </View>
                                    </View>
                                    <View>
                                        <Text style={styles.overlayType}>{item.type}</Text>
                                        <Text style={styles.overlayTitle}>{item.title}</Text>
                                        <View style={styles.overlayMetaRow}>
                                            <Feather name="calendar" size={14} color="#e5e7eb" />
                                            <Text style={styles.overlayMetaText}>{item.date} • {formatTime12Hour(item.time)}</Text>
                                        </View>
                                        <View style={styles.overlayMetaRow}>
                                            <Feather name="map-pin" size={14} color="#e5e7eb" />
                                            <Text style={styles.overlayMetaText} numberOfLines={1}>{item.location}</Text>
                                        </View>
                                    </View>
                                </View>
                            </ImageBackground>
                        ) : (
                            <LinearGradient
                                colors={gradientColors as any}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.cardNoImage}
                            >
                                <View style={styles.cardContentOverlay}>
                                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Text style={styles.statusText}>{item.status}</Text>
                                    </View>
                                    <View style={{ marginTop: 'auto' }}>
                                        <Text style={styles.overlayType}>{item.type}</Text>
                                        <Text style={styles.overlayTitle}>{item.title}</Text>
                                        <View style={styles.overlayMetaRow}>
                                            <Feather name="calendar" size={14} color="#e5e7eb" />
                                            <Text style={styles.overlayMetaText}>{item.date} • {formatTime12Hour(item.time)}</Text>
                                        </View>
                                    </View>
                                </View>
                                <Feather name="calendar" size={120} color="rgba(255,255,255,0.1)" style={styles.watermarkIcon} />
                            </LinearGradient>
                        )}
                    </View>

                    {/* Date Leaf (Floating) */}
                    <View style={styles.dateLeaf}>
                        <Text style={styles.dateMonth}>{formatDateMonth(item.date)}</Text>
                        <Text style={styles.dateDay}>{formatDateDay(item.date)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <LinearGradient
                colors={['#f3f4f6', '#e5e7eb']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Moments & Events</Text>
                <View style={styles.headerBtnPlaceholder} />
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : programs.length === 0 ? (
                <View style={styles.center}>
                    <View style={styles.emptyIconCircle}>
                        <Feather name="wind" size={64} color="#9ca3af" />
                    </View>
                    <Text style={styles.emptyTitle}>It's quiet here</Text>
                    <Text style={styles.emptySubtitle}>No upcoming family moments yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={programs}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

            {/* Premium Detail Modal */}
            <Modal
                visible={!!selectedProgram}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedProgram(null)}
            >
                <View style={styles.modalContainer}>
                    {selectedProgram && (
                        <>
                            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
                                {/* Parallax Header Image */}
                                <View style={styles.modalImageContainer}>
                                    {selectedProgram.imageUrl ? (
                                        <Image source={{ uri: selectedProgram.imageUrl }} style={styles.modalImage} resizeMode="cover" />
                                    ) : (
                                        <LinearGradient
                                            colors={getTypeColor(selectedProgram.type) as any}
                                            style={styles.modalImage}
                                        >
                                            <Feather name="image" size={64} color="rgba(255,255,255,0.3)" />
                                        </LinearGradient>
                                    )}
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                                        style={styles.modalGradient}
                                    />
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setSelectedProgram(null)}
                                    >
                                        <Ionicons name="close" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalBody}>
                                    <View style={styles.modalTitleRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalType}>{selectedProgram.type}</Text>
                                            <Text style={styles.modalTitle}>{selectedProgram.title}</Text>
                                        </View>
                                        <View style={styles.modalDateBox}>
                                            <Text style={styles.modalDateMonth}>{formatDateMonth(selectedProgram.date)}</Text>
                                            <Text style={styles.modalDateDay}>{formatDateDay(selectedProgram.date)}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.infoGrid}>
                                        <View style={styles.infoItem}>
                                            <View style={styles.infoIconBg}>
                                                <Feather name="clock" size={20} color="#3b82f6" />
                                            </View>
                                            <View>
                                                <Text style={styles.infoLabel}>TIME</Text>
                                                <Text style={styles.infoText}>{formatTime12Hour(selectedProgram.time)}</Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.infoItem}
                                            onPress={() => openLocation(selectedProgram.location)}
                                        >
                                            <View style={[styles.infoIconBg, { backgroundColor: '#eff6ff' }]}>
                                                <Feather name="map-pin" size={20} color="#ef4444" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.infoLabel}>LOCATION</Text>
                                                <Text style={[styles.infoText, { color: '#2563eb', textDecorationLine: 'underline' }]}>
                                                    {selectedProgram.location}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.descSection}>
                                        <Text style={styles.descHeader}>About</Text>
                                        <Text style={styles.descText}>{selectedProgram.description || "No specific details provided for this event."}</Text>
                                    </View>
                                </View>
                            </ScrollView>
                        </>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'transparent',
    },
    headerBtn: {
        padding: 8,
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    headerBtnPlaceholder: {
        width: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.5,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
    },
    cardContainer: {
        marginBottom: 24,
    },
    cardShadow: {
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
        backgroundColor: 'white',
    },
    cardMain: {
        height: 220,
        borderRadius: 24,
        overflow: 'hidden',
    },
    cardImageBg: {
        width: '100%',
        height: '100%',
    },
    cardNoImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardGradientOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    cardContentOverlay: {
        flex: 1,
        padding: 20,
        justifyContent: 'space-between',
    },
    badgeContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    overlayType: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    overlayTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 12,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    overlayMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    overlayMetaText: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '500',
    },
    watermarkIcon: {
        position: 'absolute',
        right: -20,
        bottom: -20,
        transform: [{ rotate: '-15deg' }],
    },
    dateLeaf: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 6,
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '800',
        color: '#ef4444',
        textTransform: 'uppercase',
    },
    dateDay: {
        fontSize: 22,
        fontWeight: '900',
        color: '#111827',
        lineHeight: 26,
    },

    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    modalImageContainer: {
        height: 300,
        width: '100%',
        position: 'relative',
    },
    modalImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    modalCloseBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 44 : 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        padding: 8,
    },
    modalBody: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -32,
        paddingTop: 32,
        paddingHorizontal: 24,
    },
    modalTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    modalType: {
        fontSize: 14,
        color: '#3b82f6',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1f2937',
        lineHeight: 34,
    },
    modalDateBox: {
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        marginLeft: 16,
    },
    modalDateMonth: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    modalDateDay: {
        fontSize: 24,
        fontWeight: '900',
        color: '#111827',
    },
    divider: {
        height: 1,
        backgroundColor: '#f3f4f6',
        marginVertical: 24,
    },
    infoGrid: {
        gap: 20,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    infoIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '700',
        marginBottom: 2,
    },
    infoText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '600',
    },
    descSection: {
        marginBottom: 40,
    },
    descHeader: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 12,
    },
    descText: {
        fontSize: 16,
        color: '#4b5563',
        lineHeight: 26,
    },
});
