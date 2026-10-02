# Setup Later (Secrets and Configs)

| Variable Name | Where to get it | Feature enabled | What happens without it |
|---------------|-----------------|-----------------|-------------------------|
| `JWT_SECRET` | Generate a strong random string (e.g. `openssl rand -base64 32`) | Secure auth tokens | Backend fails to start in production |
| `ALLOWED_DOMAINS` | The domains where the app is hosted (comma separated) | CORS security | Backend fails to start in production |
| `FCM_SERVER_KEY` | Firebase Console -> Project Settings -> Cloud Messaging | Push notifications | Uses mock console logger |
| `TWILIO_ACCOUNT_SID` | Twilio Console | SMS notifications | Uses mock console logger |
| `TWILIO_AUTH_TOKEN` | Twilio Console | SMS notifications | Uses mock console logger |
| `GUPSHUP_API_KEY` | Gupshup Dashboard | WhatsApp notifications | Uses mock console logger |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console | Geocoding/Maps | Uses mock/fallback map tiles or fails gracefully |
