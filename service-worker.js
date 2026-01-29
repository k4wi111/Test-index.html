
const CACHE_NAME='iosano-v3-FIX2';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{self.clients.claim()});
