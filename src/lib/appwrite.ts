import { Client, Account, Databases } from 'appwrite';

export const client = new Client();

// Initialize with env vars or defaults
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);

// Helper for deep linking URL
export const OAUTH_SUCCESS_URL = 'clipme://auth/callback';
export const OAUTH_FAILURE_URL = 'clipme://auth/failure';
