import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "Capture": "Capture",
      "Details": "Details",
      "Send": "Send",
      "Report a child in need": "Report a child in need",
      "Flag as Immediate Physical Danger": "Flag as Immediate Physical Danger",
      "I consent to sharing this location": "I consent to sharing this location and encrypted image securely with the authorities for child rescue operations. I understand I am remaining anonymous.",
      "ENCRYPT & SEND": "ENCRYPT & SEND",
      "RETAKE": "RETAKE"
    }
  },
  hi: {
    translation: {
      "Capture": "कैप्चर करें",
      "Details": "विवरण",
      "Send": "भेजें",
      "Report a child in need": "जरूरतमंद बच्चे की रिपोर्ट करें",
      "Flag as Immediate Physical Danger": "तत्काल शारीरिक खतरे के रूप में चिह्नित करें",
      "I consent to sharing this location": "मैं बाल बचाव कार्यों के लिए अधिकारियों के साथ इस स्थान और एन्क्रिप्टेड छवि को सुरक्षित रूप से साझा करने की सहमति देता हूं। मैं समझता हूं कि मैं गुमनाम रह रहा हूं।",
      "ENCRYPT & SEND": "एन्क्रिप्ट करें और भेजें",
      "RETAKE": "फिर से लें"
    }
  },
  mr: {
    translation: {
      "Capture": "कॅप्चर करा",
      "Details": "तपशील",
      "Send": "पाठवा",
      "Report a child in need": "गरजू मुलाची तक्रार करा",
      "Flag as Immediate Physical Danger": "तात्काळ शारीरिक धोका म्हणून चिन्हांकित करा",
      "I consent to sharing this location": "मी बाल बचाव कार्यासाठी अधिकाऱ्यांसोबत हे स्थान आणि एन्क्रिप्टेड प्रतिमा सुरक्षितपणे सामायिक करण्यास संमती देतो. मला समजते की मी निनावी राहत आहे.",
      "ENCRYPT & SEND": "एनक्रिप्ट करा आणि पाठवा",
      "RETAKE": "पुन्हा घ्या"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

export default i18n;
