import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from "./storage/resource";

// defineBackend({を以下のように書き換えます
export const backend = defineBackend({  
  auth,
  data,
  storage,
});

// Cognito設定のカスタマイズ
// ユーザー名でのサインインを有効にします
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.usernameAttributes = [];
