// Legacy compatibility - re-export from Appwrite sync
import { syncManager } from './appwrite-sync.js';

// Export syncManager for backward compatibility
export { syncManager };

// Export pb (PocketBase compat object) for files that still use pb.collection(...)
export const pb = syncManager.pb;
