import {Tabs} from 'expo-router';
import React from 'react';
import {Platform} from 'react-native';
import {BleProvider} from '@/components/BleContext';

import {HapticTab} from '@/components/HapticTab';
import {IconSymbol} from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import {Colors} from '@/constants/Colors';
import {useColorScheme} from '@/hooks/useColorScheme';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <BleProvider>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                    headerShown: false,
                    tabBarButton: HapticTab,
                    tabBarBackground: TabBarBackground,
                    tabBarStyle: Platform.select({
                        ios: {
                            // Use a transparent background on iOS to show the blur effect
                            position: 'absolute',
                        },
                        default: {},
                    }),
                }}

            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Scan',
                        tabBarIcon: ({color}) => <IconSymbol size={28} name="house.fill" color={color}/>,
                    }}
                />
                <Tabs.Screen
                    name="ride"
                    options={{
                        title: 'Ride',
                        tabBarIcon: ({color}) => <IconSymbol size={28} name="paperplane.fill" color={color}/>,
                    }}
                />
                <Tabs.Screen
                    name="controller"
                    options={{
                        title: 'Controller',
                        tabBarIcon: ({color}) => <IconSymbol size={28} name="gamecontroller" color={color}/>,
                    }}
                />
            </Tabs>
        </BleProvider>
    );
}
