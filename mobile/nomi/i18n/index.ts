import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import pt from '../locales/pt.json';

const LANGUAGE_KEY = 'nomi_language';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
};

// Initialize i18n with saved language or device locale
export async function initI18n(): Promise<void> {
  let language = 'en'; // default

  try {
    // Try to get saved language from AsyncStorage
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (savedLanguage) {
      language = savedLanguage;
    } else {
      // Fall back to device locale
      const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
      // Map Portuguese locales (pt, pt-BR, pt-PT, etc.) to 'pt'
      language = deviceLocale.startsWith('pt') ? 'pt' : 'en';
    }
  } catch (error) {
    console.warn('Failed to load language preference:', error);
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already escapes values
      },
      compatibilityJSON: 'v4', // Use i18next v4 JSON format
    });
}

// Change language and persist to AsyncStorage
export async function changeLanguage(language: string): Promise<void> {
  try {
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    console.error('Failed to change language:', error);
  }
}

export default i18n;
