import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.projecthellhound.habitos',
  appName: 'CONSTANT',
  webDir: 'dist',
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#2f6b3f' },
  },
};

export default config;
