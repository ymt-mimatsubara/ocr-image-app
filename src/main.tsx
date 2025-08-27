import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
// ここにエラーが出ますが、SandBoxを起動すると消えます。
import outputs from "../amplify_outputs.json";

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

// 日本語の翻訳を設定
import { I18n } from "@aws-amplify/core";
import { translations } from "@aws-amplify/ui-react";

I18n.putVocabularies(translations);
I18n.setLanguage("ja");

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator>
      <App />
    </Authenticator>
  </React.StrictMode>
);