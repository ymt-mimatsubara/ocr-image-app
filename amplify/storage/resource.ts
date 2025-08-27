// amplify/storage/resource.ts
import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "ocrStorage",
  access: (allow) => ({
    // ログインしたユーザーのみ読み書き、削除可能
    'media/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});