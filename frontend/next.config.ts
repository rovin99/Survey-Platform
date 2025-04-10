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
		// Enable server actions if you plan to use them
		serverActions: true,
	},
};

module.exports = nextConfig;