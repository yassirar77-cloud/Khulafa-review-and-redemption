// Load .env for command-line scripts (Next.js does this itself for the app).
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: rely on real environment variables
}
