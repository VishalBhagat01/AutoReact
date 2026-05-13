# Figma Design Parser MVP

A modern web application that converts Figma designs into a normalized component tree structure. Parse Figma files, extract design hierarchy, and visualize the component tree with an interactive inspector.

## Features

✨ **Core Features:**
- 📥 Import Figma files directly via URL
- 🌳 Recursive tree parser with normalized output
- 🎨 Interactive tree viewer with collapsible nodes
- 🔍 Node detail inspector panel
- 📊 Extracts design metadata (colors, typography, spacing, etc.)
- 🎯 Support for multiple node types (Frame, Group, Text, Rectangle, Component, Instance, etc.)

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Axios** - HTTP client
- **Dotenv** - Environment management

## Project Structure

```
Reagmat/
├── backend/
│   ├── index.js                 # Main server file
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── controllers/         # Request handlers
│       ├── services/            # Business logic (Figma API, Parser)
│       ├── routes/              # API endpoints
│       ├── middleware/          # Custom middleware
│       └── utils/               # Helper functions
│
└── frontend/
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx             # Entry point
        ├── App.jsx              # Main app component
        ├── index.css            # Global styles (Tailwind)
        ├── api/                 # API client
        ├── components/          # React components
        ├── store/               # Zustand store
        ├── hooks/               # Custom hooks
        ├── utils/               # Helper functions
        └── pages/               # Page components
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- Figma account with API access token

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables in `.env`:**
   ```env
   PORT=5000
   NODE_ENV=development
   FIGMA_TOKEN=your_figma_api_token_here
   ```

   **How to get Figma Token:**
   1. Go to [Figma Settings](https://www.figma.com/settings/account)
   2. Navigate to "Account" → "Personal access tokens"
   3. Click "Create a new token"
   4. Copy and paste the token into your `.env` file

5. **Start the backend server:**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables (optional):**
   ```env
   VITE_API_URL=http://localhost:5000
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173`

## Usage

### Importing a Figma Design

1. Open the application in your browser
2. In the import panel, paste your Figma file URL:
   ```
   https://www.figma.com/file/KEY/FileName
   ```
3. Click the "Import" button
4. Wait for the design tree to load

### Exploring the Tree

- **Tree Viewer (Left Panel):**
  - Expand/collapse nodes with the arrow icons
  - Click any node to select it
  - View node type badge for quick identification

- **Details Panel (Right Panel):**
  - View selected node's properties
  - See extracted styles (colors, typography, spacing)
  - View node dimensions and bounds
  - Check text content and layout information

## API Endpoints

### Import Figma File
```
POST /api/figma/import

Request Body:
{
  "url": "https://www.figma.com/file/..."
}

Response:
{
  "success": true,
  "data": {
    "fileName": "Design File Name",
    "fileVersion": "1.0",
    "totalNodeCount": 245,
    "tree": { /* normalized tree structure */ },
    "pages": [ /* all pages */ ]
  }
}
```

### Health Check
```
GET /health
GET /api/figma/health

Response:
{
  "success": true,
  "message": "API is operational"
}
```

## Normalized Tree Structure

Each node in the tree follows this structure:

```javascript
{
  "id": "node-id",
  "name": "Component Name",
  "type": "FRAME | GROUP | TEXT | RECTANGLE | COMPONENT | INSTANCE | ...",
  "layout": "horizontal | vertical | null",
  "text": "Text content (if TEXT node)",
  "bounds": {
    "x": 0,
    "y": 0,
    "width": 100,
    "height": 50
  },
  "styles": {
    "colors": [
      {
        "type": "SOLID",
        "color": "rgba(255, 0, 0, 1)"
      }
    ],
    "text": {
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": 600,
      "lineHeight": 24
    },
    "spacing": {
      "paddingLeft": 16,
      "paddingRight": 16,
      "paddingTop": 8,
      "paddingBottom": 8,
      "itemSpacing": 12
    },
    "borderRadius": {
      "all": 8
    }
  },
  "children": [
    { /* child node */ }
  ]
}
```

## Supported Node Types

- ✅ **FRAME** - Container/artboard
- ✅ **GROUP** - Grouping container
- ✅ **TEXT** - Text layer
- ✅ **RECTANGLE** - Shape
- ✅ **ELLIPSE** - Circular/elliptical shape
- ✅ **POLYGON** - Polygon shape
- ✅ **COMPONENT** - Reusable component
- ✅ **INSTANCE** - Component instance

Other node types are automatically filtered out for cleaner output.

## Extracted Style Properties

### Colors
- Fill colors with RGBA values

### Typography
- Font size
- Font family
- Font weight
- Line height

### Spacing
- Padding (top, right, bottom, left)
- Item spacing (for layout containers)

### Border Radius
- Individual corner radius or uniform radius

### Layout Information
- Layout mode (horizontal/vertical)
- Node dimensions (width, height)
- Position (x, y coordinates)

## Error Handling

### Common Errors

**Invalid Figma URL:**
- Ensure the URL follows the format: `https://www.figma.com/file/KEY/...`
- Check that the file key is correct

**Invalid Figma Token:**
- Verify your token in Figma account settings
- Regenerate if needed

**File Not Found:**
- Confirm the file ID is correct
- Ensure you have access to the file

**API Connection Error:**
- Verify backend is running on `http://localhost:5000`
- Check network connectivity

## Troubleshooting

### Backend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Frontend won't connect to backend
```bash
# Verify backend is running
curl http://localhost:5000/health

# Check VITE_API_URL in .env
cat .env
```

### Module not found errors
```bash
# Reinstall dependencies
npm install

# For frontend, ensure Tailwind is installed
npm install -D tailwindcss postcss autoprefixer
```

## Development Notes

### Code Quality
- Modular component architecture
- Reusable utility functions
- Clean error handling with try-catch
- Async/await for async operations
- JSDoc comments for complex functions

### Scalability Considerations
- Zustand store for easy state management
- Recursive parser handles deeply nested trees
- API client abstraction for future API changes
- Component-based UI for easy extension


## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for your own work!

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API error messages
3. Verify environment configuration
4. Check browser console for errors

---

**Happy designing! 🎨**
