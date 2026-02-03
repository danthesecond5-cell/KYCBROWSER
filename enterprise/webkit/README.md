 # Custom WebKit Framework Placement
 
 Place your custom WebKit framework here:
 
 ```
 enterprise/webkit/CustomWebKit.framework
 ```
 
 The `withEnterpriseWebKit` config plugin will copy it into:
 
 ```
 ios/Frameworks/CustomWebKit.framework
 ```
 
 and embed it in the Xcode project when you run:
 
 ```
 npx expo prebuild --clean --platform ios
 ```
 
 If your framework binary has a different name, update:
 - `app.json` → `RNCEnterpriseWebKitFrameworkPath`
 - `app.json` → plugin `frameworkPath`
