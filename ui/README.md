# UltraIntelligence React UI

A beautiful, modern React interface for the UltraIntelligence Student Counselor system.

## Features

- 🎨 **Elegant Dark Theme** - Sleek black and white design with blue accents
- 🚀 **Smooth Animations** - Powered by Framer Motion for delightful interactions
- 📱 **Responsive Design** - Works perfectly on desktop and mobile devices
- ⚡ **Real-time Progress** - Beautiful loading animations and progress bars
- 💬 **Interactive Chat** - Modern chat interface with typing indicators
- 🎯 **Smart Suggestions** - Pre-built suggestion buttons for quick start

## Tech Stack

- **React 18** - Latest React with hooks and modern patterns
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Production-ready motion library
- **Lucide React** - Beautiful, customizable icons
- **Express.js** - Backend API server

## Setup Instructions

### 1. Install Dependencies

```bash
cd ui
npm install
```

### 2. Start the Backend Server

In the root directory, start the Express server:

```bash
npm install  # Install new dependencies first
npm run dev  # This will start the backend on port 3001
```

### 3. Start the React Development Server

In a new terminal, start the React app:

```bash
cd ui
npm start
```

The React app will open at `http://localhost:3000`

### 4. Alternative: Run Both Simultaneously

From the root directory:

```bash
npm run dev-full
```

This will start both the backend and frontend simultaneously.

## Project Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── ProgressBar.js      # Animated progress bar
│   │   ├── MessageBubble.js    # Chat message component
│   │   └── SuggestionButton.js # Suggestion button component
│   ├── App.js                  # Main application component
│   ├── index.js                # React entry point
│   └── index.css               # Global styles and Tailwind
├── public/
│   └── index.html              # HTML template
├── package.json                 # Dependencies and scripts
├── tailwind.config.js          # Tailwind configuration
└── postcss.config.js           # PostCSS configuration
```

## API Integration

The React app communicates with the Express backend through these endpoints:

- `POST /api/start-session` - Start a new counseling session
- `POST /api/conversation` - Send and receive messages
- `POST /api/extract-data` - Extract conversation data

## Customization

### Colors

Edit `tailwind.config.js` to customize the color scheme:

```javascript
colors: {
  'ultra-black': '#000000',
  'ultra-gray': '#1a1a1a',
  'ultra-light-gray': '#2a2a2a',
  'ultra-white': '#ffffff',
  'ultra-accent': '#3b82f6',
}
```

### Animations

Modify animation timings in `src/index.css`:

```css
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
```

## Building for Production

```bash
cd ui
npm run build
```

This creates an optimized production build in the `build/` folder.

## Troubleshooting

### Port Conflicts

If you get port conflicts, you can:

1. Change the backend port in `server.js`:
   ```javascript
   const PORT = process.env.PORT || 3002;
   ```

2. Update the API URL in `src/App.js`:
   ```javascript
   const API_BASE_URL = 'http://localhost:3002/api';
   ```

### CORS Issues

The backend includes CORS middleware, but if you encounter issues, ensure the backend is running and accessible.

## Contributing

1. Follow the existing code style
2. Use meaningful component names
3. Add proper error handling
4. Test on both desktop and mobile
5. Ensure animations are smooth and performant

## License

MIT License - see the main project README for details.
