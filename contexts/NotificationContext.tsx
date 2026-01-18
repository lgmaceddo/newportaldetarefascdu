import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface NotificationContextType {
    playNotificationSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Create audio element
        const audio = new Audio();
        // Tiny beep sound to avoid massive base64
        audio.src = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YV92T19v';
        // Note: The above is a placeholder, a real short beep would be better.
        // For now, let's use a standard public sound or just a functional skeleton.
        audio.src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
        audioRef.current = audio;
    }, []);

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(err => console.log('Audio play blocked:', err));
        }
    };

    return (
        <NotificationContext.Provider value={{ playNotificationSound }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};