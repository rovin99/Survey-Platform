import type { NextConfig } from 'next';

// Get API URLs from environment variables for CSP
const getApiUrls = () => {
	const urls = [
		'self',
		// Local development URLs
		'http://localhost:3000',  // Next.js dev server
		'ws://localhost:3000',    // Next.js HMR WebSocket
		'http://localhost:5171',
		'http://localhost:5172',
		'http://localhost:3001',
		'http://localhost:8080',
		'ws://localhost:3001',
		// Cluster URLs (nip.io)
		'http://*.127.0.0.1.nip.io:8080',  // Allow all .nip.io services
		'ws://*.127.0.0.1.nip.io:8080',    // WebSocket support
		'http://frontend.default.127.0.0.1.nip.io:8080',
		'http://auth-service.default.127.0.0.1.nip.io:8080',
		'http://survey-management-service.default.127.0.0.1.nip.io:8080',
		'http://participants-management-service.default.127.0.0.1.nip.io:8080',
		// ngrok public URL (HTTPS)
		'https://trypanosomic-tamisha-imbricately.ngrok-free.dev',
		'https://*.ngrok-free.dev',  // Allow all ngrok subdomains
	];
	
	// Add environment-based API URLs
	if (process.env.NEXT_PUBLIC_API_BASE_URL) {
		urls.push(process.env.NEXT_PUBLIC_API_BASE_URL);
	}
	if (process.env.NEXT_PUBLIC_AUTH_SERVICE_URL) {
		urls.push(process.env.NEXT_PUBLIC_AUTH_SERVICE_URL);
	}
	if (process.env.NEXT_PUBLIC_SURVEY_SERVICE_URL) {
		urls.push(process.env.NEXT_PUBLIC_SURVEY_SERVICE_URL);
	}
	if (process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL) {
		urls.push(process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL);
	}
	
	// Remove duplicates
	return [...new Set(urls)].join(' ');
};

const nextConfig: NextConfig = {
	// Enable standalone output for Docker
	output: 'standalone',
	eslint: {
		ignoreDuringBuilds: true, // Ignore ESLint warnings during build
	},
	typescript: {
		ignoreBuildErrors: true, // Ignore TypeScript errors during build
	},
	async headers() {
		const connectSrc = getApiUrls();
		
		return [
			{
				// Apply these headers to all routes
				source: "/:path*",
				headers: [
					{ key: "Access-Control-Allow-Credentials", value: "true" },
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=(), notifications=()",
					},
					{
						key: "Content-Security-Policy",
						value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains; preload",
					},
				],
			},
		];
	},
	// Enable strict mode for better development experience
	reactStrictMode: true,
	// Disable x-powered-by header for security
	poweredByHeader: false,
	// Configure allowed domains for images if you're using them
	images: {
		domains: [],
		dangerouslyAllowSVG: false,
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},
	// Configure redirects if needed
	async redirects() {
		return [
			{
				source: "/home",
				destination: "/",
				permanent: true,
			},
		];
	},
	// Enable experimental features if needed
	experimental: {
		// Configure server actions properly
		serverActions: {
			allowedOrigins: ['localhost:3000'],
			bodySizeLimit: '2mb'
		},
	},
	// Add security-related webpack configuration
	webpack: (config, { dev, isServer }) => {
		// Add security-related webpack plugins if needed
		if (!dev && !isServer) {
			// Production client-side optimizations
			config.optimization.minimizer = config.optimization.minimizer || [];
		}
		return config;
	},
};

export default nextConfig;