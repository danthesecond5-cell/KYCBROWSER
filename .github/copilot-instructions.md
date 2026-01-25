# Copilot Instructions for Rork Mobile App

## Project Overview

This is a native cross-platform mobile application created with [Rork](https://rork.com). The app is built using React Native and Expo Router, supporting iOS, Android, and web platforms. It follows modern mobile development practices and uses file-based routing with Expo Router.

**Key Features:**
- Cross-platform compatibility (iOS, Android, Web)
- File-based routing with Expo Router
- TypeScript for type safety
- Context-based state management
- React Query for server state management
- Device template and video library functionality

## Tech Stack

### Core Framework
- **React Native 0.81.5** - Cross-platform mobile development
- **Expo ~54.0.27** - React Native framework extension
- **Expo Router ~6.0.17** - File-based routing system
- **React 19.2.3** - UI library
- **TypeScript ~5.9.2** - Type-safe JavaScript

### State Management
- **React Query (@tanstack/react-query)** - Server state management
- **Zustand** - Lightweight state management
- **React Context** - Application-wide state (DeviceTemplate, VideoLibrary, DeveloperMode, Protocol)

### UI & Styling
- **Lucide React Native** - Icon library
- **expo-linear-gradient** - Gradient components
- **react-native-gesture-handler** - Touch gesture handling
- **react-native-safe-area-context** - Safe area support

### Development Tools
- **Bun** - Package manager and runtime
- **ESLint** - Code linting with expo config
- **Jest** - Testing framework (via react-native preset)
- **@testing-library/react-native** - Component testing utilities
- **react-test-renderer** - React component testing

## Coding Guidelines

### TypeScript
- **Always use TypeScript** for all new files (`.tsx` for components, `.ts` for utilities)
- **Enable strict mode** - `tsconfig.json` has `"strict": true`
- Use type annotations for function parameters and return types
- Prefer interfaces over types for object shapes
- Use the `@/*` path alias for imports (e.g., `@/components/Button`)

### Code Style
- Use **double quotes** for strings in JSX/TSX
- Use **camelCase** for variables and functions
- Use **PascalCase** for React components and TypeScript interfaces/types
- Use **async/await** instead of promises chains
- Follow ESLint rules defined in `eslint.config.js` (expo config)

### React & React Native Patterns
- Use **functional components** with hooks (no class components)
- Prefer **named exports** for components
- Use **React Context** for cross-component state (see existing contexts in `contexts/`)
- Implement proper **error boundaries** for error handling
- Use **SafeAreaView** or safe area context for proper spacing on notched devices
- Follow Expo Router conventions for file-based routing

### File Naming
- Components: `PascalCase.tsx` (e.g., `ErrorBoundary.tsx`)
- Utilities: `camelCase.ts` (e.g., `logger.ts`)
- Test files: `ComponentName.test.tsx` (e.g., `TestingWatermark.test.tsx`)
- Contexts: `PascalCaseContext.tsx` (e.g., `DeviceTemplateContext.tsx`)

### Import Organization
1. External dependencies (React, React Native, third-party)
2. Expo imports
3. Internal imports using `@/` alias
4. Relative imports
5. Type imports (use `import type` when importing only types)

Example:
```typescript
import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { DeviceTemplateProvider } from "@/contexts/DeviceTemplateContext";
import type { FreezeInfo } from "@/utils/logger";
```

### Testing
- Use **Jest** (via react-native preset) for unit and integration tests
- Use **@testing-library/react-native** for component testing
- Place tests in `__tests__` directory
- Name test files with `.test.tsx` suffix
- Write tests that are independent and can run in any order
- Run tests with `bunx jest` (no npm test script is configured)

## Repository Structure

```
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx              # Root layout with providers
│   ├── index.tsx                # Home screen
│   ├── device-check.tsx         # Device check modal
│   ├── my-videos.tsx            # Video library screen
│   ├── protected-preview.tsx    # Protected content preview
│   ├── test-harness.tsx         # Testing utilities
│   └── +native-intent.tsx       # Native intent handler
├── components/                   # Reusable UI components
│   ├── ui/                      # UI primitives
│   ├── browser/                 # Browser-specific components
│   ├── device-check/            # Device check components
│   ├── my-videos/              # Video-related components
│   ├── ErrorBoundary.tsx       # Error boundary wrapper
│   ├── TestingWatermark.tsx    # Testing indicator
│   └── [other components]
├── contexts/                    # React Context providers
│   ├── DeviceTemplateContext.tsx
│   ├── VideoLibraryContext.tsx
│   ├── DeveloperModeContext.tsx
│   └── ProtocolContext.tsx
├── hooks/                       # Custom React hooks
├── utils/                       # Utility functions and helpers
│   └── logger.ts               # Logging utilities
├── constants/                   # Application constants
├── types/                       # TypeScript type definitions
├── assets/                      # Static assets (images, fonts)
├── __tests__/                   # Test files
├── __mocks__/                   # Mock files for testing
└── [config files]              # babel.config.js, tsconfig.json, etc.
```

### Important Files
- `app/_layout.tsx` - Root layout with global providers (QueryClient, GestureHandler, Contexts)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration with strict mode
- `eslint.config.js` - ESLint configuration
- `jest.config.js` & `jest.setup.js` - Testing configuration

## How to Build and Test

### Installation
```bash
bun install           # Install dependencies
```

### Development
```bash
bun run start         # Start development server (iOS/Android)
bun run start-web     # Start web preview
bun run start-web-dev # Start web preview with debug logs
```

### Linting
```bash
bun run lint          # Run ESLint (uses expo lint)
```

### Testing
```bash
bunx jest             # Run Jest tests (no test script defined in package.json)
```

Note: The project has Jest configured via `jest.config.js` but no `test` script in `package.json`. Use `bunx jest` directly or add a test script to package.json if needed.

### Project Commands
- Press `i` in terminal after `bun start` to open iOS Simulator
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR code with Expo Go or Rork app to test on physical device

## Key Considerations

### Platform-Specific Code
- Some features require Custom Development Builds (not available in Expo Go):
  - Native authentication (Face ID, Touch ID)
  - In-app purchases
  - Push notifications
  - Custom native modules

### Context Usage
The app uses multiple React Contexts for state management:
- **DeviceTemplateContext** - Device template data
- **VideoLibraryContext** - Video library management
- **DeveloperModeContext** - Developer mode settings
- **ProtocolContext** - Protocol handling

Always wrap components that need context access within the appropriate provider.

### Error Handling
- Use the `ErrorBoundary` component to wrap screens/components
- Implement proper error states in UI components
- Use try-catch blocks for async operations
- Log errors using the logger utility (`@/utils/logger`)

### Performance
- Use `React.memo` for expensive component renders
- Implement proper list virtualization with `FlatList` or `FlashList`
- Avoid inline function definitions in render methods
- Use `useMemo` and `useCallback` appropriately to prevent unnecessary re-renders

## Rork-Specific Notes

- Changes made via Rork are automatically committed to GitHub
- Local changes pushed to GitHub are reflected in Rork
- The app uses Rork's toolkit SDK (`@rork-ai/toolkit-sdk`)
- Follow Rork's conventions for cross-platform compatibility

## Common Patterns

### Creating a New Screen
1. Add a new file in `app/` directory (e.g., `app/new-screen.tsx`)
2. Export a default React component
3. Add navigation in `app/_layout.tsx` if needed
4. Use Expo Router's `<Stack.Screen>` for configuration

### Creating a New Context
1. Create file in `contexts/` (e.g., `contexts/NewContext.tsx`)
2. Define context type and default values
3. Create provider component
4. Add provider to `app/_layout.tsx` root layout
5. Create custom hook for easy context consumption (e.g., `useNewContext`)

### Adding a New Component
1. Create file in `components/` (use appropriate subdirectory)
2. Use TypeScript with proper prop types
3. Export as named export
4. Add test file in `__tests__/` if testing complex logic

## Best Practices Summary

- ✅ Always use TypeScript with strict mode
- ✅ Follow Expo Router file-based routing conventions
- ✅ Use React Context for cross-component state
- ✅ Implement error boundaries for robust error handling
- ✅ Write platform-agnostic code when possible
- ✅ Use the `@/` path alias for cleaner imports
- ✅ Test components with @testing-library/react-native
- ✅ Follow ESLint rules and maintain consistent code style
- ✅ Use proper TypeScript types (avoid `any`)
- ✅ Implement proper loading and error states in UI
