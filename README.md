# ATS Resume Checker

A modern web application that analyzes resumes for ATS (Applicant Tracking System) compatibility using Gemini AI. Upload your resume and get instant feedback on how well it will perform with automated screening systems.

## Features

- **File Upload**: PDF files (validated by MIME type and magic bytes, max 10MB)
- **AI-Powered Analysis**: Uses Google's Gemini AI for intelligent document processing
- **ATS Compatibility Scoring**: Get a detailed 0-100 score
- **Keyword Analysis**: Identify missing and found keywords
- **Smart Recommendations**: Actionable suggestions for improvement
- **Skills Extraction**: Automatic detection of technical and soft skills
- **Contact Information Parsing**: Extract and validate contact details
- **Downloadable Reports**: Generate a PDF analysis report
- **Rate Limiting**: Per-IP throttling on the analysis endpoint

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **AI Processing**: Google Gemini AI (`@google/genai`)
- **PDF Report**: html2canvas + jsPDF (lazy-loaded on demand)
- **UI Components**: Custom components with Lucide React icons

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini AI API key

## Environment Setup

1. Create a `.env.local` file in the project root:
```bash
# Google Gemini AI API Key
# Get your API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here
```

2. Replace `your_gemini_api_key_here` with your actual Gemini API key

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd ats-resume-checker
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Get Gemini AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env.local` file

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Resume**: Drag and drop or click to browse for your resume file
2. **Wait for Analysis**: The AI will process your document (usually takes 10-30 seconds)
3. **Review Results**: Check your ATS compatibility score and detailed feedback
4. **Follow Recommendations**: Use the suggestions to improve your resume
5. **Print Report**: Generate a printable version of your analysis

## API Endpoints

### POST `/api/process-resume`

Processes a resume file and returns structured analysis data.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Body: Form data with 'file' field containing the resume

**Response:**

```json
{
  "success": true,
  "data": {
    "document_type": "resume",
    "header": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "location": "New York, NY"
    },
    "sections": {
      "summary": "...",
      "experience": [...],
      "education": [...],
      "skills": {
        "technical": ["JavaScript", "React", "Node.js"],
        "soft": ["Leadership", "Communication"]
      }
    },
    "ats_analysis": {
      "score": 85,
      "issues": ["Missing keywords: 'TypeScript'"],
      "recommendations": ["Add TypeScript to your skills section"],
      "keyword_matches": ["JavaScript", "React"],
      "missing_keywords": ["TypeScript", "Python"]
    }
  }
}
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── process-resume/
│   │       └── route.ts          # API endpoint
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── progress.tsx
│   ├── FileUpload.tsx            # File upload component
│   └── ResultsDisplay.tsx        # Results display component
└── lib/
    ├── gemini-service.ts         # Gemini AI service
    └── utils.ts                  # Utility functions
```

## Customization

### Adding New ATS Criteria

Edit the prompt in `src/lib/gemini-service.ts` to include additional ATS compatibility checks.

### Styling

The application uses Tailwind CSS with custom CSS variables. Modify `src/app/globals.css` for theme changes.

### File Types

Supported file types can be modified in:

- `src/components/FileUpload.tsx` (frontend validation)
- `src/app/api/process-resume/route.ts` (backend validation)

## Security Considerations

- File size is limited to 10MB
- Only PDF files are accepted, validated by both MIME type and magic bytes
- Files are processed in memory and not stored
- The analysis endpoint is rate limited per IP
- Security headers (nosniff, X-Frame-Options, Referrer-Policy) are set globally
- `GEMINI_API_KEY` is server-only and never shipped to the browser

## Performance

- Files are processed asynchronously
- Large files may take longer to process
- Consider implementing a queue system for production use

## Troubleshooting

### Common Issues

1. **API Key Error**: Ensure your Gemini API key is correctly set in `.env.local`
2. **File Upload Fails**: Check file size and format restrictions
3. **Processing Timeout**: Large or complex documents may take longer

### Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on the GitHub repository.
