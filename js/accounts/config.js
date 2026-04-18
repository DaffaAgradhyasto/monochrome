import { Client, Account } from 'appwrite';

const getEndpoint = () => {
  const local = localStorage.getItem('monochrome-appwrite-endpoint');
  if (local) return local;

  if (window.__APPWRITE_ENDPOINT__) return window.__APPWRITE_ENDPOINT__;

  // Fallback ke Appwrite Cloud milikmu sendiri
  return 'https://cloud.appwrite.io/v1';
};

const getProject = () => {
  const local = localStorage.getItem('monochrome-appwrite-project');
  if (local) return local;

  if (window.__APPWRITE_PROJECT_ID__) return window.__APPWRITE_PROJECT_ID__;

  // Ganti dengan Project ID milikmu dari Appwrite Console
  return '69ba589c0035145a5327';
};

const client = new Client().setEndpoint(getEndpoint()).setProject(getProject());
const account = new Account(client);
export { client, account as auth };
