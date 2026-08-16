import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';
import {initReactI18next} from 'react-i18next';

export const i18n = i18next.createInstance();

export const i18nReady = i18n
	.use(HttpBackend)
	.use(initReactI18next)
	.init({
		debug: process.env.NODE_ENV === 'development',
		backend: {
			loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}.json`,
			maxRetries: 1
		},
		fallbackLng: 'zh-cn',
		lng: 'zh-cn',
		interpolation: {
			escapeValue: false
		},
		load: 'currentOnly'
	});
