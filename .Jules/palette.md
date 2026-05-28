## 2025-05-14 - [PWA Offline Storage & Routing]
**Learning:** For PWAs that handle media (like compressed images), IndexedDB is mandatory over localStorage due to the 5MB limit. Hash-based routing provides the best "app-like" experience with back-button support in static-hosted PWAs without complex server configuration.
**Action:** Use IndexedDB for transaction queues and hash-routing for multi-view PWAs to ensure reliability and intuitive navigation.
