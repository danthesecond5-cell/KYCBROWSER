import 'react-native-webview';

declare module 'react-native-webview' {
  interface WebViewProps {
    enterpriseWebKitEnabled?: boolean;
  }
}
