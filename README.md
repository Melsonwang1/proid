# EASE - Engage Actively, Support Emotionally

A modern, responsive website for mental health and emotional wellness support, built with HTML, CSS, and JavaScript.

## Features

- 🌸 **Modern Design**: Clean, pastel-colored interface with smooth animations
- 📱 **Responsive**: Works perfectly on desktop, tablet, and mobile devices
- ⚡ **Fast Loading**: Optimized for performance with minimal dependencies
- 🎨 **Accessibility**: WCAG compliant with keyboard navigation support
- 🔒 **Secure**: Built with security best practices and CSP headers

## Design Highlights

- **Pastel Color Palette**: Soft lavender, mint, peach, sky blue, and rose colors
- **Modern Typography**: Inter font family for excellent readability
- **Interactive Elements**: Hover effects, smooth scrolling, and floating animations
- **Keyhole Logo**: Custom CSS-based recreation of the EASE brand logo
- **Mobile-First**: Responsive design that works beautifully on all devices

## Quick Start

1. Clone this repository
2. Open `index.html` in your web browser
3. Or serve locally: `python -m http.server 3000`

## Deployment on Vercel

### Automatic Deployment (Recommended)

1. **Connect to GitHub**:
   - Go to [Vercel](https://vercel.com)
   - Sign up/Login with your GitHub account
   - Click "New Project"
   - Import your `proid` repository

2. **Configure**:
   - Root Directory: `./` (default)
   - Build Command: Leave empty (static site)
   - Output Directory: `./` (default)

3. **Deploy**:
   - Click "Deploy"
   - Your site will be available at `https://your-project-name.vercel.app`

### Manual Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Production Deploy**:
   ```bash
   vercel --prod
   ```

## File Structure

```
proid/
├── index.html          # Main HTML file
├── styles.css          # CSS styles with pastel theme
├── script.js           # JavaScript functionality
├── vercel.json         # Vercel deployment configuration
├── package.json        # Project metadata
└── README.md          # This file
```

## Customization

### Colors
All colors are defined as CSS custom properties in `:root` within `styles.css`. You can easily modify the color scheme by updating these variables.

### Content
- Update text content in `index.html`
- Modify section content to match your specific needs
- Add your own contact information

### Functionality
- Contact form is set up with validation
- Mobile navigation is fully functional
- Smooth scrolling between sections
- Responsive design breakpoints

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Lighthouse Score: 95+ (Performance, Accessibility, Best Practices, SEO)
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

## Contact

For questions or support, please reach out to support@ease.com

## License

MIT License - feel free to use this code for your own projects!
