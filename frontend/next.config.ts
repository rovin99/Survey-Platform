/** @type {import('next').NextConfig} */
const nextConfig = {
	eslint: {
		ignoreDuringBuilds: true, // Ignore ESLint warnings during build
	},
	typescript: {
		ignoreBuildErrors: true, // Ignore TypeScript errors during build
	},
	async headers() {
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
						value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:5171 http://localhost:5172; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
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

module.exports = nextConfig;