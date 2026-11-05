import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
 appId: 'com.puttputtpotty.game.preview', appName: 'Putt Putt Potty Preview', webDir: 'dist',
 ios: { contentInset: 'never', backgroundColor: '#06293e' },
 plugins: { PushNotifications: { presentationOptions: ['badge', 'sound'] } }
};
export default config;
